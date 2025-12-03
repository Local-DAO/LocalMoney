/**
 * Profile Program Client
 *
 * The Profile program manages user profiles including contact information,
 * trading statistics, and reputation scores.
 */

import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { BaseProgram, type ProgramClientOptions, type TransactionResult } from "./base";
import { getProfilePDA } from "../pdas";
import { LocalMoneyError, LocalMoneyErrorCode } from "../errors";
import type { Profile as ProfileIDL } from "../types/generated/profile";
import type { UserProfileAccount, CreateProfileParams, UpdateContactParams } from "../types";

// Import the IDL
import profileIdl from "../idl/profile.json";

/**
 * Profile program client options
 */
export interface ProfileClientOptions extends Omit<ProgramClientOptions, "programId"> {
  programId?: PublicKey;
}

/**
 * Profile program client for managing user profiles
 */
export class ProfileClient extends BaseProgram<ProfileIDL> {
  constructor(options: ProfileClientOptions & { programId: PublicKey }) {
    super(
      {
        connection: options.connection,
        wallet: options.wallet,
        programId: options.programId,
      },
      profileIdl as unknown as ProfileIDL
    );
  }

  /**
   * Create a new ProfileClient instance
   */
  static create(options: ProfileClientOptions & { programId: PublicKey }): ProfileClient {
    return new ProfileClient(options);
  }

  /**
   * Get the profile PDA for a user
   *
   * @param owner - User's public key
   * @returns Profile PDA and bump
   */
  public getProfilePDA(owner: PublicKey): { pda: PublicKey; bump: number } {
    const [pda, bump] = getProfilePDA(owner, this.programId);
    return { pda, bump };
  }

  /**
   * Fetch a user's profile
   *
   * @param owner - User's public key
   * @returns User profile or null if not found
   */
  public async getProfile(owner: PublicKey): Promise<UserProfileAccount | null> {
    const { pda } = this.getProfilePDA(owner);
    const profile = await this.fetchAccount(pda, "userProfile");
    if (!profile) return null;

    return profile as unknown as UserProfileAccount;
  }

  /**
   * Fetch the connected wallet's profile
   *
   * @returns Profile or null if not found/wallet not connected
   */
  public async getMyProfile(): Promise<UserProfileAccount | null> {
    if (!this.walletPublicKey) return null;
    return this.getProfile(this.walletPublicKey);
  }

  /**
   * Check if a user has a profile
   *
   * @param owner - User's public key
   * @returns true if profile exists
   */
  public async hasProfile(owner: PublicKey): Promise<boolean> {
    const { pda } = this.getProfilePDA(owner);
    return this.accountExists(pda);
  }

  /**
   * Create a new profile for the connected wallet
   *
   * @param params - Profile creation parameters
   * @returns Transaction result
   */
  public async createProfile(params: CreateProfileParams): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: profile } = this.getProfilePDA(this.walletPublicKey!);

    // Validate contact info length
    if (params.contactInfo.length > 280) {
      throw new LocalMoneyError(
        "Contact info exceeds maximum length (280 characters)",
        LocalMoneyErrorCode.CONTACT_INFO_TOO_LONG
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .createProfile({
          contactInfo: params.contactInfo,
          encryptionKey: params.encryptionKey,
        })
        .accounts({
          profile,
          owner: this.walletPublicKey!,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Update the connected wallet's contact information
   *
   * @param params - Contact update parameters
   * @returns Transaction result
   */
  public async updateContact(params: UpdateContactParams): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: profile } = this.getProfilePDA(this.walletPublicKey!);

    // Validate contact info length
    if (params.contactInfo.length > 280) {
      throw new LocalMoneyError(
        "Contact info exceeds maximum length (280 characters)",
        LocalMoneyErrorCode.CONTACT_INFO_TOO_LONG
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .updateContact({
          contactInfo: params.contactInfo,
          encryptionKey: params.encryptionKey,
        })
        .accounts({
          profile,
          owner: this.walletPublicKey!,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Fetch multiple profiles at once
   *
   * @param owners - Array of user public keys
   * @returns Array of profiles (null for missing profiles)
   */
  public async getProfiles(owners: PublicKey[]): Promise<(UserProfileAccount | null)[]> {
    const pdas = owners.map((owner) => this.getProfilePDA(owner).pda);
    const profiles = await this.fetchAccounts(pdas, "userProfile");
    return profiles as unknown as (UserProfileAccount | null)[];
  }

  /**
   * Get the reputation score as a percentage
   *
   * @param owner - User's public key
   * @returns Reputation percentage (0-100) or null if no profile
   */
  public async getReputationPercent(owner: PublicKey): Promise<number | null> {
    const profile = await this.getProfile(owner);
    if (!profile) return null;

    // Reputation is stored as basis points (0-10000)
    return profile.reputationScore / 100;
  }

  /**
   * Get trading statistics for a user
   *
   * @param owner - User's public key
   * @returns Trading stats or null if no profile
   */
  public async getTradingStats(owner: PublicKey): Promise<{
    totalTrades: number;
    completedTrades: number;
    disputedTrades: number;
    totalBuyVolume: BN;
    totalSellVolume: BN;
    activeOffers: number;
    activeTrades: number;
    completionRate: number;
    disputeRate: number;
  } | null> {
    const profile = await this.getProfile(owner);
    if (!profile) return null;

    const totalTrades = this.bnToNumber(profile.totalTrades);
    const completedTrades = this.bnToNumber(profile.completedTrades);
    const disputedTrades = this.bnToNumber(profile.disputedTrades);

    // Calculate rates
    const completionRate = totalTrades > 0 ? (completedTrades / totalTrades) * 100 : 0;
    const disputeRate = totalTrades > 0 ? (disputedTrades / totalTrades) * 100 : 0;

    return {
      totalTrades,
      completedTrades,
      disputedTrades,
      totalBuyVolume: profile.totalBuyVolume,
      totalSellVolume: profile.totalSellVolume,
      activeOffers: profile.activeOffers,
      activeTrades: profile.activeTrades,
      completionRate,
      disputeRate,
    };
  }

  /**
   * Check if a user can create more offers
   *
   * @param owner - User's public key
   * @param maxActiveOffers - Maximum allowed active offers
   * @returns true if user can create more offers
   */
  public async canCreateOffer(owner: PublicKey, maxActiveOffers: number): Promise<boolean> {
    const profile = await this.getProfile(owner);
    if (!profile) return false;
    return profile.activeOffers < maxActiveOffers;
  }

  /**
   * Check if a user can create more trades
   *
   * @param owner - User's public key
   * @param maxActiveTrades - Maximum allowed active trades
   * @returns true if user can create more trades
   */
  public async canCreateTrade(owner: PublicKey, maxActiveTrades: number): Promise<boolean> {
    const profile = await this.getProfile(owner);
    if (!profile) return false;
    return profile.activeTrades < maxActiveTrades;
  }

  /**
   * Get all profiles (WARNING: can be expensive on large datasets)
   *
   * @returns All profiles with their PDAs
   */
  public async getAllProfiles(): Promise<
    Array<{ publicKey: PublicKey; account: UserProfileAccount }>
  > {
    const accounts = await this.getAllAccounts("userProfile");
    return accounts as unknown as Array<{
      publicKey: PublicKey;
      account: UserProfileAccount;
    }>;
  }

  /**
   * Find profiles by reputation threshold
   *
   * @param minReputation - Minimum reputation score (0-10000)
   * @returns Profiles meeting the threshold
   */
  public async getProfilesByReputation(
    minReputation: number
  ): Promise<Array<{ publicKey: PublicKey; account: UserProfileAccount }>> {
    const allProfiles = await this.getAllProfiles();
    return allProfiles.filter((p) => p.account.reputationScore >= minReputation);
  }
}
