/**
 * LocalMoneyClient - Main SDK Entry Point
 *
 * This is the primary interface for interacting with the LocalMoney Solana Protocol.
 * It provides unified access to all program clients and high-level workflow methods.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { NetworkConfig } from "./config";
import { createConnection, validateNetworkConfig, ProgramIdHelper } from "./config";
import { HubClient } from "./programs/hub";
import { ProfileClient } from "./programs/profile";
import { OfferClient } from "./programs/offer";
import { TradeClient } from "./programs/trade";
import { ArbitratorClient } from "./programs/arbitrator";
import { PriceOracleClient } from "./programs/priceOracle";
import type { WalletAdapter } from "./programs/base";
import { LocalMoneyError, LocalMoneyErrorCode } from "./errors";
import { OfferType, TradeState } from "./types/enums";
import type { OfferAccount, TradeAccount, UserProfileAccount } from "./types";

/**
 * Options for creating a LocalMoneyClient
 */
export interface LocalMoneyClientOptions {
  /** Network configuration */
  config: NetworkConfig;
  /** Wallet adapter (optional for read-only mode) */
  wallet?: WalletAdapter | null;
  /** Custom connection (optional, will be created from config if not provided) */
  connection?: Connection;
}

/**
 * Trade workflow state summary
 */
export interface TradeWorkflowState {
  trade: TradeAccount;
  canAccept: boolean;
  canFundEscrow: boolean;
  canConfirmFiat: boolean;
  canRelease: boolean;
  canDispute: boolean;
  canCancel: boolean;
  canRefund: boolean;
  isExpired: boolean;
  isBuyer: boolean;
  isSeller: boolean;
  nextAction: string;
}

/**
 * LocalMoneyClient - Unified SDK for the LocalMoney Solana Protocol
 *
 * @example
 * ```typescript
 * import { LocalMoneyClient, DEVNET_CONFIG } from "@localmoney/sdk";
 *
 * // Create client (read-only)
 * const client = LocalMoneyClient.create({ config: DEVNET_CONFIG });
 *
 * // Connect wallet for transactions
 * client.setWallet(walletAdapter);
 *
 * // Access program clients
 * const offers = await client.offer.getActiveOffers();
 *
 * // High-level workflow methods
 * const { tradeId } = await client.startTrade({
 *   offerId: new BN(1),
 *   amount: new BN(1000000),
 *   fiatAmount: new BN(10000),
 *   buyerContact: "encrypted_contact",
 *   tokenMint: mintPubkey,
 * });
 * ```
 */
export class LocalMoneyClient {
  /** Solana connection */
  public readonly connection: Connection;

  /** Network configuration */
  public readonly config: NetworkConfig;

  /** Program ID helper */
  public readonly programIds: ProgramIdHelper;

  /** Hub program client */
  public readonly hub: HubClient;

  /** Profile program client */
  public readonly profile: ProfileClient;

  /** Offer program client */
  public readonly offer: OfferClient;

  /** Trade program client */
  public readonly trade: TradeClient;

  /** Arbitrator program client */
  public readonly arbitrator: ArbitratorClient;

  /** Price Oracle program client */
  public readonly priceOracle: PriceOracleClient;

  private wallet: WalletAdapter | null = null;

  constructor(options: LocalMoneyClientOptions) {
    // Validate config
    validateNetworkConfig(options.config);

    this.config = options.config;
    this.programIds = new ProgramIdHelper(options.config.programIds);

    // Create or use provided connection
    this.connection =
      options.connection || createConnection(options.config);

    // Initialize all program clients
    this.hub = new HubClient({
      connection: this.connection,
      wallet: options.wallet,
      programId: this.programIds.hub,
    });

    this.profile = new ProfileClient({
      connection: this.connection,
      wallet: options.wallet,
      programId: this.programIds.profile,
    });

    this.offer = new OfferClient({
      connection: this.connection,
      wallet: options.wallet,
      programId: this.programIds.offer,
      profileProgramId: this.programIds.profile,
      hubProgramId: this.programIds.hub,
    });

    this.trade = new TradeClient({
      connection: this.connection,
      wallet: options.wallet,
      programId: this.programIds.trade,
      profileProgramId: this.programIds.profile,
      hubProgramId: this.programIds.hub,
      offerProgramId: this.programIds.offer,
      escrowProgramId: this.programIds.escrow,
      arbitratorProgramId: this.programIds.arbitrator,
    });

    this.arbitrator = new ArbitratorClient({
      connection: this.connection,
      wallet: options.wallet,
      programId: this.programIds.arbitrator,
      hubProgramId: this.programIds.hub,
    });

    this.priceOracle = new PriceOracleClient({
      connection: this.connection,
      wallet: options.wallet,
      programId: this.programIds.priceOracle,
    });

    if (options.wallet) {
      this.wallet = options.wallet;
    }
  }

  /**
   * Create a new LocalMoneyClient instance
   */
  static create(options: LocalMoneyClientOptions): LocalMoneyClient {
    return new LocalMoneyClient(options);
  }

  /**
   * Set the wallet for all program clients
   *
   * @param wallet - Wallet adapter
   */
  public setWallet(wallet: WalletAdapter): void {
    this.wallet = wallet;
    this.hub.setWallet(wallet);
    this.profile.setWallet(wallet);
    this.offer.setWallet(wallet);
    this.trade.setWallet(wallet);
    this.arbitrator.setWallet(wallet);
    this.priceOracle.setWallet(wallet);
  }

  /**
   * Clear the wallet (switch to read-only mode)
   */
  public clearWallet(): void {
    this.wallet = null;
    this.hub.clearWallet();
    this.profile.clearWallet();
    this.offer.clearWallet();
    this.trade.clearWallet();
    this.arbitrator.clearWallet();
    this.priceOracle.clearWallet();
  }

  /**
   * Check if a wallet is connected
   */
  public get isConnected(): boolean {
    return this.wallet !== null && this.wallet.publicKey !== null;
  }

  /**
   * Get the connected wallet's public key
   */
  public get walletPublicKey(): PublicKey | null {
    return this.wallet?.publicKey ?? null;
  }

  // ============================================================
  // High-Level Workflow Methods
  // ============================================================

  /**
   * Ensure user has a profile, create if not
   *
   * @param contactInfo - Default contact info if creating
   * @param encryptionKey - Default encryption key if creating
   * @returns Profile account
   */
  public async ensureProfile(
    contactInfo: string = "",
    encryptionKey: string = ""
  ): Promise<UserProfileAccount> {
    if (!this.walletPublicKey) {
      throw new LocalMoneyError("Wallet not connected", LocalMoneyErrorCode.WALLET_NOT_CONNECTED);
    }

    let myProfile = await this.profile.getMyProfile();
    if (!myProfile) {
      await this.profile.createProfile({ contactInfo, encryptionKey });
      myProfile = await this.profile.getMyProfile();
      if (!myProfile) {
        throw new LocalMoneyError("Failed to create profile", LocalMoneyErrorCode.UNKNOWN_ERROR);
      }
    }
    return myProfile;
  }

  /**
   * Create a new offer with all validation
   *
   * @returns Offer ID and transaction result
   */
  public async createNewOffer(params: {
    offerType: OfferType;
    fiatCurrency: string;
    tokenMint: PublicKey;
    minAmount: BN;
    maxAmount: BN;
    rate: BN;
    description: string;
  }): Promise<{ offerId: BN; signature: string }> {
    // Ensure profile exists
    await this.ensureProfile();

    // Check hub operational
    await this.hub.requireOperational("offers");

    // Check limits
    const hubConfig = await this.hub.getConfig();
    if (!hubConfig) {
      throw new LocalMoneyError("Hub not initialized", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }

    const canCreate = await this.profile.canCreateOffer(
      this.walletPublicKey!,
      hubConfig.maxActiveOffers
    );
    if (!canCreate) {
      throw new LocalMoneyError(
        "Maximum active offers reached",
        LocalMoneyErrorCode.MAX_ACTIVE_OFFERS_REACHED
      );
    }

    // Create offer
    const result = await this.offer.createOffer(params);
    return { offerId: result.offerId, signature: result.signature };
  }

  /**
   * Start a new trade against an offer
   *
   * @returns Trade ID and transaction result
   */
  public async startTrade(params: {
    offerId: BN;
    amount: BN;
    fiatAmount: BN;
    buyerContact: string;
    tokenMint: PublicKey;
  }): Promise<{ tradeId: BN; signature: string }> {
    // Ensure profile exists
    await this.ensureProfile();

    // Check hub operational
    await this.hub.requireOperational("trades");

    // Check limits
    const hubConfig = await this.hub.getConfig();
    if (!hubConfig) {
      throw new LocalMoneyError("Hub not initialized", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }

    const canCreate = await this.profile.canCreateTrade(
      this.walletPublicKey!,
      hubConfig.maxActiveTrades
    );
    if (!canCreate) {
      throw new LocalMoneyError(
        "Maximum active trades reached",
        LocalMoneyErrorCode.MAX_ACTIVE_TRADES_REACHED
      );
    }

    // Create trade
    const result = await this.trade.createTrade(params);
    return { tradeId: result.tradeId, signature: result.signature };
  }

  /**
   * Get trade workflow state and available actions
   *
   * @param tradeId - Trade ID
   * @returns Workflow state with available actions
   */
  public async getTradeWorkflow(tradeId: BN): Promise<TradeWorkflowState> {
    const tradeAccount = await this.trade.getTrade(tradeId);
    if (!tradeAccount) {
      throw new LocalMoneyError("Trade not found", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }

    const isBuyer = this.walletPublicKey
      ? (tradeAccount.buyer as PublicKey).equals(this.walletPublicKey)
      : false;
    const isSeller = this.walletPublicKey
      ? (tradeAccount.seller as PublicKey).equals(this.walletPublicKey)
      : false;
    const isExpired = this.trade.isTradeExpired(tradeAccount);

    // Determine available actions based on state
    const state = tradeAccount.state;
    const canAccept = isSeller && state === TradeState.RequestCreated && !isExpired;
    const canFundEscrow = state === TradeState.RequestAccepted && !isExpired;
    const canConfirmFiat = isBuyer && state === TradeState.EscrowFunded;
    const canRelease = isSeller && state === TradeState.FiatDeposited;
    const canDispute =
      (isBuyer || isSeller) &&
      (state === TradeState.EscrowFunded || state === TradeState.FiatDeposited);
    const canCancel =
      (isBuyer || isSeller) &&
      (state === TradeState.RequestCreated || state === TradeState.RequestAccepted);
    const canRefund =
      (isBuyer || isSeller) && state === TradeState.EscrowFunded;

    // Determine next action message
    let nextAction = "";
    switch (state) {
      case TradeState.RequestCreated:
        nextAction = isSeller
          ? "Accept the trade request"
          : "Waiting for seller to accept";
        break;
      case TradeState.RequestAccepted:
        nextAction = "Fund the escrow";
        break;
      case TradeState.EscrowFunded:
        nextAction = isBuyer
          ? "Confirm fiat payment"
          : "Waiting for buyer to confirm fiat";
        break;
      case TradeState.FiatDeposited:
        nextAction = isSeller
          ? "Release escrow to complete trade"
          : "Waiting for seller to release";
        break;
      case TradeState.Disputed:
        nextAction = "Waiting for arbitrator resolution";
        break;
      case TradeState.DisputeResolved:
        nextAction = "Release escrow per resolution";
        break;
      case TradeState.EscrowReleased:
        nextAction = "Trade complete";
        break;
      case TradeState.RequestCanceled:
        nextAction = "Trade was canceled";
        break;
      case TradeState.RequestExpired:
        nextAction = "Trade expired";
        break;
      case TradeState.EscrowRefunded:
        nextAction = "Trade was refunded";
        break;
    }

    if (isExpired && !canRelease) {
      nextAction = "Trade has expired";
    }

    return {
      trade: tradeAccount,
      canAccept,
      canFundEscrow,
      canConfirmFiat,
      canRelease,
      canDispute,
      canCancel,
      canRefund,
      isExpired,
      isBuyer,
      isSeller,
      nextAction,
    };
  }

  /**
   * Get user's complete trading activity
   *
   * @param user - User's public key (defaults to connected wallet)
   */
  public async getUserActivity(user?: PublicKey): Promise<{
    profile: UserProfileAccount | null;
    activeOffers: Array<{ publicKey: PublicKey; account: OfferAccount }>;
    activeTrades: Array<{ publicKey: PublicKey; account: TradeAccount }>;
    completedTradesCount: number;
    totalVolumeUsd: number;
  }> {
    const targetUser = user || this.walletPublicKey;
    if (!targetUser) {
      throw new LocalMoneyError("No user specified", LocalMoneyErrorCode.INVALID_PARAMETER);
    }

    const [profile, offers, buyerTrades, sellerTrades] = await Promise.all([
      this.profile.getProfile(targetUser),
      this.offer.getOffersByOwner(targetUser),
      this.trade.getTradesByBuyer(targetUser),
      this.trade.getTradesBySeller(targetUser),
    ]);

    // Combine and deduplicate trades
    const allTrades = [...buyerTrades];
    for (const trade of sellerTrades) {
      if (!allTrades.some((t) => t.publicKey.equals(trade.publicKey))) {
        allTrades.push(trade);
      }
    }

    // Filter active
    const activeTrades = allTrades.filter(
      (t) =>
        ![
          TradeState.EscrowReleased,
          TradeState.RequestCanceled,
          TradeState.RequestExpired,
          TradeState.EscrowRefunded,
        ].includes(t.account.state)
    );

    const activeOffers = offers.filter((o) => o.account.state === "active");

    const completedTradesCount = profile
      ? Number(profile.completedTrades)
      : 0;
    const totalVolumeUsd = profile
      ? (Number(profile.totalBuyVolume) + Number(profile.totalSellVolume)) / 100
      : 0;

    return {
      profile,
      activeOffers,
      activeTrades,
      completedTradesCount,
      totalVolumeUsd,
    };
  }

  /**
   * Search marketplace offers with filters
   */
  public async searchMarketplace(filters: {
    offerType?: OfferType;
    fiatCurrency?: string;
    tokenMint?: PublicKey;
    minAmount?: BN;
    maxAmount?: BN;
  }): Promise<Array<{ publicKey: PublicKey; account: OfferAccount }>> {
    return this.offer.searchOffers(filters);
  }

  /**
   * Get protocol health status
   */
  public async getProtocolStatus(): Promise<{
    isInitialized: boolean;
    isOperational: boolean;
    circuitBreakers: {
      globalPause: boolean;
      pauseNewOffers: boolean;
      pauseNewTrades: boolean;
      pauseEscrowFunding: boolean;
      pauseEscrowRelease: boolean;
    } | null;
    fees: {
      totalFeePct: number;
      burnFeePct: number;
      chainFeePct: number;
      warchestFeePct: number;
    } | null;
  }> {
    const isInitialized = await this.hub.isInitialized();
    if (!isInitialized) {
      return {
        isInitialized: false,
        isOperational: false,
        circuitBreakers: null,
        fees: null,
      };
    }

    const circuitBreakers = await this.hub.getCircuitBreakers();
    const feesData = await this.hub.getFees();

    const isOperational = circuitBreakers
      ? !circuitBreakers.isAnyPaused
      : false;

    const fees = feesData
      ? {
          totalFeePct: feesData.totalFeePct / 100, // Convert basis points to percentage
          burnFeePct: feesData.burnFeePct / 100,
          chainFeePct: feesData.chainFeePct / 100,
          warchestFeePct: feesData.warchestFeePct / 100,
        }
      : null;

    return {
      isInitialized,
      isOperational,
      circuitBreakers: circuitBreakers
        ? {
            globalPause: circuitBreakers.globalPause,
            pauseNewOffers: circuitBreakers.pauseNewOffers,
            pauseNewTrades: circuitBreakers.pauseNewTrades,
            pauseEscrowFunding: circuitBreakers.pauseEscrowFunding,
            pauseEscrowRelease: circuitBreakers.pauseEscrowRelease,
          }
        : null,
      fees,
    };
  }
}

// Export for convenience
export { LocalMoneyClient as default };
