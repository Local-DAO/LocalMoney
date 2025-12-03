/**
 * Hub Program Client
 *
 * The Hub program serves as the central configuration registry for the LocalMoney protocol.
 * It stores fee configuration, trading limits, circuit breakers, and references to other programs.
 */

import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { BaseProgram, type ProgramClientOptions, type TransactionResult } from "./base";
import { getHubConfigPDA } from "../pdas";
import { LocalMoneyError, LocalMoneyErrorCode } from "../errors";
import type { Hub as HubIDL } from "../types/generated/hub";
import type {
  HubConfigAccount,
  InitializeHubParams,
  UpdateHubConfigParams,
  SetCircuitBreakerParams,
} from "../types";

// Import the IDL
import hubIdl from "../idl/hub.json";

/**
 * Hub program client options
 */
export interface HubClientOptions extends Omit<ProgramClientOptions, "programId"> {
  programId?: PublicKey;
}

/**
 * Hub program client for managing protocol configuration
 */
export class HubClient extends BaseProgram<HubIDL> {
  private configPDA: PublicKey | null = null;
  private configBump: number | null = null;

  constructor(options: HubClientOptions & { programId: PublicKey }) {
    super(
      {
        connection: options.connection,
        wallet: options.wallet,
        programId: options.programId,
      },
      hubIdl as unknown as HubIDL
    );
  }

  /**
   * Create a new HubClient instance
   */
  static create(options: HubClientOptions & { programId: PublicKey }): HubClient {
    return new HubClient(options);
  }

  /**
   * Get the Hub config PDA
   */
  public getConfigPDA(): { pda: PublicKey; bump: number } {
    if (!this.configPDA) {
      const [pda, bump] = getHubConfigPDA(this.programId);
      this.configPDA = pda;
      this.configBump = bump;
    }
    return { pda: this.configPDA, bump: this.configBump! };
  }

  /**
   * Fetch the current Hub configuration
   *
   * @returns Hub config or null if not initialized
   */
  public async getConfig(): Promise<HubConfigAccount | null> {
    const { pda } = this.getConfigPDA();
    const config = await this.fetchAccount(pda, "hubConfig");
    if (!config) return null;

    return config as unknown as HubConfigAccount;
  }

  /**
   * Check if the Hub is initialized
   */
  public async isInitialized(): Promise<boolean> {
    const { pda } = this.getConfigPDA();
    return this.accountExists(pda);
  }

  /**
   * Initialize the Hub configuration
   *
   * @param params - Initialization parameters
   * @returns Transaction result
   */
  public async initialize(params: InitializeHubParams): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: hubConfig } = this.getConfigPDA();

    const initParams = {
      offerProgram: params.offerProgram,
      tradeProgram: params.tradeProgram,
      profileProgram: params.profileProgram,
      escrowProgram: params.escrowProgram,
      arbitratorProgram: params.arbitratorProgram,
      priceOracleProgram: params.priceOracleProgram,
      burnFeePct: params.burnFeePct,
      chainFeePct: params.chainFeePct,
      warchestFeePct: params.warchestFeePct,
      conversionFeePct: params.conversionFeePct,
      arbitratorFeePct: params.arbitratorFeePct,
      minTradeAmount: params.minTradeAmount,
      maxTradeAmount: params.maxTradeAmount,
      maxActiveOffers: params.maxActiveOffers,
      maxActiveTrades: params.maxActiveTrades,
      tradeExpirationTimer: params.tradeExpirationTimer,
      tradeDisputeTimer: params.tradeDisputeTimer,
      treasury: params.treasury,
      warchest: params.warchest,
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .initialize(initParams)
        .accounts({
          hubConfig,
          admin: this.walletPublicKey!,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Update the Hub configuration
   *
   * @param params - Update parameters (all optional)
   * @returns Transaction result
   */
  public async updateConfig(params: UpdateHubConfigParams): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: hubConfig } = this.getConfigPDA();

    // Build the update params with optional values
    const updateParams = {
      burnFeePct: params.burnFeePct ?? null,
      chainFeePct: params.chainFeePct ?? null,
      warchestFeePct: params.warchestFeePct ?? null,
      conversionFeePct: params.conversionFeePct ?? null,
      arbitratorFeePct: params.arbitratorFeePct ?? null,
      minTradeAmount: params.minTradeAmount ?? null,
      maxTradeAmount: params.maxTradeAmount ?? null,
      maxActiveOffers: params.maxActiveOffers ?? null,
      maxActiveTrades: params.maxActiveTrades ?? null,
      tradeExpirationTimer: params.tradeExpirationTimer ?? null,
      tradeDisputeTimer: params.tradeDisputeTimer ?? null,
      treasury: params.treasury ?? null,
      warchest: params.warchest ?? null,
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .updateConfig(updateParams)
        .accounts({
          hubConfig,
          admin: this.walletPublicKey!,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Set circuit breaker flags
   *
   * @param params - Circuit breaker flags to set
   * @returns Transaction result
   */
  public async setCircuitBreaker(params: SetCircuitBreakerParams): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: hubConfig } = this.getConfigPDA();

    const circuitBreakerParams = {
      globalPause: params.globalPause ?? null,
      pauseNewOffers: params.pauseNewOffers ?? null,
      pauseNewTrades: params.pauseNewTrades ?? null,
      pauseEscrowFunding: params.pauseEscrowFunding ?? null,
      pauseEscrowRelease: params.pauseEscrowRelease ?? null,
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .setCircuitBreaker(circuitBreakerParams)
        .accounts({
          hubConfig,
          admin: this.walletPublicKey!,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Transfer admin authority to a new address
   *
   * @param newAdmin - New admin public key
   * @returns Transaction result
   */
  public async transferAdmin(newAdmin: PublicKey): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: hubConfig } = this.getConfigPDA();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .transferAdmin()
        .accounts({
          hubConfig,
          currentAdmin: this.walletPublicKey!,
          newAdmin,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Check if the connected wallet is the admin
   */
  public async isAdmin(): Promise<boolean> {
    if (!this.walletPublicKey) return false;

    const config = await this.getConfig();
    if (!config) return false;

    return config.admin.equals(this.walletPublicKey);
  }

  /**
   * Get fee configuration
   *
   * @returns Fee configuration or null if not initialized
   */
  public async getFees(): Promise<{
    burnFeePct: number;
    chainFeePct: number;
    warchestFeePct: number;
    conversionFeePct: number;
    arbitratorFeePct: number;
    totalFeePct: number;
  } | null> {
    const config = await this.getConfig();
    if (!config) return null;

    const totalFeePct =
      config.burnFeePct +
      config.chainFeePct +
      config.warchestFeePct +
      config.conversionFeePct;

    return {
      burnFeePct: config.burnFeePct,
      chainFeePct: config.chainFeePct,
      warchestFeePct: config.warchestFeePct,
      conversionFeePct: config.conversionFeePct,
      arbitratorFeePct: config.arbitratorFeePct,
      totalFeePct,
    };
  }

  /**
   * Get trading limits
   *
   * @returns Trading limits or null if not initialized
   */
  public async getTradingLimits(): Promise<{
    minTradeAmount: BN;
    maxTradeAmount: BN;
    maxActiveOffers: number;
    maxActiveTrades: number;
    tradeExpirationTimer: BN;
    tradeDisputeTimer: BN;
  } | null> {
    const config = await this.getConfig();
    if (!config) return null;

    return {
      minTradeAmount: config.minTradeAmount,
      maxTradeAmount: config.maxTradeAmount,
      maxActiveOffers: config.maxActiveOffers,
      maxActiveTrades: config.maxActiveTrades,
      tradeExpirationTimer: config.tradeExpirationTimer,
      tradeDisputeTimer: config.tradeDisputeTimer,
    };
  }

  /**
   * Get circuit breaker status
   *
   * @returns Circuit breaker flags or null if not initialized
   */
  public async getCircuitBreakers(): Promise<{
    globalPause: boolean;
    pauseNewOffers: boolean;
    pauseNewTrades: boolean;
    pauseEscrowFunding: boolean;
    pauseEscrowRelease: boolean;
    isAnyPaused: boolean;
  } | null> {
    const config = await this.getConfig();
    if (!config) return null;

    return {
      globalPause: config.globalPause,
      pauseNewOffers: config.pauseNewOffers,
      pauseNewTrades: config.pauseNewTrades,
      pauseEscrowFunding: config.pauseEscrowFunding,
      pauseEscrowRelease: config.pauseEscrowRelease,
      isAnyPaused:
        config.globalPause ||
        config.pauseNewOffers ||
        config.pauseNewTrades ||
        config.pauseEscrowFunding ||
        config.pauseEscrowRelease,
    };
  }

  /**
   * Validate that the protocol is operational for a specific operation
   *
   * @param operation - Operation to check ("offers", "trades", "escrow_funding", "escrow_release")
   * @throws LocalMoneyError if operation is paused
   */
  public async requireOperational(
    operation: "offers" | "trades" | "escrow_funding" | "escrow_release"
  ): Promise<void> {
    const breakers = await this.getCircuitBreakers();
    if (!breakers) {
      throw new LocalMoneyError("Hub not initialized", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }

    if (breakers.globalPause) {
      throw new LocalMoneyError(
        "Protocol is globally paused",
        LocalMoneyErrorCode.OPERATION_PAUSED
      );
    }

    switch (operation) {
      case "offers":
        if (breakers.pauseNewOffers) {
          throw new LocalMoneyError(
            "New offers are paused",
            LocalMoneyErrorCode.OPERATION_PAUSED
          );
        }
        break;
      case "trades":
        if (breakers.pauseNewTrades) {
          throw new LocalMoneyError(
            "New trades are paused",
            LocalMoneyErrorCode.NEW_TRADES_PAUSED
          );
        }
        break;
      case "escrow_funding":
        if (breakers.pauseEscrowFunding) {
          throw new LocalMoneyError(
            "Escrow funding is paused",
            LocalMoneyErrorCode.OPERATION_PAUSED
          );
        }
        break;
      case "escrow_release":
        if (breakers.pauseEscrowRelease) {
          throw new LocalMoneyError(
            "Escrow release is paused",
            LocalMoneyErrorCode.ESCROW_RELEASE_PAUSED
          );
        }
        break;
    }
  }
}
