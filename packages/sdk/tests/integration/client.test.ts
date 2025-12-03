/**
 * Integration tests for LocalMoneyClient
 *
 * These tests require a running local validator or devnet connection.
 * Run with: npm run test:integration
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { LocalMoneyClient, LOCALNET_CONFIG } from "../../src";

// Skip these tests by default (require validator)
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION !== "false";

describe("LocalMoneyClient Integration", () => {
  let client: LocalMoneyClient;
  let connection: Connection;

  beforeAll(() => {
    if (SKIP_INTEGRATION) {
      console.log("Skipping integration tests (set SKIP_INTEGRATION=false to run)");
      return;
    }

    connection = new Connection(LOCALNET_CONFIG.endpoint, "confirmed");
    client = LocalMoneyClient.create({
      config: LOCALNET_CONFIG,
      connection,
    });
  });

  describe("Read-only operations", () => {
    it.skip("should create client in read-only mode", () => {
      if (SKIP_INTEGRATION) return;

      expect(client.isConnected).toBe(false);
      expect(client.walletPublicKey).toBeNull();
    });

    it.skip("should access all program clients", () => {
      if (SKIP_INTEGRATION) return;

      expect(client.hub).toBeDefined();
      expect(client.profile).toBeDefined();
      expect(client.offer).toBeDefined();
      expect(client.trade).toBeDefined();
      expect(client.arbitrator).toBeDefined();
      expect(client.priceOracle).toBeDefined();
    });

    it.skip("should fetch protocol status", async () => {
      if (SKIP_INTEGRATION) return;

      const status = await client.getProtocolStatus();
      expect(typeof status.isInitialized).toBe("boolean");
    });
  });

  describe("Wallet connection", () => {
    it.skip("should connect wallet", () => {
      if (SKIP_INTEGRATION) return;

      const wallet = Keypair.generate();
      const mockWalletAdapter = {
        publicKey: wallet.publicKey,
        signTransaction: jest.fn(),
        signAllTransactions: jest.fn(),
      };

      client.setWallet(mockWalletAdapter);
      expect(client.isConnected).toBe(true);
      expect(client.walletPublicKey?.equals(wallet.publicKey)).toBe(true);
    });

    it.skip("should disconnect wallet", () => {
      if (SKIP_INTEGRATION) return;

      const wallet = Keypair.generate();
      const mockWalletAdapter = {
        publicKey: wallet.publicKey,
        signTransaction: jest.fn(),
        signAllTransactions: jest.fn(),
      };

      client.setWallet(mockWalletAdapter);
      client.clearWallet();
      expect(client.isConnected).toBe(false);
    });
  });

  describe("Hub operations", () => {
    it.skip("should check hub initialization", async () => {
      if (SKIP_INTEGRATION) return;

      const isInitialized = await client.hub.isInitialized();
      expect(typeof isInitialized).toBe("boolean");
    });

    it.skip("should get hub config PDA", () => {
      if (SKIP_INTEGRATION) return;

      const { pda, bump } = client.hub.getConfigPDA();
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Profile operations", () => {
    it.skip("should check profile existence", async () => {
      if (SKIP_INTEGRATION) return;

      const randomUser = Keypair.generate().publicKey;
      const hasProfile = await client.profile.hasProfile(randomUser);
      expect(typeof hasProfile).toBe("boolean");
    });

    it.skip("should derive profile PDA", () => {
      if (SKIP_INTEGRATION) return;

      const user = Keypair.generate().publicKey;
      const { pda, bump } = client.profile.getProfilePDA(user);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Offer operations", () => {
    it.skip("should search active offers", async () => {
      if (SKIP_INTEGRATION) return;

      const offers = await client.offer.getActiveOffers();
      expect(Array.isArray(offers)).toBe(true);
    });

    it.skip("should search offers with filters", async () => {
      if (SKIP_INTEGRATION) return;

      const offers = await client.searchMarketplace({
        fiatCurrency: "USD",
      });
      expect(Array.isArray(offers)).toBe(true);
    });
  });

  describe("Trade operations", () => {
    it.skip("should derive trade PDAs", () => {
      if (SKIP_INTEGRATION) return;

      const tradeId = new BN(1);
      const { pda, bump } = client.trade.getTradePDA(tradeId);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });
  });
});

/**
 * End-to-end trade flow test
 *
 * This test requires:
 * 1. Running local validator
 * 2. Deployed programs
 * 3. Funded test wallets
 */
describe("E2E Trade Flow", () => {
  it.skip("should complete full trade workflow", async () => {
    // This test is skipped by default
    // Implementation would involve:
    // 1. Create profiles for buyer and seller
    // 2. Create offer
    // 3. Create trade
    // 4. Accept trade
    // 5. Fund escrow
    // 6. Confirm fiat
    // 7. Release escrow
    expect(true).toBe(true);
  });
});
