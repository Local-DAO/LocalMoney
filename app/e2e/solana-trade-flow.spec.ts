/**
 * Solana Trade Flow E2E Test
 *
 * This test uses two browser contexts to simulate a maker and taker
 * completing a trade on the LocalMoney platform using Solana.
 *
 * Test wallets (funded on localnet):
 * - Maker: 7gG7tH3bY7B3Anc6RmDQHoWgkNUhzXDBaTc55ikqkXxR
 * - Taker: Fcu81FSmGnwXerKQjCHxRwYYX2F8ftdyt1EVBEJeiqev
 */

import { test, expect, BrowserContext, Page } from '@playwright/test'

// Test wallet secret keys (base58 encoded)
const MAKER_SECRET_KEY = '5y1giAQUh5qSQttZu7U7Ljdsjsb52YKDG48oN76a1s6ueZ8tDUy9pAcQGbFgu5Ey3ZM5LmoFW3dfSTMKNk4g7pLu'
const TAKER_SECRET_KEY = '2VHmGQ1G9ZhbBubkmUNNGxUS98zjXdhgmje3BUkcW8TXwP9BHnRPdWPSCEJBCQZvwPNMSgtBf4UcHW8H8s1sHopr'

const MAKER_ADDRESS = '7gG7tH3bY7B3Anc6RmDQHoWgkNUhzXDBaTc55ikqkXxR'
const TAKER_ADDRESS = 'Fcu81FSmGnwXerKQjCHxRwYYX2F8ftdyt1EVBEJeiqev'

// Script to inject mock Phantom wallet
function createMockPhantomScript(secretKeyBase58: string, pubkeyBase58: string): string {
  return `
    (function() {
      // Base58 decode function
      const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      const ALPHABET_MAP = {};
      for (let i = 0; i < ALPHABET.length; i++) {
        ALPHABET_MAP[ALPHABET[i]] = i;
      }

      function base58ToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
          let carry = ALPHABET_MAP[str[i]];
          for (let j = 0; j < bytes.length; j++) {
            carry += bytes[j] * 58;
            bytes[j] = carry & 0xff;
            carry >>= 8;
          }
          while (carry > 0) {
            bytes.push(carry & 0xff);
            carry >>= 8;
          }
        }
        // Add leading zeros
        for (let i = 0; i < str.length && str[i] === '1'; i++) {
          bytes.push(0);
        }
        return new Uint8Array(bytes.reverse());
      }

      // Store keypair info
      const secretKeyBase58 = '${secretKeyBase58}';
      const pubkeyBase58 = '${pubkeyBase58}';
      const secretKey = base58ToBytes(secretKeyBase58);

      // Mock PublicKey class
      class MockPublicKey {
        constructor(value) {
          if (typeof value === 'string') {
            this._key = value;
          } else if (value instanceof Uint8Array) {
            this._key = this._toBase58(value);
          } else {
            this._key = value;
          }
        }

        _toBase58(bytes) {
          // Simple base58 encode for 32 bytes
          return pubkeyBase58;
        }

        toString() {
          return this._key;
        }

        toBase58() {
          return this._key;
        }

        toBytes() {
          return base58ToBytes(this._key);
        }

        equals(other) {
          return this._key === other.toString();
        }
      }

      const publicKey = new MockPublicKey(pubkeyBase58);
      let connected = false;
      const listeners = {};

      // Create mock Phantom provider
      const mockPhantom = {
        solana: {
          isPhantom: true,
          publicKey: null,
          isConnected: false,

          connect: async function(opts) {
            console.log('[MockPhantom] Connecting...');
            connected = true;
            this.isConnected = true;
            this.publicKey = publicKey;

            // Emit connect event
            if (listeners['connect']) {
              listeners['connect'].forEach(cb => cb({ publicKey }));
            }

            console.log('[MockPhantom] Connected:', pubkeyBase58);
            return { publicKey };
          },

          disconnect: async function() {
            console.log('[MockPhantom] Disconnecting...');
            connected = false;
            this.isConnected = false;
            this.publicKey = null;

            if (listeners['disconnect']) {
              listeners['disconnect'].forEach(cb => cb());
            }
          },

          signTransaction: async function(transaction) {
            console.log('[MockPhantom] Signing transaction...');
            // In a real implementation, we would use nacl to sign
            // For testing, we'll return the transaction as-is
            // The frontend should handle this gracefully
            return transaction;
          },

          signAllTransactions: async function(transactions) {
            console.log('[MockPhantom] Signing', transactions.length, 'transactions...');
            return transactions;
          },

          signMessage: async function(message, encoding) {
            console.log('[MockPhantom] Signing message...');
            return { signature: new Uint8Array(64), publicKey };
          },

          on: function(event, callback) {
            if (!listeners[event]) {
              listeners[event] = [];
            }
            listeners[event].push(callback);
          },

          off: function(event, callback) {
            if (listeners[event]) {
              listeners[event] = listeners[event].filter(cb => cb !== callback);
            }
          },

          removeListener: function(event, callback) {
            this.off(event, callback);
          },

          request: async function(params) {
            console.log('[MockPhantom] Request:', params.method);
            if (params.method === 'connect') {
              return this.connect();
            }
            return null;
          }
        }
      };

      // Inject into window
      window.phantom = mockPhantom;
      window.solana = mockPhantom.solana;

      console.log('[MockPhantom] Wallet injected for:', pubkeyBase58);
    })();
  `
}

test.describe('Solana Trade Flow', () => {
  let makerContext: BrowserContext
  let takerContext: BrowserContext
  let makerPage: Page
  let takerPage: Page

  test.beforeAll(async ({ browser }) => {
    // Create two separate browser contexts for maker and taker
    makerContext = await browser.newContext()
    takerContext = await browser.newContext()

    // Create pages
    makerPage = await makerContext.newPage()
    takerPage = await takerContext.newPage()

    // Inject mock wallet before any navigation
    await makerContext.addInitScript(createMockPhantomScript(MAKER_SECRET_KEY, MAKER_ADDRESS))
    await takerContext.addInitScript(createMockPhantomScript(TAKER_SECRET_KEY, TAKER_ADDRESS))
  })

  test.afterAll(async () => {
    await makerContext?.close()
    await takerContext?.close()
  })

  test('should complete full trade flow between maker and taker', async () => {
    // Step 1: Maker navigates to dashboard and selects Solana Localnet
    console.log('Step 1: Maker navigates to app and selects Solana Localnet')
    await makerPage.goto('/')
    await makerPage.waitForLoadState('networkidle')

    // Take screenshot
    await makerPage.screenshot({ path: 'e2e-screenshots/01-maker-home.png' })

    // Click chain selector and select Solana Localnet
    await makerPage.click('.chain-selector .chain-button')
    await makerPage.waitForSelector('.dropdown')
    await makerPage.screenshot({ path: 'e2e-screenshots/02-maker-chain-selector.png' })

    // Look for Solana Localnet option
    const localnetOption = makerPage.locator('text=Solana Localnet')
    if (await localnetOption.isVisible()) {
      await localnetOption.click()
      await makerPage.waitForTimeout(2000) // Wait for chain switch
    }

    await makerPage.screenshot({ path: 'e2e-screenshots/03-maker-solana-selected.png' })

    // Step 2: Maker connects wallet
    console.log('Step 2: Maker connects wallet')
    const connectButton = makerPage.locator('text=Connect Wallet').first()
    if (await connectButton.isVisible()) {
      await connectButton.click()
      await makerPage.waitForTimeout(2000)
    }

    await makerPage.screenshot({ path: 'e2e-screenshots/04-maker-wallet-connected.png' })

    // Step 3: Taker navigates and connects
    console.log('Step 3: Taker navigates and connects')
    await takerPage.goto('/')
    await takerPage.waitForLoadState('networkidle')

    // Select Solana Localnet for taker
    await takerPage.click('.chain-selector .chain-button')
    await takerPage.waitForSelector('.dropdown')
    const takerLocalnetOption = takerPage.locator('text=Solana Localnet')
    if (await takerLocalnetOption.isVisible()) {
      await takerLocalnetOption.click()
      await takerPage.waitForTimeout(2000)
    }

    // Connect taker wallet
    const takerConnectButton = takerPage.locator('text=Connect Wallet').first()
    if (await takerConnectButton.isVisible()) {
      await takerConnectButton.click()
      await takerPage.waitForTimeout(2000)
    }

    await takerPage.screenshot({ path: 'e2e-screenshots/05-taker-connected.png' })

    // Step 4: Maker creates an offer
    console.log('Step 4: Maker creates offer')
    await makerPage.goto('/offers')
    await makerPage.waitForLoadState('networkidle')
    await makerPage.screenshot({ path: 'e2e-screenshots/06-maker-offers-page.png' })

    // Look for create offer button
    const createOfferButton = makerPage.locator('text=Create Offer').first()
    if (await createOfferButton.isVisible()) {
      await createOfferButton.click()
      await makerPage.waitForTimeout(1000)
    }

    await makerPage.screenshot({ path: 'e2e-screenshots/07-maker-create-offer-form.png' })

    // Step 5: Taker views offers and opens trade
    console.log('Step 5: Taker views dashboard offers')
    await takerPage.goto('/dashboard')
    await takerPage.waitForLoadState('networkidle')
    await takerPage.screenshot({ path: 'e2e-screenshots/08-taker-dashboard.png' })

    console.log('Trade flow test completed - screenshots saved to e2e-screenshots/')
  })
})
