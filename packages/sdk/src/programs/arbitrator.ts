/**
 * Arbitrator Program Client
 *
 * The Arbitrator program manages dispute resolution including
 * arbitrator registration, evidence submission, and dispute resolution.
 */

import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { BaseProgram, type ProgramClientOptions, type TransactionResult } from "./base";
import {
  getArbitratorPDA,
  getDisputePDA,
  getHubConfigPDA,
  fiatToBytes,
  bytesToFiat,
} from "../pdas";
import { LocalMoneyError, LocalMoneyErrorCode } from "../errors";
import type { Arbitrator as ArbitratorIDL } from "../types/generated/arbitrator";
import type {
  ArbitratorAccount,
  DisputeAccount,
  SubmitEvidenceParams,
  ResolveDisputeParams,
} from "../types";
import { DisputeResolution } from "../types";

// Import the IDL
import arbitratorIdl from "../idl/arbitrator.json";

/**
 * Arbitrator program client options
 */
export interface ArbitratorClientOptions extends Omit<ProgramClientOptions, "programId"> {
  programId?: PublicKey;
  hubProgramId: PublicKey;
}

/**
 * Arbitrator program client for dispute resolution
 */
export class ArbitratorClient extends BaseProgram<ArbitratorIDL> {
  private readonly hubProgramId: PublicKey;

  constructor(options: ArbitratorClientOptions & { programId: PublicKey }) {
    super(
      {
        connection: options.connection,
        wallet: options.wallet,
        programId: options.programId,
      },
      arbitratorIdl as unknown as ArbitratorIDL
    );
    this.hubProgramId = options.hubProgramId;
  }

  /**
   * Create a new ArbitratorClient instance
   */
  static create(
    options: ArbitratorClientOptions & { programId: PublicKey }
  ): ArbitratorClient {
    return new ArbitratorClient(options);
  }

  /**
   * Get the arbitrator PDA
   */
  public getArbitratorPDA(
    arbitratorPubkey: PublicKey,
    fiatCurrency: string
  ): { pda: PublicKey; bump: number } {
    const [pda, bump] = getArbitratorPDA(arbitratorPubkey, fiatCurrency, this.programId);
    return { pda, bump };
  }

  /**
   * Get the dispute PDA
   */
  public getDisputePDA(tradeId: BN): { pda: PublicKey; bump: number } {
    const [pda, bump] = getDisputePDA(tradeId, this.programId);
    return { pda, bump };
  }

  /**
   * Fetch an arbitrator account
   */
  public async getArbitrator(
    arbitratorPubkey: PublicKey,
    fiatCurrency: string
  ): Promise<ArbitratorAccount | null> {
    const { pda } = this.getArbitratorPDA(arbitratorPubkey, fiatCurrency);
    const account = await this.fetchAccount(pda, "arbitrator");
    return account as unknown as ArbitratorAccount | null;
  }

  /**
   * Fetch a dispute account
   */
  public async getDispute(tradeId: BN): Promise<DisputeAccount | null> {
    const { pda } = this.getDisputePDA(tradeId);
    const account = await this.fetchAccount(pda, "dispute");
    return account as unknown as DisputeAccount | null;
  }

  /**
   * Register a new arbitrator (admin only)
   */
  public async registerArbitrator(
    arbitratorPubkey: PublicKey,
    fiatCurrency: string
  ): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: arbitrator } = this.getArbitratorPDA(arbitratorPubkey, fiatCurrency);
    const [hubConfig] = getHubConfigPDA(this.hubProgramId);

    const fiatBytes = fiatToBytes(fiatCurrency);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .registerArbitrator({ fiatCurrency: fiatBytes })
        .accounts({
          arbitrator,
          admin: this.walletPublicKey!,
          arbitratorPubkey,
          hubConfig,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Remove an arbitrator (admin only)
   */
  public async removeArbitrator(
    arbitratorPubkey: PublicKey,
    fiatCurrency: string
  ): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: arbitrator } = this.getArbitratorPDA(arbitratorPubkey, fiatCurrency);
    const [hubConfig] = getHubConfigPDA(this.hubProgramId);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .removeArbitrator()
        .accounts({
          arbitrator,
          admin: this.walletPublicKey!,
          hubConfig,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Submit evidence for a dispute
   */
  public async submitEvidence(
    tradeId: BN,
    params: SubmitEvidenceParams
  ): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: dispute } = this.getDisputePDA(tradeId);

    // Validate evidence length
    if (params.evidence.length > 500) {
      throw new LocalMoneyError(
        "Evidence exceeds maximum length (500 characters)",
        LocalMoneyErrorCode.EVIDENCE_TOO_LONG
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .submitEvidence({ evidence: params.evidence })
        .accounts({
          dispute,
          submitter: this.walletPublicKey!,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Resolve a dispute (arbitrator only)
   */
  public async resolveDispute(
    tradeId: BN,
    resolution: DisputeResolution,
    fiatCurrency: string
  ): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: dispute } = this.getDisputePDA(tradeId);
    const { pda: arbitrator } = this.getArbitratorPDA(this.walletPublicKey!, fiatCurrency);

    const resolutionParam =
      resolution === DisputeResolution.BuyerWins
        ? { buyerWins: {} }
        : { sellerWins: {} };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .resolveDispute({ resolution: resolutionParam })
        .accounts({
          dispute,
          arbitrator,
          arbitratorSigner: this.walletPublicKey!,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Get all active arbitrators
   */
  public async getActiveArbitrators(): Promise<
    Array<{ publicKey: PublicKey; account: ArbitratorAccount }>
  > {
    const allArbitrators = await this.getAllAccounts("arbitrator");
    return allArbitrators
      .filter((a) => (a.account as unknown as ArbitratorAccount).isActive)
      .map((a) => ({
        publicKey: a.publicKey,
        account: a.account as unknown as ArbitratorAccount,
      }));
  }

  /**
   * Get arbitrators by fiat currency
   */
  public async getArbitratorsByFiatCurrency(
    fiatCurrency: string
  ): Promise<Array<{ publicKey: PublicKey; account: ArbitratorAccount }>> {
    const fiatBytes = fiatToBytes(fiatCurrency);
    const activeArbitrators = await this.getActiveArbitrators();

    return activeArbitrators.filter((a) => {
      const arbFiat = a.account.fiatCurrency;
      return (
        arbFiat[0] === fiatBytes[0] &&
        arbFiat[1] === fiatBytes[1] &&
        arbFiat[2] === fiatBytes[2]
      );
    });
  }

  /**
   * Get all pending disputes
   */
  public async getPendingDisputes(): Promise<
    Array<{ publicKey: PublicKey; account: DisputeAccount }>
  > {
    const allDisputes = await this.getAllAccounts("dispute");
    return allDisputes
      .filter((d) => (d.account as unknown as DisputeAccount).resolution === null)
      .map((d) => ({
        publicKey: d.publicKey,
        account: d.account as unknown as DisputeAccount,
      }));
  }

  /**
   * Get disputes assigned to an arbitrator
   */
  public async getDisputesForArbitrator(
    arbitratorPubkey: PublicKey
  ): Promise<Array<{ publicKey: PublicKey; account: DisputeAccount }>> {
    const allDisputes = await this.getAllAccounts("dispute");
    return allDisputes
      .filter((d) =>
        (d.account as unknown as DisputeAccount).arbitrator.equals(arbitratorPubkey)
      )
      .map((d) => ({
        publicKey: d.publicKey,
        account: d.account as unknown as DisputeAccount,
      }));
  }

  /**
   * Format arbitrator stats
   */
  public formatArbitratorStats(account: ArbitratorAccount): {
    fiatCurrency: string;
    totalDisputes: number;
    resolvedDisputes: number;
    pendingDisputes: number;
    resolutionRate: number;
    isActive: boolean;
    registeredAt: Date;
  } {
    const totalDisputes = this.bnToNumber(account.totalDisputes);
    const resolvedDisputes = this.bnToNumber(account.resolvedDisputes);
    const pendingDisputes = totalDisputes - resolvedDisputes;
    const resolutionRate =
      totalDisputes > 0 ? (resolvedDisputes / totalDisputes) * 100 : 0;

    return {
      fiatCurrency: bytesToFiat(account.fiatCurrency),
      totalDisputes,
      resolvedDisputes,
      pendingDisputes,
      resolutionRate,
      isActive: account.isActive,
      registeredAt: new Date(this.bnToNumber(account.registeredAt) * 1000),
    };
  }
}
