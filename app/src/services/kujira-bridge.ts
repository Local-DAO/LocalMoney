import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { Decimal } from '@cosmjs/math'
import type { OfflineSigner } from '@cosmjs/launchpad'
import { KUJIRA_CONFIG, BURN_ADDRESS } from '~/utils/bridge-constants'
import { toMinimalDenom, fromMinimalDenom } from '~/utils/bridge-validation'

declare global {
  interface Window {
    keplr?: any
    getOfflineSignerAuto?: (chainId: string) => Promise<OfflineSigner>
  }
}

export class KujiraService {
  private client?: SigningCosmWasmClient
  private signer?: OfflineSigner
  private account?: { address: string }
  private readonly isBrowser: boolean

  constructor() {
    this.isBrowser = typeof window !== 'undefined'
  }

  /**
   * Suggests the Kujira chain to Keplr wallet
   */
  private static async suggestChain(): Promise<void> {
    if (typeof window === 'undefined' || !window.keplr) {
      throw new Error('Keplr wallet is not installed')
    }

    const chainConfig = {
      chainId: KUJIRA_CONFIG.chainId,
      chainName: KUJIRA_CONFIG.chainName,
      rpc: KUJIRA_CONFIG.rpc,
      rest: KUJIRA_CONFIG.rest,
      bip44: {
        coinType: 118,
      },
      bech32Config: {
        bech32PrefixAccAddr: KUJIRA_CONFIG.bech32Prefix,
        bech32PrefixAccPub: KUJIRA_CONFIG.bech32Prefix + 'pub',
        bech32PrefixValAddr: KUJIRA_CONFIG.bech32Prefix + 'valoper',
        bech32PrefixValPub: KUJIRA_CONFIG.bech32Prefix + 'valoperpub',
        bech32PrefixConsAddr: KUJIRA_CONFIG.bech32Prefix + 'valcons',
        bech32PrefixConsPub: KUJIRA_CONFIG.bech32Prefix + 'valconspub',
      },
      currencies: [
        {
          coinDenom: KUJIRA_CONFIG.coinDenom,
          coinMinimalDenom: KUJIRA_CONFIG.coinMinimalDenom,
          coinDecimals: KUJIRA_CONFIG.coinDecimals,
        },
      ],
      feeCurrencies: [
        {
          coinDenom: KUJIRA_CONFIG.coinDenom,
          coinMinimalDenom: KUJIRA_CONFIG.coinMinimalDenom,
          coinDecimals: KUJIRA_CONFIG.coinDecimals,
          gasPriceStep: {
            low: 0.01,
            average: 0.025,
            high: 0.03,
          },
        },
      ],
      stakeCurrency: {
        coinDenom: KUJIRA_CONFIG.coinDenom,
        coinMinimalDenom: KUJIRA_CONFIG.coinMinimalDenom,
        coinDecimals: KUJIRA_CONFIG.coinDecimals,
      },
    }

    try {
      await window.keplr.experimentalSuggestChain(chainConfig)
    } catch (error) {
      console.error('Error suggesting chain to Keplr:', error)
      throw new Error('Failed to add Kujira chain to Keplr')
    }
  }

  /**
   * Connect to Kujira via Keplr wallet
   */
  async connect(): Promise<string> {
    if (!this.isBrowser) {
      throw new Error('Not running in browser environment')
    }

    console.log('Kujira connect called')
    console.log('Will use RPC:', KUJIRA_CONFIG.rpc)

    if (!window.keplr || !window.getOfflineSignerAuto) {
      throw new Error('Keplr wallet is not installed. Please install Keplr extension.')
    }

    try {
      // For Kujira mainnet, try to enable directly first (it's likely already configured in Keplr)
      console.log('Enabling Keplr for Kujira...')
      try {
        await window.keplr.enable(KUJIRA_CONFIG.chainId)
      } catch (enableError) {
        // If enable fails, suggest the chain
        console.log('Chain not found in Keplr, suggesting...')
        await KujiraService.suggestChain()
        await window.keplr.enable(KUJIRA_CONFIG.chainId)
      }

      console.log('Getting offline signer...')
      // Get offline signer
      this.signer = await window.getOfflineSignerAuto(KUJIRA_CONFIG.chainId)

      console.log('Getting accounts...')
      // Get account first before connecting to RPC
      const accounts = await this.signer.getAccounts()
      if (accounts.length === 0) {
        throw new Error('No accounts found in Keplr wallet')
      }
      this.account = accounts[0]

      // Don't create the client connection yet - just return the address
      // The client will be created lazily when needed for transactions
      console.log('Connected to Keplr successfully, address:', this.account.address)
      return this.account.address
    } catch (error: any) {
      console.error('Error connecting to Kujira:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      throw new Error(error.message || 'Failed to connect to Kujira wallet')
    }
  }

  /**
   * Disconnect from Kujira
   */
  disconnect(): void {
    this.client = undefined
    this.signer = undefined
    this.account = undefined
  }

  /**
   * Get the connected wallet address
   */
  getAddress(): string {
    if (!this.account) {
      throw new Error('Wallet not connected')
    }
    return this.account.address
  }

  /**
   * Ensure client is connected
   */
  private async ensureClient(): Promise<void> {
    if (!this.client && this.signer) {
      console.log('Creating client connection to:', KUJIRA_CONFIG.rpc)
      this.client = await SigningCosmWasmClient.connectWithSigner(
        KUJIRA_CONFIG.rpc,
        this.signer,
        {
          gasPrice: {
            amount: Decimal.fromUserInput('0.025', 100),
            denom: KUJIRA_CONFIG.coinMinimalDenom,
          },
        }
      )
    }
  }

  /**
   * Get token balance
   */
  async getBalance(): Promise<string> {
    if (!this.account) {
      throw new Error('Wallet not connected')
    }

    try {
      await this.ensureClient()
      if (!this.client) {
        throw new Error('Failed to connect to RPC')
      }

      const balance = await this.client.getBalance(
        this.account.address,
        KUJIRA_CONFIG.coinMinimalDenom
      )
      return fromMinimalDenom(balance.amount, KUJIRA_CONFIG.coinDecimals)
    } catch (error) {
      console.error('Error fetching balance:', error)
      throw new Error('Failed to fetch balance')
    }
  }

  /**
   * Burn tokens by sending to the burn module address with BSC recipient in memo
   * @param amount Amount in KUJI (will be converted to minimal denom)
   * @param bscRecipient BSC address to receive tokens
   */
  async burnTokens(amount: string, bscRecipient: string): Promise<string> {
    if (!this.account) {
      throw new Error('Wallet not connected')
    }

    try {
      await this.ensureClient()
      if (!this.client) {
        throw new Error('Failed to connect to RPC')
      }

      // Convert amount to minimal denom
      const amountInMinimalDenom = toMinimalDenom(amount, KUJIRA_CONFIG.coinDecimals)

      // Create the send message with memo containing BSC address
      const sendMsg = {
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: {
          fromAddress: this.account.address,
          toAddress: BURN_ADDRESS,
          amount: [
            {
              denom: KUJIRA_CONFIG.coinMinimalDenom,
              amount: amountInMinimalDenom,
            },
          ],
        },
      }

      // Execute the transaction with BSC address in memo
      const result = await this.client.signAndBroadcast(
        this.account.address,
        [sendMsg],
        'auto',
        bscRecipient // BSC address as memo
      )

      if (result.code !== 0) {
        throw new Error('Transaction failed: ' + result.rawLog)
      }

      return result.transactionHash
    } catch (error: any) {
      console.error('Error burning tokens:', error)
      throw new Error(error.message || 'Failed to burn tokens')
    }
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return !!this.client && !!this.account
  }
}

// Export singleton instance
export const kujiraService = new KujiraService()
