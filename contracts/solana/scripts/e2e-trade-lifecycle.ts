#!/usr/bin/env ts-node
/**
 * End-to-End Trade Lifecycle Test Script
 *
 * This standalone script executes a complete LocalMoney trade lifecycle on Solana local devnet,
 * validates all program interactions, measures performance metrics, and generates a detailed
 * HTML test report.
 *
 * Prerequisites:
 * - Local Solana validator running (solana-test-validator)
 * - All programs deployed to localnet
 *
 * Usage:
 *   npm run e2e:trade
 *   npm run e2e:trade -- --verbose
 *   npm run e2e:trade -- --cluster http://localhost:8899
 *   npm run e2e:trade -- --help
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
  SystemProgram,
  Transaction,
  TransactionSignature,
  Commitment,
  LAMPORTS_PER_SOL,
  VersionedTransactionResponse,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
const chalk = require("chalk");
import * as fs from "fs";
import * as path from "path";

// Import program types
import { Hub } from "../target/types/hub";
import { Profile } from "../target/types/profile";
import { Offer } from "../target/types/offer";
import { Trade } from "../target/types/trade";
import { Escrow } from "../target/types/escrow";
import { Arbitrator } from "../target/types/arbitrator";
import { PriceOracle } from "../target/types/price_oracle";

// Import utilities
import {
  TestUser,
  fiatToBytes,
  BASIS_POINTS,
} from "../tests/utils";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface StepResult {
  success: boolean;
  stepName: string;
  signature?: string;
  computeUnits?: number;
  duration: number;
  timestamp: Date;
  before?: AccountBalances;
  after?: AccountBalances;
  error?: string;
  data?: any;
}

interface AccountBalances {
  buyer?: { sol: number; tokens: number };
  seller?: { sol: number; tokens: number };
  escrow?: { tokens: number };
  treasury?: { tokens: number };
  warchest?: { tokens: number };
}

interface TestResults {
  success: boolean;
  steps: StepResult[];
  totalDuration: number;
  totalComputeUnits: number;
  environment: {
    cluster: string;
    programIds: Record<string, string>;
    tokenMint: string;
    timestamp: string;
  };
  fees: {
    burn: number;
    chain: number;
    warchest: number;
    total: number;
  };
}

interface Config {
  cluster: string;
  verbose: boolean;
  skipReport: boolean;
  commitment: Commitment;
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

let VERBOSE = false;

function setVerbose(verbose: boolean) {
  VERBOSE = verbose;
}

function logInfo(message: string) {
  console.log(chalk.blue("ℹ") + " " + message);
}

function logSuccess(message: string) {
  console.log(chalk.green("✓") + " " + message);
}

function logError(message: string) {
  console.log(chalk.red("✗") + " " + message);
}

function logWarning(message: string) {
  console.log(chalk.yellow("⚠") + " " + message);
}

function logDebug(message: string) {
  if (VERBOSE) {
    console.log(chalk.gray("  → " + message));
  }
}

function logSection(title: string) {
  console.log("\n" + chalk.bold.cyan(`${"=".repeat(60)}`));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.bold.cyan(`${"=".repeat(60)}\n`));
}

function logStep(stepNumber: number, title: string) {
  console.log("\n" + chalk.bold.magenta(`📍 Step ${stepNumber}: ${title}`));
}

// ============================================================================
// PDA DERIVATION HELPERS (copied from tests/utils)
// ============================================================================

async function getHubConfigPDA(programId: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync([Buffer.from("hub_config")], programId);
}

async function getProfilePDA(
  user: PublicKey,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync([Buffer.from("profile"), user.toBuffer()], programId);
}

async function getOfferPDA(
  offerId: BN,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("offer"), offerId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

async function getOfferCounterPDA(programId: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync([Buffer.from("offer_counter")], programId);
}

async function getTradePDA(
  tradeId: BN,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("trade"), tradeId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

async function getTradeCounterPDA(programId: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync([Buffer.from("trade_counter")], programId);
}

async function getEscrowVaultPDA(
  tradeId: BN,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_vault"), tradeId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

async function getArbitratorPDA(
  arbitrator: PublicKey,
  fiatCurrency: string,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("arbitrator"), arbitrator.toBuffer(), Buffer.from(fiatCurrency)],
    programId
  );
}

async function getPricePDA(
  fiatCurrency: string,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("price"), Buffer.from(fiatCurrency)],
    programId
  );
}

async function getPriceProviderRegistryPDA(
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("price_provider_registry")],
    programId
  );
}

async function getPriceProviderPDA(
  provider: PublicKey,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("price_provider"), provider.toBuffer()],
    programId
  );
}

// ============================================================================
// E2E TEST ENVIRONMENT
// ============================================================================

class E2ETestEnvironment {
  connection: Connection;
  provider: AnchorProvider;

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
  arbitrator: TestUser;
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

  // Treasury and warchest accounts
  treasuryAccount: PublicKey;
  warchestAccount: PublicKey;

  constructor(cluster: string, commitment: Commitment = "confirmed") {
    this.connection = new Connection(cluster, commitment);

    // Create test users
    this.admin = new TestUser();
    this.buyer = new TestUser();
    this.seller = new TestUser();
    this.arbitrator = new TestUser();
    this.priceProvider = new TestUser();
  }

  /**
   * Validate that local validator is running
   */
  async validateEnvironment(): Promise<void> {
    logInfo("Validating environment...");

    try {
      const version = await this.connection.getVersion();
      logDebug(`Solana version: ${version["solana-core"]}`);
      logSuccess("Connected to Solana cluster");
    } catch (error) {
      throw new Error(
        `Failed to connect to Solana cluster. Is the validator running?\n${error.message}`
      );
    }
  }

  /**
   * Load programs from IDL files
   */
  async loadPrograms(): Promise<void> {
    logInfo("Loading programs...");

    try {
      // Create provider with admin wallet
      const wallet = new Wallet(this.admin.keypair);
      this.provider = new AnchorProvider(this.connection, wallet, {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      });
      anchor.setProvider(this.provider);

    // Load IDL files
    const idlDir = path.join(__dirname, "../target/idl");

    const hubIdl = require(path.join(idlDir, "hub.json"));
    const profileIdl = require(path.join(idlDir, "profile.json"));
    const offerIdl = require(path.join(idlDir, "offer.json"));
    const tradeIdl = require(path.join(idlDir, "trade.json"));
    const escrowIdl = require(path.join(idlDir, "escrow.json"));
    const arbitratorIdl = require(path.join(idlDir, "arbitrator.json"));
    const priceOracleIdl = require(path.join(idlDir, "price_oracle.json"));

    // Program IDs from Anchor.toml
    const programIds = {
      hub: new PublicKey("8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH"),
      profile: new PublicKey("86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5"),
      offer: new PublicKey("CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo"),
      trade: new PublicKey("5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE"),
      escrow: new PublicKey("CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ"),
      arbitrator: new PublicKey("J5BNGJ128bxHuWemwaoGkDqy8DVSvsA7o5kpdy9eDoNe"),
      priceOracle: new PublicKey("CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw"),
    };

    // Create program instances
    // Anchor 0.31 Change: Program constructor signature is now (idl, provider, coder)
    // The programId comes from idl.address. We inject it here to preserve the script's intent.
    
    this.hubProgram = new Program(
      { ...hubIdl, address: programIds.hub } as any, 
      this.provider
    ) as Program<Hub>;

    this.profileProgram = new Program(
      { ...profileIdl, address: programIds.profile } as any,
      this.provider
    ) as Program<Profile>;

    this.offerProgram = new Program(
      { ...offerIdl, address: programIds.offer } as any,
      this.provider
    ) as Program<Offer>;

    this.tradeProgram = new Program(
      { ...tradeIdl, address: programIds.trade } as any,
      this.provider
    ) as Program<Trade>;

    this.escrowProgram = new Program(
      { ...escrowIdl, address: programIds.escrow } as any,
      this.provider
    ) as Program<Escrow>;

    this.arbitratorProgram = new Program(
      { ...arbitratorIdl, address: programIds.arbitrator } as any,
      this.provider
    ) as Program<Arbitrator>;

    this.priceOracleProgram = new Program(
      { ...priceOracleIdl, address: programIds.priceOracle } as any,
      this.provider
    ) as Program<PriceOracle>;

      logSuccess("Loaded 7 programs successfully");
      logDebug(`Hub: ${this.hubProgram.programId.toBase58()}`);
      logDebug(`Profile: ${this.profileProgram.programId.toBase58()}`);
      logDebug(`Offer: ${this.offerProgram.programId.toBase58()}`);
      logDebug(`Trade: ${this.tradeProgram.programId.toBase58()}`);
      logDebug(`Escrow: ${this.escrowProgram.programId.toBase58()}`);
      logDebug(`Arbitrator: ${this.arbitratorProgram.programId.toBase58()}`);
      logDebug(`PriceOracle: ${this.priceOracleProgram.programId.toBase58()}`);
    } catch (error) {
      logError("Failed to load programs from IDL");
      logError("");
      logError("This appears to be an Anchor 0.31 compatibility issue with manual IDL loading.");
      logError("");
      logError("WORKAROUND: Please use the existing integration tests instead:");
      logError("");
      logError("  1. Start local validator:");
      logError("     solana-test-validator");
      logError("");
      logError("  2. Run the complete trade flow integration test:");
      logError("     npm test -- --grep 'Complete Trade Flow'");
      logError("");
      logError("The integration test provides the same validation but uses");
      logError("Anchor's workspace mechanism which handles program loading correctly.");
      logError("");
      if (VERBOSE) {
        console.error("Technical details:", error.message);
        console.error("Stack:", error.stack);
      }
      throw error;
    }
  }

  /**
   * Airdrop SOL to all test accounts
   */
  async airdropAll(): Promise<void> {
    logInfo("Airdropping SOL to test accounts...");

    const accounts = [this.admin, this.buyer, this.seller, this.arbitrator, this.priceProvider];

    for (const account of accounts) {
      try {
        const signature = await this.connection.requestAirdrop(
          account.publicKey,
          100 * LAMPORTS_PER_SOL
        );
        const latestBlockhash = await this.connection.getLatestBlockhash();
        await this.connection.confirmTransaction({
          signature,
          ...latestBlockhash,
        });
        logDebug(`Airdropped 100 SOL to ${account.publicKey.toBase58()}`);
      } catch (error) {
        throw new Error(`Failed to airdrop to ${account.publicKey.toBase58()}: ${error.message}`);
      }
    }

    logSuccess("Airdropped SOL to 5 accounts");
  }

  /**
   * Create test token mint
   */
  async createTestToken(): Promise<void> {
    logInfo("Creating test token...");

    this.tokenMint = await createMint(
      this.connection,
      this.admin.keypair,
      this.admin.publicKey,
      this.admin.publicKey,
      this.tokenDecimals
    );

    logSuccess(`Test token created: ${this.tokenMint.toBase58()}`);
  }

  /**
   * Measure compute units used by a transaction
   */
  async measureComputeUnits(signature: string): Promise<number> {
    try {
      // Wait a bit for transaction to be confirmed
      await new Promise((resolve) => setTimeout(resolve, 500));

      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      if (tx && tx.meta && tx.meta.computeUnitsConsumed !== undefined) {
        return tx.meta.computeUnitsConsumed;
      }

      logDebug("Compute units not available in transaction metadata");
      return 0;
    } catch (error) {
      logDebug(`Error measuring compute units: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenAccount: PublicKey): Promise<number> {
    try {
      const account = await getAccount(this.connection, tokenAccount);
      return Number(account.amount);
    } catch (error) {
      // Account doesn't exist yet
      return 0;
    }
  }

  /**
   * Get SOL balance
   */
  async getSolBalance(publicKey: PublicKey): Promise<number> {
    return await this.connection.getBalance(publicKey);
  }

  /**
   * Execute a step and capture results
   */
  async executeStep(
    stepName: string,
    fn: () => Promise<{ signature?: string; data?: any }>
  ): Promise<StepResult> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      let computeUnits = 0;
      if (result.signature) {
        computeUnits = await this.measureComputeUnits(result.signature);
      }

      const stepResult: StepResult = {
        success: true,
        stepName,
        signature: result.signature,
        computeUnits,
        duration,
        timestamp,
        data: result.data,
      };

      logSuccess(`${stepName} (${duration}ms${computeUnits > 0 ? `, ${computeUnits.toLocaleString()} CU` : ""})`);
      if (result.signature) {
        logDebug(`Signature: ${result.signature}`);
      }

      return stepResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      logError(`${stepName} failed: ${error.message}`);

      return {
        success: false,
        stepName,
        duration,
        timestamp,
        error: error.message,
      };
    }
  }
}

// ============================================================================
// HUB AND PROGRAM INITIALIZATION
// ============================================================================

async function initializeHub(env: E2ETestEnvironment): Promise<StepResult> {
  return env.executeStep("Initialize Hub", async () => {
    const [hubConfigPDA, bump] = await getHubConfigPDA(env.hubProgram.programId);
    env.hubConfigPDA = hubConfigPDA;
    env.hubConfigBump = bump;

    // Create treasury and warchest accounts
    env.treasuryAccount = env.admin.publicKey;
    env.warchestAccount = env.admin.publicKey;

    const signature = await env.hubProgram.methods
      .initialize({
        ...env.defaultFees,
        ...env.defaultLimits,
        ...env.defaultTimers,
        offerProgram: env.offerProgram.programId,
        tradeProgram: env.tradeProgram.programId,
        profileProgram: env.profileProgram.programId,
        escrowProgram: env.escrowProgram.programId,
        arbitratorProgram: env.arbitratorProgram.programId,
        priceOracleProgram: env.priceOracleProgram.programId,
        treasury: env.treasuryAccount,
        warchest: env.warchestAccount,
      })
      .accounts({
        hubConfig: hubConfigPDA,
        admin: env.admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([env.admin.keypair])
      .rpc();

    return { signature };
  });
}

async function initializeOfferCounter(env: E2ETestEnvironment): Promise<StepResult> {
  return env.executeStep("Initialize Offer Counter", async () => {
    const [offerCounterPDA] = await getOfferCounterPDA(env.offerProgram.programId);
    env.offerCounterPDA = offerCounterPDA;

    const signature = await env.offerProgram.methods
      .initializeCounter()
      .accounts({
        counter: offerCounterPDA,
        admin: env.admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([env.admin.keypair])
      .rpc();

    return { signature };
  });
}

async function initializeTradeCounter(env: E2ETestEnvironment): Promise<StepResult> {
  return env.executeStep("Initialize Trade Counter", async () => {
    const [tradeCounterPDA] = await getTradeCounterPDA(env.tradeProgram.programId);
    env.tradeCounterPDA = tradeCounterPDA;

    const signature = await env.tradeProgram.methods
      .initializeCounter()
      .accounts({
        counter: tradeCounterPDA,
        admin: env.admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([env.admin.keypair])
      .rpc();

    return { signature };
  });
}

async function initializePriceOracle(env: E2ETestEnvironment): Promise<StepResult> {
  return env.executeStep("Initialize Price Oracle", async () => {
    const [registryPDA] = await getPriceProviderRegistryPDA(env.priceOracleProgram.programId);
    env.priceProviderRegistryPDA = registryPDA;

    const [providerPDA] = await getPriceProviderPDA(
      env.priceProvider.publicKey,
      env.priceOracleProgram.programId
    );

    // Initialize registry
    const sig1 = await env.priceOracleProgram.methods
      .initializeRegistry()
      .accounts({
        registry: registryPDA,
        authority: env.admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([env.admin.keypair])
      .rpc();

    // Register price provider
    const sig2 = await env.priceOracleProgram.methods
      .registerProvider(env.priceProvider.publicKey)
      .accounts({
        registry: registryPDA,
        provider: providerPDA,
        admin: env.admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([env.admin.keypair])
      .rpc();

    return { signature: sig2 };
  });
}

async function seedPrices(env: E2ETestEnvironment): Promise<StepResult> {
  return env.executeStep("Seed Price Feeds", async () => {
    const currencies = ["USD", "EUR", "GBP"];
    let lastSignature = "";

    for (const currency of currencies) {
      const [pricePDA] = await getPricePDA(currency, env.priceOracleProgram.programId);
      const [providerPDA] = await getPriceProviderPDA(
        env.priceProvider.publicKey,
        env.priceOracleProgram.programId
      );

      const price = new BN(1_000_000); // $1.00 with 6 decimals

      const signature = await env.priceOracleProgram.methods
        .updatePrice(fiatToBytes(currency), price)
        .accounts({
          registry: env.priceProviderRegistryPDA,
          provider: providerPDA,
          price: pricePDA,
          priceProvider: env.priceProvider.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([env.priceProvider.keypair])
        .rpc();

      lastSignature = signature;
      logDebug(`${currency} price set to $1.00`);
    }

    return { signature: lastSignature };
  });
}

async function registerArbitrator(env: E2ETestEnvironment): Promise<StepResult> {
  return env.executeStep("Register Arbitrator", async () => {
    const [arbitratorPDA] = await getArbitratorPDA(
      env.arbitrator.publicKey,
      "USD",
      env.arbitratorProgram.programId
    );

    const signature = await env.arbitratorProgram.methods
      .registerArbitrator(env.arbitrator.publicKey, fiatToBytes("USD"))
      .accounts({
        arbitrator: arbitratorPDA,
        admin: env.admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([env.admin.keypair])
      .rpc();

    return { signature };
  });
}

// ============================================================================
// TRADE LIFECYCLE FUNCTIONS
// ============================================================================

async function createProfile(
  env: E2ETestEnvironment,
  user: TestUser,
  contactInfo: string
): Promise<StepResult> {
  return env.executeStep(`Create Profile for ${user.publicKey.toBase58().slice(0, 8)}...`, async () => {
    const [profilePDA] = await getProfilePDA(user.publicKey, env.profileProgram.programId);

    const signature = await env.profileProgram.methods
      .createProfile(contactInfo)
      .accounts({
        profile: profilePDA,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user.keypair])
      .rpc();

    return { signature, data: { profilePDA } };
  });
}

async function createSellOffer(
  env: E2ETestEnvironment,
  seller: TestUser,
  params: {
    fiatCurrency: string;
    minAmount: BN;
    maxAmount: BN;
    rate: BN;
    description: string;
  }
): Promise<StepResult> {
  return env.executeStep("Create Sell Offer", async () => {
    const counterAccount = await env.offerProgram.account.offerCounter.fetch(env.offerCounterPDA);
    const offerId = counterAccount.nextId;
    const [offerPDA] = await getOfferPDA(offerId, env.offerProgram.programId);

    const [sellerProfilePDA] = await getProfilePDA(seller.publicKey, env.profileProgram.programId);

    const signature = await env.offerProgram.methods
      .createOffer(
        { sell: {} },
        fiatToBytes(params.fiatCurrency),
        env.tokenMint,
        params.minAmount,
        params.maxAmount,
        params.rate,
        params.description
      )
      .accounts({
        offer: offerPDA,
        counter: env.offerCounterPDA,
        ownerProfile: sellerProfilePDA,
        owner: seller.publicKey,
        config: env.hubConfigPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller.keypair])
      .rpc();

    return { signature, data: { offerPDA, offerId } };
  });
}

async function mintTokensToSeller(
  env: E2ETestEnvironment,
  seller: TestUser,
  amount: number
): Promise<StepResult> {
  return env.executeStep("Mint Tokens to Seller", async () => {
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      env.connection,
      env.admin.keypair,
      env.tokenMint,
      seller.publicKey
    );

    const signature = await mintTo(
      env.connection,
      env.admin.keypair,
      env.tokenMint,
      tokenAccount.address,
      env.admin.keypair,
      amount
    );

    return { signature, data: { tokenAccount: tokenAccount.address } };
  });
}

async function createTradeRequest(
  env: E2ETestEnvironment,
  buyer: TestUser,
  seller: TestUser,
  offerPDA: PublicKey,
  offerId: BN,
  tradeAmount: BN,
  fiatAmount: BN
): Promise<StepResult> {
  return env.executeStep("Create Trade Request", async () => {
    const counterAccount = await env.tradeProgram.account.tradeCounter.fetch(env.tradeCounterPDA);
    const tradeId = counterAccount.nextId;
    const [tradePDA] = await getTradePDA(tradeId, env.tradeProgram.programId);

    const [buyerProfilePDA] = await getProfilePDA(buyer.publicKey, env.profileProgram.programId);

    const signature = await env.tradeProgram.methods
      .createTrade(
        offerId,
        tradeAmount,
        fiatAmount,
        "buyer_bank_details_encrypted"
      )
      .accounts({
        trade: tradePDA,
        counter: env.tradeCounterPDA,
        offer: offerPDA,
        buyer: buyer.publicKey,
        seller: seller.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer.keypair])
      .rpc();

    return { signature, data: { tradePDA, tradeId } };
  });
}

async function acceptTrade(
  env: E2ETestEnvironment,
  seller: TestUser,
  tradePDA: PublicKey
): Promise<StepResult> {
  return env.executeStep("Accept Trade", async () => {
    const [sellerProfilePDA] = await getProfilePDA(seller.publicKey, env.profileProgram.programId);

    const signature = await env.tradeProgram.methods
      .acceptTrade("seller_bank_details_encrypted")
      .accounts({
        trade: tradePDA,
        seller: seller.publicKey,
      })
      .signers([seller.keypair])
      .rpc();

    return { signature };
  });
}

async function fundEscrow(
  env: E2ETestEnvironment,
  funder: TestUser,
  tradePDA: PublicKey,
  tradeId: BN,
  offerPDA: PublicKey
): Promise<StepResult> {
  return env.executeStep("Fund Escrow", async () => {
    // Derive escrow vault PDA (will be initialized by escrow program via CPI)
    const [escrowVaultPDA] = await getEscrowVaultPDA(tradeId, env.escrowProgram.programId);

    // Fetch the trade account to get the vault token account
    const tradeAccount = await env.tradeProgram.account.trade.fetch(tradePDA);

    // Get funder's token account
    const funderTokenAccount = await getOrCreateAssociatedTokenAccount(
      env.connection,
      funder.keypair,
      env.tokenMint,
      funder.publicKey
    );

    // Call trade program's fund_escrow which uses CPI to escrow program
    const signature = await env.tradeProgram.methods
      .fundEscrow()
      .accounts({
        trade: tradePDA,
        funder: funder.publicKey,
        funderTokenAccount: funderTokenAccount.address,
        escrowVault: escrowVaultPDA,
        vaultTokenAccount: tradeAccount.escrowVault,
        tokenMint: env.tokenMint,
        offer: offerPDA,
        hubConfig: env.hubConfigPDA,
        escrowProgram: env.escrowProgram.programId,
        tradeProgram: env.tradeProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([funder.keypair])
      .rpc();

    return { signature };
  });
}

async function confirmFiatDeposit(
  env: E2ETestEnvironment,
  buyer: TestUser,
  tradePDA: PublicKey
): Promise<StepResult> {
  return env.executeStep("Confirm Fiat Deposit", async () => {
    const signature = await env.tradeProgram.methods
      .confirmFiatDeposit()
      .accounts({
        trade: tradePDA,
        buyer: buyer.publicKey,
      })
      .signers([buyer.keypair])
      .rpc();

    return { signature };
  });
}

async function releaseEscrow(
  env: E2ETestEnvironment,
  seller: TestUser,
  buyer: TestUser,
  tradePDA: PublicKey,
  tradeId: BN
): Promise<StepResult> {
  return env.executeStep("Release Escrow", async () => {
    const [escrowVaultPDA] = await getEscrowVaultPDA(tradeId, env.escrowProgram.programId);
    const [sellerProfilePDA] = await getProfilePDA(seller.publicKey, env.profileProgram.programId);
    const [buyerProfilePDA] = await getProfilePDA(buyer.publicKey, env.profileProgram.programId);

    const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(
      env.connection,
      buyer.keypair,
      env.tokenMint,
      buyer.publicKey
    );

    const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
      env.connection,
      env.admin.keypair,
      env.tokenMint,
      env.treasuryAccount
    );

    const warchestTokenAccount = await getOrCreateAssociatedTokenAccount(
      env.connection,
      env.admin.keypair,
      env.tokenMint,
      env.warchestAccount
    );

    const signature = await env.escrowProgram.methods
      .releaseEscrow(tradeId)
      .accounts({
        vault: escrowVaultPDA,
        trade: tradePDA,
        sellerProfile: sellerProfilePDA,
        buyerProfile: buyerProfilePDA,
        config: env.hubConfigPDA,
        seller: seller.publicKey,
        buyer: buyer.publicKey,
        buyerTokenAccount: buyerTokenAccount.address,
        treasuryTokenAccount: treasuryTokenAccount.address,
        warchestTokenAccount: warchestTokenAccount.address,
        mint: env.tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([seller.keypair])
      .rpc();

    return { signature };
  });
}

// ============================================================================
// HTML REPORT GENERATION
// ============================================================================

function generateHtmlReport(results: TestResults): string {
  const timestamp = new Date().toISOString();
  const passCount = results.steps.filter((s) => s.success).length;
  const failCount = results.steps.filter((s) => !s.success).length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LocalMoney E2E Trade Lifecycle Report - ${timestamp}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      overflow: hidden;
    }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }

    h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    h2 {
      font-size: 1.8em;
      margin: 30px 0 20px 0;
      color: #667eea;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }

    .section {
      padding: 40px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }

    .summary-card {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }

    .summary-card.success {
      border-left-color: #48bb78;
    }

    .summary-card.error {
      border-left-color: #f56565;
    }

    .summary-card h3 {
      font-size: 0.9em;
      color: #666;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .summary-card .value {
      font-size: 2em;
      font-weight: bold;
      color: #333;
    }

    .timeline {
      position: relative;
      padding-left: 30px;
      margin: 20px 0;
    }

    .timeline::before {
      content: "";
      position: absolute;
      left: 9px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e2e8f0;
    }

    .timeline-item {
      position: relative;
      padding: 15px 0 15px 30px;
      margin-bottom: 10px;
    }

    .timeline-item::before {
      content: "";
      position: absolute;
      left: -26px;
      top: 20px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: white;
      border: 3px solid #48bb78;
    }

    .timeline-item.error::before {
      border-color: #f56565;
    }

    .timeline-item .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }

    .timeline-item .step-name {
      font-weight: 600;
      font-size: 1.1em;
    }

    .timeline-item .step-meta {
      font-size: 0.9em;
      color: #666;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
      margin-right: 10px;
    }

    .badge.success {
      background: #c6f6d5;
      color: #22543d;
    }

    .badge.error {
      background: #fed7d7;
      color: #742a2a;
    }

    .code {
      font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
      background: #2d3748;
      color: #e2e8f0;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 0.9em;
      margin: 10px 0;
    }

    .code small {
      color: #a0aec0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }

    th {
      background: #667eea;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
    }

    tr:hover {
      background: #f7fafc;
    }

    .chart-container {
      position: relative;
      height: 300px;
      margin: 20px 0;
    }

    .error-section {
      background: #fff5f5;
      border: 1px solid #fc8181;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }

    .error-section h3 {
      color: #c53030;
      margin-bottom: 10px;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .container {
        box-shadow: none;
      }

      .timeline::before {
        background: #999;
      }
    }

    @media (max-width: 768px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }

      h1 {
        font-size: 1.8em;
      }

      .section {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 LocalMoney E2E Trade Lifecycle Report</h1>
      <p>Solana LocalMoney Protocol - Complete Trade Flow Validation</p>
      <p style="margin-top: 10px; opacity: 0.9;">Generated: ${new Date().toLocaleString()}</p>
    </header>

    <!-- Executive Summary -->
    <div class="section">
      <h2>📊 Executive Summary</h2>
      <div class="summary-grid">
        <div class="summary-card ${results.success ? "success" : "error"}">
          <h3>Overall Status</h3>
          <div class="value">${results.success ? "✓ PASS" : "✗ FAIL"}</div>
        </div>
        <div class="summary-card">
          <h3>Total Duration</h3>
          <div class="value">${(results.totalDuration / 1000).toFixed(2)}s</div>
        </div>
        <div class="summary-card">
          <h3>Compute Units</h3>
          <div class="value">${results.totalComputeUnits.toLocaleString()}</div>
        </div>
        <div class="summary-card">
          <h3>Total Fees</h3>
          <div class="value">${(results.fees.total / 1_000_000).toFixed(2)} tokens</div>
        </div>
        <div class="summary-card success">
          <h3>Steps Passed</h3>
          <div class="value">${passCount}</div>
        </div>
        <div class="summary-card ${failCount > 0 ? "error" : ""}">
          <h3>Steps Failed</h3>
          <div class="value">${failCount}</div>
        </div>
      </div>
    </div>

    <!-- Environment Info -->
    <div class="section">
      <h2>🔧 Environment</h2>
      <table>
        <tr>
          <th>Component</th>
          <th>Address</th>
        </tr>
        <tr>
          <td>Cluster</td>
          <td><code>${results.environment.cluster}</code></td>
        </tr>
        <tr>
          <td>Token Mint</td>
          <td><code>${results.environment.tokenMint}</code></td>
        </tr>
        <tr>
          <td>Hub Program</td>
          <td><code>${results.environment.programIds.hub}</code></td>
        </tr>
        <tr>
          <td>Profile Program</td>
          <td><code>${results.environment.programIds.profile}</code></td>
        </tr>
        <tr>
          <td>Offer Program</td>
          <td><code>${results.environment.programIds.offer}</code></td>
        </tr>
        <tr>
          <td>Trade Program</td>
          <td><code>${results.environment.programIds.trade}</code></td>
        </tr>
        <tr>
          <td>Escrow Program</td>
          <td><code>${results.environment.programIds.escrow}</code></td>
        </tr>
        <tr>
          <td>Arbitrator Program</td>
          <td><code>${results.environment.programIds.arbitrator}</code></td>
        </tr>
        <tr>
          <td>Price Oracle Program</td>
          <td><code>${results.environment.programIds.priceOracle}</code></td>
        </tr>
      </table>
    </div>

    <!-- Timeline -->
    <div class="section">
      <h2>📅 Test Execution Timeline</h2>
      <div class="timeline">
        ${results.steps
          .map(
            (step, idx) => `
          <div class="timeline-item ${step.success ? "" : "error"}">
            <div class="step-header">
              <div class="step-name">
                <span class="badge ${step.success ? "success" : "error"}">${step.success ? "✓" : "✗"}</span>
                ${step.stepName}
              </div>
              <div class="step-meta">
                ${step.duration}ms
                ${step.computeUnits ? `• ${step.computeUnits.toLocaleString()} CU` : ""}
              </div>
            </div>
            ${
              step.signature
                ? `<div class="code"><small>Signature:</small> ${step.signature}</div>`
                : ""
            }
            ${
              step.error
                ? `<div class="error-section">
                  <h3>Error</h3>
                  <p>${step.error}</p>
                </div>`
                : ""
            }
          </div>
        `
          )
          .join("")}
      </div>
    </div>

    <!-- Fee Distribution -->
    <div class="section">
      <h2>💰 Fee Distribution</h2>
      <table>
        <tr>
          <th>Fee Type</th>
          <th>Percentage</th>
          <th>Amount (tokens)</th>
        </tr>
        <tr>
          <td>Burn Fee</td>
          <td>0.5%</td>
          <td>${(results.fees.burn / 1_000_000).toFixed(6)}</td>
        </tr>
        <tr>
          <td>Chain Fee</td>
          <td>1.0%</td>
          <td>${(results.fees.chain / 1_000_000).toFixed(6)}</td>
        </tr>
        <tr>
          <td>Warchest Fee</td>
          <td>0.5%</td>
          <td>${(results.fees.warchest / 1_000_000).toFixed(6)}</td>
        </tr>
        <tr style="font-weight: bold; background: #f7fafc;">
          <td>Total Fees</td>
          <td>2.0%</td>
          <td>${(results.fees.total / 1_000_000).toFixed(6)}</td>
        </tr>
      </table>
      <div class="chart-container">
        <canvas id="feeChart"></canvas>
      </div>
    </div>

    <!-- Performance Metrics -->
    <div class="section">
      <h2>⚡ Performance Metrics</h2>
      <div class="chart-container">
        <canvas id="performanceChart"></canvas>
      </div>
      <table>
        <tr>
          <th>Step</th>
          <th>Compute Units</th>
          <th>Duration (ms)</th>
        </tr>
        ${results.steps
          .filter((s) => s.computeUnits && s.computeUnits > 0)
          .map(
            (step) => `
          <tr>
            <td>${step.stepName}</td>
            <td>${step.computeUnits?.toLocaleString() || "N/A"}</td>
            <td>${step.duration}</td>
          </tr>
        `
          )
          .join("")}
        <tr style="font-weight: bold; background: #f7fafc;">
          <td>Total</td>
          <td>${results.totalComputeUnits.toLocaleString()}</td>
          <td>${results.totalDuration.toLocaleString()}</td>
        </tr>
      </table>
    </div>
  </div>

  <script>
    // Fee Distribution Pie Chart
    const feeCtx = document.getElementById('feeChart').getContext('2d');
    new Chart(feeCtx, {
      type: 'pie',
      data: {
        labels: ['Burn Fee (0.5%)', 'Chain Fee (1.0%)', 'Warchest Fee (0.5%)'],
        datasets: [{
          data: [${results.fees.burn}, ${results.fees.chain}, ${results.fees.warchest}],
          backgroundColor: [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          },
          title: {
            display: true,
            text: 'Fee Distribution'
          }
        }
      }
    });

    // Performance Bar Chart
    const perfCtx = document.getElementById('performanceChart').getContext('2d');
    new Chart(perfCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(results.steps.filter((s) => s.computeUnits && s.computeUnits > 0).map((s) => s.stepName))},
        datasets: [{
          label: 'Compute Units',
          data: ${JSON.stringify(results.steps.filter((s) => s.computeUnits && s.computeUnits > 0).map((s) => s.computeUnits))},
          backgroundColor: 'rgba(102, 126, 234, 0.8)',
          borderColor: 'rgba(102, 126, 234, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Compute Units'
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Compute Units by Instruction'
          }
        }
      }
    });
  </script>
</body>
</html>`;

  return html;
}

async function saveReport(results: TestResults): Promise<string> {
  const timestamp = Date.now();
  const reportDir = path.join(__dirname, "../reports");
  const reportPath = path.join(reportDir, `trade-lifecycle-${timestamp}.html`);
  const latestPath = path.join(reportDir, "trade-lifecycle-latest.html");

  // Ensure reports directory exists
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Generate and save report
  const html = generateHtmlReport(results);
  fs.writeFileSync(reportPath, html);

  // Create/update symlink to latest
  try {
    if (fs.existsSync(latestPath)) {
      fs.unlinkSync(latestPath);
    }
    fs.symlinkSync(path.basename(reportPath), latestPath);
  } catch (error) {
    // Symlink failed (probably Windows), just copy instead
    fs.copyFileSync(reportPath, latestPath);
  }

  return reportPath;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  logSection("LocalMoney E2E Trade Lifecycle Test");

  // Parse CLI arguments
  const args = process.argv.slice(2);
  const config: Config = {
    cluster: "http://localhost:8899",
    verbose: false,
    skipReport: false,
    commitment: "confirmed",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Usage: npm run e2e:trade [options]

Options:
  --cluster <url>    Solana cluster URL (default: http://localhost:8899)
  --verbose          Enable verbose logging
  --skip-report      Skip HTML report generation
  --help, -h         Show this help message

Examples:
  npm run e2e:trade
  npm run e2e:trade -- --verbose
  npm run e2e:trade -- --cluster http://localhost:8899
      `);
      process.exit(0);
    } else if (args[i] === "--cluster" && i + 1 < args.length) {
      config.cluster = args[++i];
    } else if (args[i] === "--verbose") {
      config.verbose = true;
    } else if (args[i] === "--skip-report") {
      config.skipReport = true;
    }
  }

  setVerbose(config.verbose);

  const startTime = Date.now();
  const steps: StepResult[] = [];
  let success = true;

  try {
    // Initialize environment
    const env = new E2ETestEnvironment(config.cluster, config.commitment);

    // Validate environment
    await env.validateEnvironment();

    // Load programs
    await env.loadPrograms();

    // Airdrop SOL
    await env.airdropAll();

    // Create test token
    await env.createTestToken();

    // ========================================================================
    // PHASE 1: Initialize Hub and Programs
    // ========================================================================
    logSection("Phase 1: Initialize Hub and Programs");

    steps.push(await initializeHub(env));
    steps.push(await initializeOfferCounter(env));
    steps.push(await initializeTradeCounter(env));
    steps.push(await initializePriceOracle(env));
    steps.push(await seedPrices(env));
    steps.push(await registerArbitrator(env));

    // Check for failures
    if (steps.some((s) => !s.success)) {
      throw new Error("Initialization failed");
    }

    // ========================================================================
    // PHASE 2: Execute Trade Lifecycle
    // ========================================================================
    logSection("Phase 2: Execute Trade Lifecycle");

    // Step 1: Create profiles
    logStep(1, "Create user profiles");
    const sellerProfileResult = await createProfile(
      env,
      env.seller,
      "seller@example.com_encrypted"
    );
    steps.push(sellerProfileResult);

    const buyerProfileResult = await createProfile(env, env.buyer, "buyer@example.com_encrypted");
    steps.push(buyerProfileResult);

    // Step 2: Create sell offer
    logStep(2, "Create sell offer");
    const offerParams = {
      fiatCurrency: "USD",
      minAmount: new BN(1_000_000), // 1 token
      maxAmount: new BN(100_000_000), // 100 tokens
      rate: new BN(1_000_000), // $1.00 per token
      description: "Selling USDC for USD via bank transfer",
    };
    const offerResult = await createSellOffer(env, env.seller, offerParams);
    steps.push(offerResult);
    const { offerPDA, offerId } = offerResult.data;

    // Step 3: Mint tokens to seller
    logStep(3, "Mint tokens to seller");
    const mintResult = await mintTokensToSeller(env, env.seller, 100_000_000);
    steps.push(mintResult);

    // Step 4: Create trade request
    logStep(4, "Create trade request");
    const tradeAmount = new BN(10_000_000); // 10 tokens
    const fiatAmount = new BN(10_00); // $10.00 in cents
    const tradeResult = await createTradeRequest(
      env,
      env.buyer,
      env.seller,
      offerPDA,
      offerId,
      tradeAmount,
      fiatAmount
    );
    steps.push(tradeResult);
    const { tradePDA, tradeId } = tradeResult.data;

    // Step 5: Accept trade
    logStep(5, "Seller accepts trade");
    const acceptResult = await acceptTrade(env, env.seller, tradePDA);
    steps.push(acceptResult);

    // Step 6: Fund escrow (via Trade program CPI to Escrow program)
    logStep(6, "Seller funds escrow");
    const fundResult = await fundEscrow(env, env.seller, tradePDA, tradeId, offerPDA);
    steps.push(fundResult);

    // Step 7: Confirm fiat deposit
    logStep(7, "Buyer confirms fiat deposit");
    const confirmResult = await confirmFiatDeposit(env, env.buyer, tradePDA);
    steps.push(confirmResult);

    // Step 8: Release escrow
    logStep(8, "Release escrow with fee distribution");
    const releaseResult = await releaseEscrow(env, env.seller, env.buyer, tradePDA, tradeId);
    steps.push(releaseResult);

    // Check for failures
    if (steps.some((s) => !s.success)) {
      throw new Error("Trade lifecycle execution failed");
    }

    // ========================================================================
    // Calculate fees
    // ========================================================================
    const tradeAmountNum = tradeAmount.toNumber();
    const burnFee = Math.floor((tradeAmountNum * env.defaultFees.burnFeePct) / BASIS_POINTS);
    const chainFee = Math.floor((tradeAmountNum * env.defaultFees.chainFeePct) / BASIS_POINTS);
    const warchestFee = Math.floor(
      (tradeAmountNum * env.defaultFees.warchestFeePct) / BASIS_POINTS
    );
    const totalFees = burnFee + chainFee + warchestFee;

    // ========================================================================
    // Generate results
    // ========================================================================
    const totalDuration = Date.now() - startTime;
    const totalComputeUnits = steps.reduce((sum, step) => sum + (step.computeUnits || 0), 0);

    const results: TestResults = {
      success: true,
      steps,
      totalDuration,
      totalComputeUnits,
      environment: {
        cluster: config.cluster,
        programIds: {
          hub: env.hubProgram.programId.toBase58(),
          profile: env.profileProgram.programId.toBase58(),
          offer: env.offerProgram.programId.toBase58(),
          trade: env.tradeProgram.programId.toBase58(),
          escrow: env.escrowProgram.programId.toBase58(),
          arbitrator: env.arbitratorProgram.programId.toBase58(),
          priceOracle: env.priceOracleProgram.programId.toBase58(),
        },
        tokenMint: env.tokenMint.toBase58(),
        timestamp: new Date().toISOString(),
      },
      fees: {
        burn: burnFee,
        chain: chainFee,
        warchest: warchestFee,
        total: totalFees,
      },
    };

    // ========================================================================
    // Generate HTML report
    // ========================================================================
    logSection("Report Generation");
    if (!config.skipReport) {
      const reportPath = await saveReport(results);
      logSuccess(`HTML report generated: ${reportPath}`);
      logInfo(`View latest report: reports/trade-lifecycle-latest.html`);
    } else {
      logInfo("Skipped report generation (--skip-report flag)");
    }

    // ========================================================================
    // Summary
    // ========================================================================
    logSection("Test Summary");
    logSuccess(`All ${steps.length} steps completed successfully`);
    logInfo(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
    logInfo(`Total compute units: ${totalComputeUnits.toLocaleString()}`);
    logInfo(`Total fees: ${(totalFees / 1_000_000).toFixed(6)} tokens`);
    logInfo(
      `Fee breakdown: burn=${(burnFee / 1_000_000).toFixed(6)}, chain=${(chainFee / 1_000_000).toFixed(6)}, warchest=${(warchestFee / 1_000_000).toFixed(6)}`
    );

    process.exit(0);
  } catch (error) {
    success = false;
    logSection("Test Failed");
    logError(`Error: ${error.message}`);
    if (config.verbose && error.stack) {
      console.log(chalk.gray(error.stack));
    }

    // Generate failure report
    if (!config.skipReport && steps.length > 0) {
      const totalDuration = Date.now() - startTime;
      const totalComputeUnits = steps.reduce((sum, step) => sum + (step.computeUnits || 0), 0);

      const results: TestResults = {
        success: false,
        steps,
        totalDuration,
        totalComputeUnits,
        environment: {
          cluster: config.cluster,
          programIds: {},
          tokenMint: "",
          timestamp: new Date().toISOString(),
        },
        fees: {
          burn: 0,
          chain: 0,
          warchest: 0,
          total: 0,
        },
      };

      try {
        const reportPath = await saveReport(results);
        logInfo(`Failure report generated: ${reportPath}`);
      } catch (reportError) {
        logWarning(`Failed to generate report: ${reportError.message}`);
      }
    }

    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
