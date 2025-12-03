/**
 * Offer Program Client
 *
 * The Offer program manages marketplace listings where users can post
 * buy or sell offers for tokens.
 */

import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { BaseProgram, type ProgramClientOptions, type TransactionResult } from "./base";
import { getOfferPDA, getOfferCounterPDA, getProfilePDA, getHubConfigPDA, fiatToBytes, bytesToFiat } from "../pdas";
import { LocalMoneyError, LocalMoneyErrorCode } from "../errors";
import { OfferType, OfferState, toOfferType, toOfferState, fromOfferType } from "../types/enums";
import type { Offer as OfferIDL } from "../types/generated/offer";
import type { OfferAccount, CreateOfferParams, UpdateOfferParams, OfferCounterAccount } from "../types";

// Import the IDL
import offerIdl from "../idl/offer.json";

/**
 * Offer program client options
 */
export interface OfferClientOptions extends Omit<ProgramClientOptions, "programId"> {
  programId?: PublicKey;
  profileProgramId: PublicKey;
  hubProgramId: PublicKey;
}

/**
 * Offer display format for UI rendering
 */
export interface OfferDisplay {
  id: string;
  owner: string;
  offerType: OfferType;
  offerTypeLabel: "Buy" | "Sell";
  state: OfferState;
  fiatCurrency: string;
  tokenMint: string;
  minAmount: string;
  maxAmount: string;
  rate: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Offer program client for managing marketplace listings
 */
export class OfferClient extends BaseProgram<OfferIDL> {
  private readonly profileProgramId: PublicKey;
  private readonly hubProgramId: PublicKey;

  constructor(
    options: OfferClientOptions & { programId: PublicKey }
  ) {
    super(
      {
        connection: options.connection,
        wallet: options.wallet,
        programId: options.programId,
      },
      offerIdl as unknown as OfferIDL
    );
    this.profileProgramId = options.profileProgramId;
    this.hubProgramId = options.hubProgramId;
  }

  /**
   * Create a new OfferClient instance
   */
  static create(options: OfferClientOptions & { programId: PublicKey }): OfferClient {
    return new OfferClient(options);
  }

  /**
   * Get the offer PDA for an offer ID
   */
  public getOfferPDA(offerId: BN): { pda: PublicKey; bump: number } {
    const [pda, bump] = getOfferPDA(offerId, this.programId);
    return { pda, bump };
  }

  /**
   * Get the offer counter PDA
   */
  public getOfferCounterPDA(): { pda: PublicKey; bump: number } {
    const [pda, bump] = getOfferCounterPDA(this.programId);
    return { pda, bump };
  }

  /**
   * Fetch an offer by ID
   *
   * @param offerId - Offer ID
   * @returns Offer account or null if not found
   */
  public async getOffer(offerId: BN): Promise<OfferAccount | null> {
    const { pda } = this.getOfferPDA(offerId);
    const offer = await this.fetchAccount(pda, "offer");
    if (!offer) return null;

    // Convert Anchor enums to SDK enums
    const rawOffer = offer as unknown as Record<string, unknown>;
    return {
      ...rawOffer,
      offerType: toOfferType(rawOffer.offerType as Record<string, unknown>),
      state: toOfferState(rawOffer.state as Record<string, unknown>),
    } as unknown as OfferAccount;
  }

  /**
   * Fetch the current offer counter
   */
  public async getOfferCounter(): Promise<OfferCounterAccount | null> {
    const { pda } = this.getOfferCounterPDA();
    const counter = await this.fetchAccount(pda, "offerCounter");
    return counter as unknown as OfferCounterAccount | null;
  }

  /**
   * Get the next offer ID that will be assigned
   */
  public async getNextOfferId(): Promise<BN> {
    const counter = await this.getOfferCounter();
    if (!counter) {
      throw new LocalMoneyError("Offer counter not initialized", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }
    return counter.nextId;
  }

  /**
   * Create a new offer
   *
   * @param params - Offer parameters
   * @returns Transaction result with offer ID
   */
  public async createOffer(params: {
    offerType: OfferType;
    fiatCurrency: string;
    tokenMint: PublicKey;
    minAmount: BN;
    maxAmount: BN;
    rate: BN;
    description: string;
  }): Promise<TransactionResult & { offerId: BN }> {
    this.requireWallet();

    const program = this.getProgram();

    // Get next offer ID
    const counter = await this.getOfferCounter();
    if (!counter) {
      throw new LocalMoneyError("Offer counter not initialized", LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
    }
    const offerId = counter.nextId;
    const { pda: offer } = this.getOfferPDA(offerId);
    const { pda: counterPda } = this.getOfferCounterPDA();

    // Get profile PDA
    const [profilePda] = getProfilePDA(this.walletPublicKey!, this.profileProgramId);
    const [hubConfigPda] = getHubConfigPDA(this.hubProgramId);

    // Validate inputs
    if (params.minAmount.gt(params.maxAmount)) {
      throw new LocalMoneyError(
        "Minimum amount cannot be greater than maximum",
        LocalMoneyErrorCode.MIN_GREATER_THAN_MAX
      );
    }
    if (params.description.length > 280) {
      throw new LocalMoneyError(
        "Description exceeds maximum length (280 characters)",
        LocalMoneyErrorCode.DESCRIPTION_TOO_LONG
      );
    }

    const fiatBytes = fiatToBytes(params.fiatCurrency);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .createOffer({
          offerType: fromOfferType(params.offerType),
          fiatCurrency: fiatBytes,
          minAmount: params.minAmount,
          maxAmount: params.maxAmount,
          rate: params.rate,
          description: params.description,
        })
        .accounts({
          offer,
          counter: counterPda,
          ownerProfile: profilePda,
          owner: this.walletPublicKey!,
          hubConfig: hubConfigPda,
          tokenMint: params.tokenMint,
          profileProgram: this.profileProgramId,
          offerProgram: this.programId,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      const result = await this.sendTransaction(tx);
      return { ...result, offerId };
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Update an existing offer
   *
   * @param offerId - Offer ID to update
   * @param params - Update parameters (all optional)
   * @returns Transaction result
   */
  public async updateOffer(offerId: BN, params: UpdateOfferParams): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: offer } = this.getOfferPDA(offerId);

    // Validate if both min and max provided
    if (params.minAmount && params.maxAmount && params.minAmount.gt(params.maxAmount)) {
      throw new LocalMoneyError(
        "Minimum amount cannot be greater than maximum",
        LocalMoneyErrorCode.MIN_GREATER_THAN_MAX
      );
    }
    if (params.description && params.description.length > 280) {
      throw new LocalMoneyError(
        "Description exceeds maximum length (280 characters)",
        LocalMoneyErrorCode.DESCRIPTION_TOO_LONG
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .updateOffer({
          minAmount: params.minAmount ?? null,
          maxAmount: params.maxAmount ?? null,
          rate: params.rate ?? null,
          description: params.description ?? null,
        })
        .accounts({
          offer,
          owner: this.walletPublicKey!,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Pause an offer (prevents new trades)
   *
   * @param offerId - Offer ID to pause
   * @returns Transaction result
   */
  public async pauseOffer(offerId: BN): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: offer } = this.getOfferPDA(offerId);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .pauseOffer()
        .accounts({
          offer,
          owner: this.walletPublicKey!,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Resume a paused offer
   *
   * @param offerId - Offer ID to resume
   * @returns Transaction result
   */
  public async resumeOffer(offerId: BN): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: offer } = this.getOfferPDA(offerId);
    const [hubConfigPda] = getHubConfigPDA(this.hubProgramId);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .resumeOffer()
        .accounts({
          offer,
          owner: this.walletPublicKey!,
          hubConfig: hubConfigPda,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Delete an offer (marks as deleted, doesn't remove account)
   *
   * @param offerId - Offer ID to delete
   * @returns Transaction result
   */
  public async deleteOffer(offerId: BN): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: offer } = this.getOfferPDA(offerId);
    const [profilePda] = getProfilePDA(this.walletPublicKey!, this.profileProgramId);
    const [hubConfigPda] = getHubConfigPDA(this.hubProgramId);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .deleteOffer()
        .accounts({
          offer,
          ownerProfile: profilePda,
          owner: this.walletPublicKey!,
          hubConfig: hubConfigPda,
          profileProgram: this.profileProgramId,
          offerProgram: this.programId,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Get all active offers
   *
   * @returns All active offers
   */
  public async getActiveOffers(): Promise<Array<{ publicKey: PublicKey; account: OfferAccount }>> {
    const allOffers = await this.getAllAccounts("offer");

    return allOffers
      .map((o) => {
        const rawAccount = o.account as unknown as Record<string, unknown>;
        return {
          publicKey: o.publicKey,
          account: {
            ...rawAccount,
            offerType: toOfferType(rawAccount.offerType as Record<string, unknown>),
            state: toOfferState(rawAccount.state as Record<string, unknown>),
          } as unknown as OfferAccount,
        };
      })
      .filter((o) => o.account.state === OfferState.Active);
  }

  /**
   * Get offers by owner
   *
   * @param owner - Owner's public key
   * @returns Owner's offers
   */
  public async getOffersByOwner(
    owner: PublicKey
  ): Promise<Array<{ publicKey: PublicKey; account: OfferAccount }>> {
    const allOffers = await this.getAllAccounts("offer");

    return allOffers
      .map((o) => {
        const rawAccount = o.account as unknown as Record<string, unknown>;
        return {
          publicKey: o.publicKey,
          account: {
            ...rawAccount,
            offerType: toOfferType(rawAccount.offerType as Record<string, unknown>),
            state: toOfferState(rawAccount.state as Record<string, unknown>),
          } as unknown as OfferAccount,
        };
      })
      .filter((o) => (o.account.owner as PublicKey).equals(owner));
  }

  /**
   * Get offers by fiat currency
   *
   * @param fiatCurrency - Fiat currency code (e.g., "USD")
   * @returns Matching offers
   */
  public async getOffersByFiatCurrency(
    fiatCurrency: string
  ): Promise<Array<{ publicKey: PublicKey; account: OfferAccount }>> {
    const fiatBytes = fiatToBytes(fiatCurrency);
    const activeOffers = await this.getActiveOffers();

    return activeOffers.filter((o) => {
      const offerFiat = o.account.fiatCurrency;
      return (
        offerFiat[0] === fiatBytes[0] &&
        offerFiat[1] === fiatBytes[1] &&
        offerFiat[2] === fiatBytes[2]
      );
    });
  }

  /**
   * Get offers by token mint
   *
   * @param tokenMint - Token mint address
   * @returns Matching offers
   */
  public async getOffersByTokenMint(
    tokenMint: PublicKey
  ): Promise<Array<{ publicKey: PublicKey; account: OfferAccount }>> {
    const activeOffers = await this.getActiveOffers();
    return activeOffers.filter((o) => (o.account.tokenMint as PublicKey).equals(tokenMint));
  }

  /**
   * Search offers with multiple filters
   *
   * @param filters - Search filters
   * @returns Matching offers
   */
  public async searchOffers(filters: {
    offerType?: OfferType;
    fiatCurrency?: string;
    tokenMint?: PublicKey;
    minAmount?: BN;
    maxAmount?: BN;
    state?: OfferState;
  }): Promise<Array<{ publicKey: PublicKey; account: OfferAccount }>> {
    const allOffers = await this.getAllAccounts("offer");

    return allOffers
      .map((o) => {
        const rawAccount = o.account as unknown as Record<string, unknown>;
        return {
          publicKey: o.publicKey,
          account: {
            ...rawAccount,
            offerType: toOfferType(rawAccount.offerType as Record<string, unknown>),
            state: toOfferState(rawAccount.state as Record<string, unknown>),
          } as unknown as OfferAccount,
        };
      })
      .filter((o) => {
        const offer = o.account;

        // State filter
        if (filters.state !== undefined && offer.state !== filters.state) {
          return false;
        }

        // Default to active offers if no state filter
        if (filters.state === undefined && offer.state !== OfferState.Active) {
          return false;
        }

        // Offer type filter
        if (filters.offerType !== undefined && offer.offerType !== filters.offerType) {
          return false;
        }

        // Fiat currency filter
        if (filters.fiatCurrency) {
          const fiatBytes = fiatToBytes(filters.fiatCurrency);
          const offerFiat = offer.fiatCurrency;
          if (
            offerFiat[0] !== fiatBytes[0] ||
            offerFiat[1] !== fiatBytes[1] ||
            offerFiat[2] !== fiatBytes[2]
          ) {
            return false;
          }
        }

        // Token mint filter
        if (filters.tokenMint && !(offer.tokenMint as PublicKey).equals(filters.tokenMint)) {
          return false;
        }

        // Amount range filter
        if (filters.minAmount && (offer.maxAmount as BN).lt(filters.minAmount)) {
          return false;
        }
        if (filters.maxAmount && (offer.minAmount as BN).gt(filters.maxAmount)) {
          return false;
        }

        return true;
      });
  }

  /**
   * Convert an offer to display format
   *
   * @param offer - Offer account
   * @param decimals - Token decimals (default 6)
   * @returns Formatted offer for display
   */
  public formatOfferForDisplay(
    offer: OfferAccount,
    decimals: number = 6
  ): OfferDisplay {
    const divisor = Math.pow(10, decimals);
    const minAmount = this.bnToNumber(offer.minAmount as BN) / divisor;
    const maxAmount = this.bnToNumber(offer.maxAmount as BN) / divisor;
    const rate = this.bnToNumber(offer.rate as BN) / 100; // cents to dollars

    return {
      id: (offer.id as BN).toString(),
      owner: (offer.owner as PublicKey).toBase58(),
      offerType: offer.offerType,
      offerTypeLabel: offer.offerType === OfferType.Buy ? "Buy" : "Sell",
      state: offer.state,
      fiatCurrency: bytesToFiat(offer.fiatCurrency as number[]),
      tokenMint: (offer.tokenMint as PublicKey).toBase58(),
      minAmount: minAmount.toFixed(decimals),
      maxAmount: maxAmount.toFixed(decimals),
      rate: `$${rate.toFixed(2)}`,
      description: offer.description as string,
      createdAt: new Date(this.bnToNumber(offer.createdAt as BN) * 1000),
      updatedAt: new Date(this.bnToNumber(offer.updatedAt as BN) * 1000),
    };
  }
}
