import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

// Import program types
import { Hub } from "../../target/types/hub";
import { Profile } from "../../target/types/profile";
import { Offer } from "../../target/types/offer";
import { Trade } from "../../target/types/trade";
import { Escrow } from "../../target/types/escrow";
import { Arbitrator } from "../../target/types/arbitrator";
import { PriceOracle } from "../../target/types/price_oracle";

// Import utilities
import {
  TestUser,
  fiatToBytes,
  bytesToFiat,
  getHubConfigPDA,
  getProfilePDA,
  getOfferPDA,
  getOfferCounterPDA,
  getTradePDA,
  getTradeCounterPDA,
  getEscrowVaultPDA,
  getArbitratorPDA,
  getPricePDA,
  getPriceProviderRegistryPDA,
  getPriceProviderPDA,
  BASIS_POINTS,
} from "../utils";

/**
 * Integration Test Setup
 *
 * Provides a comprehensive test environment for end-to-end testing of the
 * LocalMoney protocol on Solana.
 */
export class IntegrationTestSetup {
  provider: anchor.AnchorProvider;
  connection: anchor.web3.Connection;

  // Programs
  hubProgram: Program<Hub>;
  profileProgram: Program<Profile>;
  offerProgram: Program<Offer>;
  tradeProgram: Program<Trade>;
  escrowProgram: Program<Escrow>;
  arbitratorProgram: Program<Arbitrator>;
  priceOracleProgram: Program<PriceOracle>;

  // Test accounts
  admin: TestUser;
  buyer: TestUser;
  seller: TestUser;
  arbitrator1: TestUser;
  priceProvider: TestUser;

  // PDAs
  hubConfigPDA: PublicKey;
  hubConfigBump: number;
  priceProviderRegistryPDA: PublicKey;
  offerCounterPDA: PublicKey;
  tradeCounterPDA: PublicKey;

  // Test token
  tokenMint: PublicKey;
  tokenDecimals: number = 6;

  // Configuration
  readonly defaultFees = {
    burnFeePct: 50, // 0.5%
    chainFeePct: 100, // 1%
    warchestFeePct: 50, // 0.5%
    conversionFeePct: 100, // 1%
    arbitratorFeePct: 100, // 1%
  };

  readonly defaultLimits = {
    minTradeAmount: new BN(10_00), // $10 in cents
    maxTradeAmount: new BN(10000_00), // $10,000 in cents
    maxActiveOffers: 10,
    maxActiveTrades: 20,
  };

  readonly defaultTimers = {
    tradeExpirationTimer: new BN(3600), // 1 hour
    tradeDisputeTimer: new BN(7200), // 2 hours
  };

  constructor() {
    this.provider = anchor.AnchorProvider.env();
    anchor.setProvider(this.provider);
    this.connection = this.provider.connection;

    // Initialize programs
    this.hubProgram = anchor.workspace.Hub as Program<Hub>;
    this.profileProgram = anchor.workspace.Profile as Program<Profile>;
    this.offerProgram = anchor.workspace.Offer as Program<Offer>;
    this.tradeProgram = anchor.workspace.Trade as Program<Trade>;
    this.escrowProgram = anchor.workspace.Escrow as Program<Escrow>;
    this.arbitratorProgram = anchor.workspace.Arbitrator as Program<Arbitrator>;
    this.priceOracleProgram = anchor.workspace.PriceOracle as Program<PriceOracle>;

    // Initialize test users
    this.admin = new TestUser();
    this.buyer = new TestUser();
    this.seller = new TestUser();
    this.arbitrator1 = new TestUser();
    this.priceProvider = new TestUser();
  }

  /**
   * Programs accessor for backward compatibility
   */
  get programs() {
    return {
      hub: this.hubProgram,
      profile: this.profileProgram,
      offer: this.offerProgram,
      trade: this.tradeProgram,
      escrow: this.escrowProgram,
      arbitrator: this.arbitratorProgram,
      priceOracle: this.priceOracleProgram,
    };
  }

  /**
   * Setup method (alias for initialize)
   */
  async setup(): Promise<void> {
    return this.initialize();
  }

  /**
   * Initialize all programs and test environment
   */
  async initialize(): Promise<void> {
    console.log("\n🔧 Initializing Integration Test Environment...");

    // Airdrop SOL to test accounts
    await this.airdropAll();

    // Create test token
    await this.createTestToken();

    // Initialize all programs
    await this.initializeHub();
    await this.initializePriceOracle();
    await this.initializeCounters();

    // Seed initial data
    await this.seedPrices();
    await this.registerArbitrator();

    console.log("✅ Integration test environment ready\n");
  }

  /**
   * Airdrop SOL to all test accounts
   */
  private async airdropAll(): Promise<void> {
    console.log("  💰 Airdropping SOL to test accounts...");

    const accounts = [
      this.admin,
      this.buyer,
      this.seller,
      this.arbitrator1,
      this.priceProvider,
    ];

    for (const account of accounts) {
      await account.airdrop(this.connection, 100 * anchor.web3.LAMPORTS_PER_SOL);
    }

    console.log("  ✓ Airdropped SOL to 5 accounts");
  }

  /**
   * Create a test SPL token for trading
   */
  private async createTestToken(): Promise<void> {
    console.log("  🪙 Creating test token...");

    this.tokenMint = await createMint(
      this.connection,
      this.admin.keypair,
      this.admin.publicKey,
      this.admin.publicKey,
      this.tokenDecimals
    );

    console.log(`  ✓ Test token created: ${this.tokenMint.toBase58()}`);
  }

  /**
   * Mint test tokens to an account
   */
  async mintTokensTo(recipient: PublicKey, amount: number): Promise<PublicKey> {
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.admin.keypair,
      this.tokenMint,
      recipient
    );

    await mintTo(
      this.connection,
      this.admin.keypair,
      this.tokenMint,
      tokenAccount.address,
      this.admin.keypair,
      amount
    );

    return tokenAccount.address;
  }

  /**
   * Initialize Hub program with default configuration
   */
  private async initializeHub(): Promise<void> {
    console.log("  🏢 Initializing Hub...");

    [this.hubConfigPDA, this.hubConfigBump] = await getHubConfigPDA(
      this.hubProgram.programId
    );

    await this.hubProgram.methods
      .initialize({
        ...this.defaultFees,
        ...this.defaultLimits,
        ...this.defaultTimers,
        offerProgram: this.offerProgram.programId,
        tradeProgram: this.tradeProgram.programId,
        profileProgram: this.profileProgram.programId,
        escrowProgram: this.escrowProgram.programId,
        arbitratorProgram: this.arbitratorProgram.programId,
        priceOracleProgram: this.priceOracleProgram.programId,
        treasury: this.admin.publicKey,
        warchest: this.admin.publicKey,
      })
      .accounts({
        hubConfig: this.hubConfigPDA,
        admin: this.admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.admin.keypair])
      .rpc();

    const hubConfig = await this.hubProgram.account.hubConfig.fetch(this.hubConfigPDA);
    expect(hubConfig.admin.toBase58()).to.equal(this.admin.publicKey.toBase58());

    console.log(`  ✓ Hub initialized: ${this.hubConfigPDA.toBase58()}`);
  }

  /**
   * Initialize Price Oracle registry and providers
   */
  private async initializePriceOracle(): Promise<void> {
    console.log("  📊 Initializing Price Oracle...");

    [this.priceProviderRegistryPDA] = await getPriceProviderRegistryPDA(
      this.priceOracleProgram.programId
    );

    // Initialize registry
    await this.priceOracleProgram.methods
      .initializeRegistry({
        maxPriceStaleness: new BN(3600), // 1 hour
      })
      .accounts({
        registry: this.priceProviderRegistryPDA,
        admin: this.admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.admin.keypair])
      .rpc();

    // Register price provider
    const [priceProviderPDA] = await getPriceProviderPDA(
      this.priceProvider.publicKey,
      this.priceOracleProgram.programId
    );

    await this.priceOracleProgram.methods
      .registerProvider(this.priceProvider.publicKey)
      .accounts({
        registry: this.priceProviderRegistryPDA,
        provider: priceProviderPDA,
        admin: this.admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.admin.keypair])
      .rpc();

    console.log("  ✓ Price Oracle initialized");
  }

  /**
   * Initialize sequential ID counters for Offer and Trade programs
   */
  private async initializeCounters(): Promise<void> {
    console.log("  🔢 Initializing counters...");

    // Offer counter
    [this.offerCounterPDA] = await getOfferCounterPDA(this.offerProgram.programId);

    await this.offerProgram.methods
      .initializeCounter()
      .accounts({
        offerCounter: this.offerCounterPDA,
        admin: this.admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.admin.keypair])
      .rpc();

    // Trade counter
    [this.tradeCounterPDA] = await getTradeCounterPDA(this.tradeProgram.programId);

    await this.tradeProgram.methods
      .initializeCounter()
      .accounts({
        tradeCounter: this.tradeCounterPDA,
        admin: this.admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.admin.keypair])
      .rpc();

    console.log("  ✓ Counters initialized");
  }

  /**
   * Seed initial prices for common fiat currencies
   */
  private async seedPrices(): Promise<void> {
    console.log("  💱 Seeding initial prices...");

    const currencies = ["USD", "EUR", "GBP"];
    const prices = [
      new BN(1_000_000), // $1.00 per token
      new BN(1_100_000), // €1.10 per token
      new BN(1_200_000), // £1.20 per token
    ];

    for (let i = 0; i < currencies.length; i++) {
      const [pricePDA] = await getPricePDA(currencies[i], this.priceOracleProgram.programId);

      await this.priceOracleProgram.methods
        .initializePrice(fiatToBytes(currencies[i]), {
          initialValue: prices[i],
          decimals: 6,
          minPrice: new BN(1),
          maxPrice: new BN(1_000_000_000_000),
        })
        .accounts({
          registry: this.priceProviderRegistryPDA,
          price: pricePDA,
          admin: this.admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([this.admin.keypair])
        .rpc();
    }

    console.log(`  ✓ Seeded ${currencies.length} prices`);
  }

  /**
   * Register an arbitrator for USD disputes
   */
  private async registerArbitrator(): Promise<void> {
    console.log("  ⚖️  Registering arbitrator...");

    const [arbitratorPDA] = await getArbitratorPDA(
      this.arbitrator1.publicKey,
      "USD",
      this.arbitratorProgram.programId
    );

    await this.arbitratorProgram.methods
      .registerArbitrator(this.arbitrator1.publicKey, fiatToBytes("USD"))
      .accounts({
        arbitrator: arbitratorPDA,
        admin: this.admin.publicKey,
        hubConfig: this.hubConfigPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.admin.keypair])
      .rpc();

    console.log("  ✓ Arbitrator registered for USD");
  }

  /**
   * Create a user profile
   */
  async createProfile(user: TestUser, contactInfo: string = "encrypted_contact"): Promise<PublicKey> {
    const [profilePDA] = await getProfilePDA(user.publicKey, this.profileProgram.programId);

    await this.profileProgram.methods
      .createProfile({
        contactInfo,
        encryptionKey: "test_key",
      })
      .accounts({
        profile: profilePDA,
        owner: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user.keypair])
      .rpc();

    return profilePDA;
  }

  /**
   * Create a sell offer
   */
  async createSellOffer(
    owner: TestUser,
    params: {
      fiatCurrency: string;
      minAmount: BN;
      maxAmount: BN;
      rate: BN;
      description?: string;
    }
  ): Promise<{ offerPDA: PublicKey; offerId: BN }> {
    const counterAccount = await this.offerProgram.account.offerCounter.fetch(
      this.offerCounterPDA
    );
    const offerId = counterAccount.count;

    const [offerPDA] = await getOfferPDA(offerId, this.offerProgram.programId);

    await this.offerProgram.methods
      .createOffer({
        offerType: { sell: {} },
        fiatCurrency: fiatToBytes(params.fiatCurrency),
        tokenMint: this.tokenMint,
        minAmount: params.minAmount,
        maxAmount: params.maxAmount,
        rate: params.rate,
        description: params.description || "Test offer",
      })
      .accounts({
        offer: offerPDA,
        offerCounter: this.offerCounterPDA,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner.keypair])
      .rpc();

    return { offerPDA, offerId };
  }

  /**
   * Get token account balance
   */
  async getTokenBalance(tokenAccount: PublicKey): Promise<number> {
    const account = await getAccount(this.connection, tokenAccount);
    return Number(account.amount);
  }

  /**
   * Log test scenario header
   */
  logScenario(title: string): void {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`  ${title}`);
    console.log(`${"=".repeat(70)}\n`);
  }

  /**
   * Cleanup (optional, for test isolation)
   */
  async cleanup(): Promise<void> {
    // Solana local validator resets state between test runs
    // No explicit cleanup needed
  }
}

// Export alias for backward compatibility
export { IntegrationTestSetup as IntegrationTestEnv };
