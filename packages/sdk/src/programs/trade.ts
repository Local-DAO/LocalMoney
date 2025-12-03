/**
 * Trade Program Client
 *
 * The Trade program manages the P2P exchange flow including trade creation,
 * acceptance, escrow funding, fiat confirmation, and release.
 */

import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BaseProgram, type ProgramClientOptions, type TransactionResult } from "./base";
import {
  getTradePDA,
  getTradeCounterPDA,
  getProfilePDA,
  getHubConfigPDA,
  getOfferPDA,
  getEscrowVaultPDA,
  getDisputePDA,
  getArbitratorPDA,
  bytesToFiat,
} from "../pdas";
import { LocalMoneyError, LocalMoneyErrorCode } from "../errors";
import { TradeState, toTradeState } from "../types/enums";
import type { Trade as TradeIDL } from "../types/generated/trade";
import type { TradeAccount, TradeCounterAccount, CreateTradeParams, AcceptTradeParams } from "../types";

// Import the IDL
import tradeIdl from "../idl/trade.json";

/**
 * Trade program client options
 */
export interface TradeClientOptions extends Omit<ProgramClientOptions, "programId"> {
  programId?: PublicKey;
  profileProgramId: PublicKey;
  hubProgramId: PublicKey;
  offerProgramId: PublicKey;
  escrowProgramId: PublicKey;
  arbitratorProgramId: PublicKey;
}

/**
 * Trade display format
 */
export interface TradeDisplay {
  id: string;
  offerId: string;
  buyer: string;
  seller: string;
  state: TradeState;
  stateLabel: string;
  amount: string;
  fiatAmount: string;
  fiatCurrency: string;
  tokenMint: string;
  expiresAt: Date;
  createdAt: Date;
  isExpired: boolean;
}

/**
 * Trade program client for managing P2P exchanges
 */
export class TradeClient extends BaseProgram<TradeIDL> {
  private readonly profileProgramId: PublicKey;
  private readonly hubProgramId: PublicKey;
  private readonly offerProgramId: PublicKey;
  private readonly escrowProgramId: PublicKey;
  private readonly arbitratorProgramId: PublicKey;

  constructor(options: TradeClientOptions & { programId: PublicKey }) {
    super(
      {
        connection: options.connection,
        wallet: options.wallet,
        programId: options.programId,
      },
      tradeIdl as unknown as TradeIDL
    );
    this.profileProgramId = options.profileProgramId;
    this.hubProgramId = options.hubProgramId;
    this.offerProgramId = options.offerProgramId;
    this.escrowProgramId = options.escrowProgramId;
    this.arbitratorProgramId = options.arbitratorProgramId;
  }

  /**
   * Create a new TradeClient instance
   */
  static create(options: TradeClientOptions & { programId: PublicKey }): TradeClient {
    return new TradeClient(options);
  }

  /**
   * Get the trade PDA for a trade ID
   */
  public getTradePDA(tradeId: BN): { pda: PublicKey; bump: number } {
    const [pda, bump] = getTradePDA(tradeId, this.programId);
    return { pda, bump };
  }

  /**
   * Get the trade counter PDA
   */
  public getTradeCounterPDA(): { pda: PublicKey; bump: number } {
    const [pda, bump] = getTradeCounterPDA(this.programId);
    return { pda, bump };
  }

  /**
   * Fetch a trade by ID
   */
  public async getTrade(tradeId: BN): Promise<TradeAccount | null> {
    const { pda } = this.getTradePDA(tradeId);
    const trade = await this.fetchAccount(pda, "trade");
    if (!trade) return null;

    const rawTrade = trade as unknown as Record<string, unknown>;
    return {
      ...rawTrade,
      state: toTradeState(rawTrade.state as Record<string, unknown>),
    } as unknown as TradeAccount;
  }

  /**
   * Fetch the current trade counter
   */
  public async getTradeCounter(): Promise<TradeCounterAccount | null> {
    const { pda } = this.getTradeCounterPDA();
    const counter = await this.fetchAccount(pda, "tradeCounter");
    return counter as unknown as TradeCounterAccount | null;
  }

  /**
   * Get the next trade ID
   */
  public async getNextTradeId(): Promise<BN> {
    const counter = await this.getTradeCounter();
    if (!counter) {
      throw new LocalMoneyError("Trade counter not initialized", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }
    return counter.nextId;
  }

  /**
   * Initialize the trade counter (admin only, one-time)
   */
  public async initializeCounter(): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: counter } = this.getTradeCounterPDA();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .initializeCounter()
        .accounts({
          counter,
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
   * Create a new trade against an offer
   *
   * Note: The escrow vault address stored in the trade is the ATA (token account)
   * owned by the escrow vault PDA. This is needed because fund_escrow expects
   * a TokenAccount at the stored address.
   */
  public async createTrade(
    params: CreateTradeParams & { tokenMint: PublicKey }
  ): Promise<TransactionResult & { tradeId: BN }> {
    this.requireWallet();

    const program = this.getProgram();

    // Get trade ID
    const counter = await this.getTradeCounter();
    if (!counter) {
      throw new LocalMoneyError("Trade counter not initialized", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }
    const tradeId = counter.nextId;
    const { pda: tradePda } = this.getTradePDA(tradeId);
    const { pda: counterPda } = this.getTradeCounterPDA();

    // Get PDAs
    const [buyerProfile] = getProfilePDA(this.walletPublicKey!, this.profileProgramId);
    const [hubConfig] = getHubConfigPDA(this.hubProgramId);
    const [offer] = getOfferPDA(params.offerId, this.offerProgramId);
    const [escrowVaultPda] = getEscrowVaultPDA(tradeId, this.escrowProgramId);

    // Get escrow vault's token account (ATA owned by the escrow vault PDA)
    // This is what we store in trade.escrow_vault so fund_escrow can find it
    const escrowVaultTokenAccount = getAssociatedTokenAddressSync(
      params.tokenMint,
      escrowVaultPda,
      true // allowOwnerOffCurve - required for PDAs
    );

    // Validate contact info
    if (params.buyerContact.length > 280) {
      throw new LocalMoneyError(
        "Contact info exceeds maximum length",
        LocalMoneyErrorCode.CONTACT_INFO_TOO_LONG
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .createTrade({
          offerId: params.offerId,
          amount: params.amount,
          fiatAmount: params.fiatAmount,
          buyerContact: params.buyerContact,
        })
        .accounts({
          trade: tradePda,
          counter: counterPda,
          offer,
          buyer: this.walletPublicKey!,
          buyerProfile,
          hubConfig,
          escrowVault: escrowVaultTokenAccount, // Pass the ATA, not the PDA
          profileProgram: this.profileProgramId,
          tradeProgram: this.programId,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      const result = await this.sendTransaction(tx);
      return { ...result, tradeId };
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Accept a trade (seller only)
   */
  public async acceptTrade(
    tradeId: BN,
    params: AcceptTradeParams
  ): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: tradePda } = this.getTradePDA(tradeId);

    // Fetch trade to get offer ID
    const trade = await this.getTrade(tradeId);
    if (!trade) {
      throw new LocalMoneyError("Trade not found", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }
    const [offer] = getOfferPDA(trade.offerId as BN, this.offerProgramId);

    // Validate contact info
    if (params.sellerContact.length > 280) {
      throw new LocalMoneyError(
        "Contact info exceeds maximum length",
        LocalMoneyErrorCode.CONTACT_INFO_TOO_LONG
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .acceptTrade({ sellerContact: params.sellerContact })
        .accounts({
          trade: tradePda,
          seller: this.walletPublicKey!,
          offer,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Cancel a trade (before escrow funded)
   */
  public async cancelTrade(tradeId: BN): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: tradePda } = this.getTradePDA(tradeId);

    // Fetch trade to get buyer
    const trade = await this.getTrade(tradeId);
    if (!trade) {
      throw new LocalMoneyError("Trade not found", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }

    const [buyerProfile] = getProfilePDA(trade.buyer as PublicKey, this.profileProgramId);
    const [hubConfig] = getHubConfigPDA(this.hubProgramId);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .cancelTrade()
        .accounts({
          trade: tradePda,
          canceler: this.walletPublicKey!,
          buyerProfile,
          hubConfig,
          profileProgram: this.profileProgramId,
          tradeProgram: this.programId,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Fund the escrow (after trade accepted)
   *
   * This method:
   * 1. Creates the escrow vault's token account (ATA) if it doesn't exist
   * 2. Calls CPI to escrow program to initialize EscrowVault PDA and transfer tokens
   */
  public async fundEscrow(
    tradeId: BN,
    tokenMint: PublicKey
  ): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: tradePda } = this.getTradePDA(tradeId);

    // Fetch trade
    const trade = await this.getTrade(tradeId);
    if (!trade) {
      throw new LocalMoneyError("Trade not found", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }

    const [offer] = getOfferPDA(trade.offerId as BN, this.offerProgramId);
    const [escrowVault] = getEscrowVaultPDA(tradeId, this.escrowProgramId);
    const [hubConfig] = getHubConfigPDA(this.hubProgramId);

    // Get funder's token account
    const funderTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      this.walletPublicKey!
    );

    // Get escrow vault's token account (ATA owned by the escrow vault PDA)
    const escrowVaultTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      escrowVault,
      true // allowOwnerOffCurve - required for PDAs
    );

    try {
      // Build transaction with potential ATA creation
      const tx = new Transaction();

      // Check if escrow vault's token account exists
      const escrowVaultAccountInfo = await this.connection.getAccountInfo(escrowVaultTokenAccount);
      if (!escrowVaultAccountInfo) {
        // Create ATA for escrow vault PDA
        const createAtaIx = createAssociatedTokenAccountInstruction(
          this.walletPublicKey!, // payer
          escrowVaultTokenAccount, // ata
          escrowVault, // owner (the PDA)
          tokenMint, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        tx.add(createAtaIx);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fundEscrowIx = await (program.methods as any)
        .fundEscrow()
        .accounts({
          trade: tradePda,
          funder: this.walletPublicKey!,
          funderTokenAccount,
          escrowVault, // EscrowVault state PDA (initialized by escrow program via CPI)
          vaultTokenAccount: escrowVaultTokenAccount, // ATA for tokens
          tokenMint,
          offer,
          hubConfig,
          escrowProgram: this.escrowProgramId,
          tradeProgram: this.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      tx.add(fundEscrowIx);

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Confirm fiat deposit (buyer only)
   */
  public async confirmFiatDeposit(tradeId: BN): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: tradePda } = this.getTradePDA(tradeId);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .confirmFiatDeposit()
        .accounts({
          trade: tradePda,
          buyer: this.walletPublicKey!,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Release escrow (seller after fiat confirmed, or arbitrator after dispute)
   */
  public async releaseEscrow(
    tradeId: BN,
    tokenMint: PublicKey,
    recipientTokenAccount: PublicKey,
    treasuryTokenAccount: PublicKey,
    warchestTokenAccount: PublicKey,
    arbitratorTokenAccount?: PublicKey
  ): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: tradePda } = this.getTradePDA(tradeId);

    // Fetch trade
    const trade = await this.getTrade(tradeId);
    if (!trade) {
      throw new LocalMoneyError("Trade not found", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }

    const [escrowVault] = getEscrowVaultPDA(tradeId, this.escrowProgramId);
    const [buyerProfile] = getProfilePDA(trade.buyer as PublicKey, this.profileProgramId);
    const [sellerProfile] = getProfilePDA(trade.seller as PublicKey, this.profileProgramId);
    const [hubConfig] = getHubConfigPDA(this.hubProgramId);
    const [offer] = getOfferPDA(trade.offerId as BN, this.offerProgramId);

    // Get escrow token account
    const escrowVaultTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      escrowVault,
      true
    );

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .releaseEscrow()
        .accounts({
          trade: tradePda,
          releaser: this.walletPublicKey!,
          escrowVault,
          escrowVaultTokenAccount,
          recipientTokenAccount,
          treasuryTokenAccount,
          warchestTokenAccount,
          arbitratorTokenAccount: arbitratorTokenAccount ?? null,
          hubConfig,
          buyerProfile,
          sellerProfile,
          offer,
          escrowProgram: this.escrowProgramId,
          profileProgram: this.profileProgramId,
          tradeProgram: this.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Refund escrow (returns tokens to depositor)
   */
  public async refundTrade(
    tradeId: BN,
    tokenMint: PublicKey,
    depositorTokenAccount: PublicKey
  ): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: tradePda } = this.getTradePDA(tradeId);

    // Fetch trade
    const trade = await this.getTrade(tradeId);
    if (!trade) {
      throw new LocalMoneyError("Trade not found", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }

    const [escrowVault] = getEscrowVaultPDA(tradeId, this.escrowProgramId);
    const [buyerProfile] = getProfilePDA(trade.buyer as PublicKey, this.profileProgramId);
    const [hubConfig] = getHubConfigPDA(this.hubProgramId);
    const [offer] = getOfferPDA(trade.offerId as BN, this.offerProgramId);

    // Get escrow token account
    const escrowVaultTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      escrowVault,
      true
    );

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .refundTrade()
        .accounts({
          trade: tradePda,
          refunder: this.walletPublicKey!,
          escrowVault,
          escrowVaultTokenAccount,
          depositorTokenAccount,
          offer,
          buyerProfile,
          hubConfig,
          escrowProgram: this.escrowProgramId,
          profileProgram: this.profileProgramId,
          tradeProgram: this.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Initiate a dispute
   */
  public async initiateDispute(
    tradeId: BN,
    arbitratorPubkey: PublicKey
  ): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: tradePda } = this.getTradePDA(tradeId);

    // Fetch trade
    const trade = await this.getTrade(tradeId);
    if (!trade) {
      throw new LocalMoneyError("Trade not found", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }

    const [escrowVault] = getEscrowVaultPDA(tradeId, this.escrowProgramId);
    const [dispute] = getDisputePDA(tradeId, this.arbitratorProgramId);
    const fiatCurrency = bytesToFiat(trade.fiatCurrency as number[]);
    const [arbitrator] = getArbitratorPDA(arbitratorPubkey, fiatCurrency, this.arbitratorProgramId);
    const [hubConfig] = getHubConfigPDA(this.hubProgramId);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .initiateDispute()
        .accounts({
          trade: tradePda,
          initiator: this.walletPublicKey!,
          escrowVault,
          dispute,
          arbitrator,
          hubConfig,
          escrowProgram: this.escrowProgramId,
          arbitratorProgram: this.arbitratorProgramId,
          tradeProgram: this.programId,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Check if a trade has expired
   */
  public async checkExpiration(tradeId: BN): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: tradePda } = this.getTradePDA(tradeId);

    // Fetch trade
    const trade = await this.getTrade(tradeId);
    if (!trade) {
      throw new LocalMoneyError("Trade not found", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }

    const [buyerProfile] = getProfilePDA(trade.buyer as PublicKey, this.profileProgramId);
    const [hubConfig] = getHubConfigPDA(this.hubProgramId);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .checkExpiration()
        .accounts({
          trade: tradePda,
          buyerProfile,
          hubConfig,
          profileProgram: this.profileProgramId,
          tradeProgram: this.programId,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Get trades by buyer
   */
  public async getTradesByBuyer(
    buyer: PublicKey
  ): Promise<Array<{ publicKey: PublicKey; account: TradeAccount }>> {
    const allTrades = await this.getAllAccounts("trade");
    return allTrades
      .map((t) => {
        const rawAccount = t.account as unknown as Record<string, unknown>;
        return {
          publicKey: t.publicKey,
          account: {
            ...rawAccount,
            state: toTradeState(rawAccount.state as Record<string, unknown>),
          } as unknown as TradeAccount,
        };
      })
      .filter((t) => (t.account.buyer as PublicKey).equals(buyer));
  }

  /**
   * Get trades by seller
   */
  public async getTradesBySeller(
    seller: PublicKey
  ): Promise<Array<{ publicKey: PublicKey; account: TradeAccount }>> {
    const allTrades = await this.getAllAccounts("trade");
    return allTrades
      .map((t) => {
        const rawAccount = t.account as unknown as Record<string, unknown>;
        return {
          publicKey: t.publicKey,
          account: {
            ...rawAccount,
            state: toTradeState(rawAccount.state as Record<string, unknown>),
          } as unknown as TradeAccount,
        };
      })
      .filter((t) => (t.account.seller as PublicKey).equals(seller));
  }

  /**
   * Get active trades for a user (as buyer or seller)
   */
  public async getActiveTrades(
    user: PublicKey
  ): Promise<Array<{ publicKey: PublicKey; account: TradeAccount }>> {
    const allTrades = await this.getAllAccounts("trade");
    return allTrades
      .map((t) => {
        const rawAccount = t.account as unknown as Record<string, unknown>;
        return {
          publicKey: t.publicKey,
          account: {
            ...rawAccount,
            state: toTradeState(rawAccount.state as Record<string, unknown>),
          } as unknown as TradeAccount,
        };
      })
      .filter((t) => {
        const trade = t.account;
        const isParty =
          (trade.buyer as PublicKey).equals(user) ||
          (trade.seller as PublicKey).equals(user);
        const isActive = ![
          TradeState.EscrowReleased,
          TradeState.RequestCanceled,
          TradeState.RequestExpired,
          TradeState.EscrowRefunded,
        ].includes(trade.state);
        return isParty && isActive;
      });
  }

  /**
   * Get state label for display
   */
  public getStateLabel(state: TradeState): string {
    const labels: Record<TradeState, string> = {
      [TradeState.RequestCreated]: "Request Created",
      [TradeState.RequestAccepted]: "Request Accepted",
      [TradeState.EscrowFunded]: "Escrow Funded",
      [TradeState.FiatDeposited]: "Fiat Deposited",
      [TradeState.EscrowReleased]: "Complete",
      [TradeState.RequestCanceled]: "Canceled",
      [TradeState.RequestExpired]: "Expired",
      [TradeState.EscrowRefunded]: "Refunded",
      [TradeState.Disputed]: "Disputed",
      [TradeState.DisputeResolved]: "Dispute Resolved",
    };
    return labels[state];
  }

  /**
   * Check if trade is expired
   */
  public isTradeExpired(trade: TradeAccount): boolean {
    const now = Math.floor(Date.now() / 1000);
    return this.bnToNumber(trade.expiresAt as BN) < now;
  }

  /**
   * Format trade for display
   */
  public formatTradeForDisplay(trade: TradeAccount, decimals: number = 6): TradeDisplay {
    const divisor = Math.pow(10, decimals);
    const amount = this.bnToNumber(trade.amount as BN) / divisor;
    const fiatAmount = this.bnToNumber(trade.fiatAmount as BN) / 100;

    return {
      id: (trade.id as BN).toString(),
      offerId: (trade.offerId as BN).toString(),
      buyer: (trade.buyer as PublicKey).toBase58(),
      seller: (trade.seller as PublicKey).toBase58(),
      state: trade.state,
      stateLabel: this.getStateLabel(trade.state),
      amount: amount.toFixed(decimals),
      fiatAmount: `$${fiatAmount.toFixed(2)}`,
      fiatCurrency: bytesToFiat(trade.fiatCurrency as number[]),
      tokenMint: (trade.tokenMint as PublicKey).toBase58(),
      expiresAt: new Date(this.bnToNumber(trade.expiresAt as BN) * 1000),
      createdAt: new Date(this.bnToNumber(trade.createdAt as BN) * 1000),
      isExpired: this.isTradeExpired(trade),
    };
  }
}
