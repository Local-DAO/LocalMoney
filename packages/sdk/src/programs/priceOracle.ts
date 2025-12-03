/**
 * Price Oracle Program Client
 *
 * The Price Oracle program manages fiat exchange rates from trusted providers.
 */

import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { BaseProgram, type ProgramClientOptions, type TransactionResult } from "./base";
import {
  getPriceProviderRegistryPDA,
  getPriceProviderPDA,
  getPricePDA,
  fiatToBytes,
  bytesToFiat,
} from "../pdas";
import { LocalMoneyError, LocalMoneyErrorCode } from "../errors";
import type { PriceOracle as PriceOracleIDL } from "../types/generated/price_oracle";
import type {
  PriceAccount,
  PriceProviderAccount,
  PriceProviderRegistryAccount,
  InitializeRegistryParams,
  UpdatePriceParams,
} from "../types";

// Import the IDL
import priceOracleIdl from "../idl/price_oracle.json";

/**
 * Price Oracle program client options
 */
export interface PriceOracleClientOptions extends Omit<ProgramClientOptions, "programId"> {
  programId?: PublicKey;
}

/**
 * Price display format
 */
export interface PriceDisplay {
  fiatCurrency: string;
  price: number;
  priceString: string;
  updatedAt: Date;
  provider: string;
  isStale: boolean;
}

/**
 * Price Oracle program client for fiat exchange rates
 */
export class PriceOracleClient extends BaseProgram<PriceOracleIDL> {
  constructor(options: PriceOracleClientOptions & { programId: PublicKey }) {
    super(
      {
        connection: options.connection,
        wallet: options.wallet,
        programId: options.programId,
      },
      priceOracleIdl as unknown as PriceOracleIDL
    );
  }

  /**
   * Create a new PriceOracleClient instance
   */
  static create(
    options: PriceOracleClientOptions & { programId: PublicKey }
  ): PriceOracleClient {
    return new PriceOracleClient(options);
  }

  /**
   * Get the price provider registry PDA
   */
  public getRegistryPDA(): { pda: PublicKey; bump: number } {
    const [pda, bump] = getPriceProviderRegistryPDA(this.programId);
    return { pda, bump };
  }

  /**
   * Get a price provider PDA
   */
  public getPriceProviderPDA(provider: PublicKey): { pda: PublicKey; bump: number } {
    const [pda, bump] = getPriceProviderPDA(provider, this.programId);
    return { pda, bump };
  }

  /**
   * Get a price PDA
   */
  public getPricePDA(fiatCurrency: string): { pda: PublicKey; bump: number } {
    const [pda, bump] = getPricePDA(fiatCurrency, this.programId);
    return { pda, bump };
  }

  /**
   * Fetch the price provider registry
   */
  public async getRegistry(): Promise<PriceProviderRegistryAccount | null> {
    const { pda } = this.getRegistryPDA();
    const account = await this.fetchAccount(pda, "priceProviderRegistry");
    return account as unknown as PriceProviderRegistryAccount | null;
  }

  /**
   * Fetch a price provider
   */
  public async getPriceProvider(
    provider: PublicKey
  ): Promise<PriceProviderAccount | null> {
    const { pda } = this.getPriceProviderPDA(provider);
    const account = await this.fetchAccount(pda, "priceProvider");
    return account as unknown as PriceProviderAccount | null;
  }

  /**
   * Fetch a price for a fiat currency
   */
  public async getPrice(fiatCurrency: string): Promise<PriceAccount | null> {
    const { pda } = this.getPricePDA(fiatCurrency);
    const account = await this.fetchAccount(pda, "price");
    return account as unknown as PriceAccount | null;
  }

  /**
   * Initialize the price provider registry (admin only)
   */
  public async initializeRegistry(
    params: InitializeRegistryParams
  ): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: registry } = this.getRegistryPDA();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .initializeRegistry({ maxPriceStaleness: params.maxPriceStaleness })
        .accounts({
          registry,
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
   * Register a price provider (admin only)
   */
  public async registerProvider(provider: PublicKey): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: registry } = this.getRegistryPDA();
    const { pda: priceProvider } = this.getPriceProviderPDA(provider);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .registerProvider()
        .accounts({
          registry,
          priceProvider,
          providerPubkey: provider,
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
   * Remove a price provider (admin only)
   */
  public async removeProvider(provider: PublicKey): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: registry } = this.getRegistryPDA();
    const { pda: priceProvider } = this.getPriceProviderPDA(provider);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .removeProvider()
        .accounts({
          registry,
          priceProvider,
          admin: this.walletPublicKey!,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Initialize a price for a fiat currency (provider only)
   */
  public async initializePrice(
    fiatCurrency: string,
    initialPrice: BN
  ): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: registry } = this.getRegistryPDA();
    const { pda: priceProvider } = this.getPriceProviderPDA(this.walletPublicKey!);
    const { pda: price } = this.getPricePDA(fiatCurrency);

    const fiatBytes = fiatToBytes(fiatCurrency);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .initializePrice({ fiatCurrency: fiatBytes, price: initialPrice })
        .accounts({
          registry,
          priceProvider,
          price,
          provider: this.walletPublicKey!,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Update a price (provider only)
   */
  public async updatePrice(
    fiatCurrency: string,
    newPrice: BN
  ): Promise<TransactionResult> {
    this.requireWallet();

    const program = this.getProgram();
    const { pda: registry } = this.getRegistryPDA();
    const { pda: priceProvider } = this.getPriceProviderPDA(this.walletPublicKey!);
    const { pda: price } = this.getPricePDA(fiatCurrency);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)
        .updatePrice({ price: newPrice })
        .accounts({
          registry,
          priceProvider,
          price,
          provider: this.walletPublicKey!,
        })
        .transaction();

      return this.sendTransaction(tx);
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Get all registered prices
   */
  public async getAllPrices(): Promise<
    Array<{ publicKey: PublicKey; account: PriceAccount }>
  > {
    const accounts = await this.getAllAccounts("price");
    return accounts.map((a) => ({
      publicKey: a.publicKey,
      account: a.account as unknown as PriceAccount,
    }));
  }

  /**
   * Get all active price providers
   */
  public async getActiveProviders(): Promise<
    Array<{ publicKey: PublicKey; account: PriceProviderAccount }>
  > {
    const allProviders = await this.getAllAccounts("priceProvider");
    return allProviders
      .filter((p) => (p.account as unknown as PriceProviderAccount).isActive)
      .map((p) => ({
        publicKey: p.publicKey,
        account: p.account as unknown as PriceProviderAccount,
      }));
  }

  /**
   * Check if a price is stale
   */
  public async isPriceStale(
    fiatCurrency: string,
    maxStaleness?: number
  ): Promise<boolean> {
    const price = await this.getPrice(fiatCurrency);
    if (!price) return true;

    let maxStalenessSecs: number;
    if (maxStaleness !== undefined) {
      maxStalenessSecs = maxStaleness;
    } else {
      const registry = await this.getRegistry();
      if (!registry) return true;
      maxStalenessSecs = this.bnToNumber(registry.maxPriceStaleness);
    }

    const now = Math.floor(Date.now() / 1000);
    const updatedAt = this.bnToNumber(price.lastUpdatedAt);
    return now - updatedAt > maxStalenessSecs;
  }

  /**
   * Get price with staleness check
   */
  public async getPriceWithValidation(
    fiatCurrency: string
  ): Promise<{ price: PriceAccount; isStale: boolean }> {
    const price = await this.getPrice(fiatCurrency);
    if (!price) {
      throw new LocalMoneyError(
        `Price not found for ${fiatCurrency}`,
        LocalMoneyErrorCode.ACCOUNT_NOT_FOUND
      );
    }

    const isStale = await this.isPriceStale(fiatCurrency);
    return { price, isStale };
  }

  /**
   * Format price for display
   * Price is stored with 8 decimals
   */
  public formatPriceForDisplay(
    priceAccount: PriceAccount,
    maxStaleness?: number
  ): PriceDisplay {
    const priceValue = this.bnToNumber(priceAccount.value) / 100_000_000;
    const updatedAt = new Date(this.bnToNumber(priceAccount.lastUpdatedAt) * 1000);

    let isStale = false;
    if (maxStaleness !== undefined) {
      const now = Math.floor(Date.now() / 1000);
      const updateTime = this.bnToNumber(priceAccount.lastUpdatedAt);
      isStale = now - updateTime > maxStaleness;
    }

    return {
      fiatCurrency: bytesToFiat(priceAccount.fiatCurrency),
      price: priceValue,
      priceString: `$${priceValue.toFixed(8)}`,
      updatedAt,
      provider: priceAccount.lastProvider.toBase58(),
      isStale,
    };
  }

  /**
   * Convert token amount to fiat using price
   *
   * @param tokenAmount - Token amount in lamports
   * @param fiatCurrency - Fiat currency code
   * @param tokenDecimals - Token decimals (default 6)
   * @returns Fiat amount in cents
   */
  public async convertToFiat(
    tokenAmount: BN,
    fiatCurrency: string,
    tokenDecimals: number = 6
  ): Promise<BN> {
    const price = await this.getPrice(fiatCurrency);
    if (!price) {
      throw new LocalMoneyError(
        `Price not found for ${fiatCurrency}`,
        LocalMoneyErrorCode.ACCOUNT_NOT_FOUND
      );
    }

    // Price is in USD cents with 8 decimals
    // Token amount is in lamports
    // Result should be in fiat cents

    const divisor = new BN(10).pow(new BN(tokenDecimals));
    const priceBN = price.value;

    // (tokenAmount * price) / (10^tokenDecimals * 10^8) * 100 = cents
    // Simplified: (tokenAmount * price * 100) / (10^tokenDecimals * 10^8)
    const result = tokenAmount
      .mul(priceBN)
      .mul(new BN(100))
      .div(divisor.mul(new BN(100_000_000)));

    return result;
  }

  /**
   * Convert fiat to token amount using price
   *
   * @param fiatCents - Fiat amount in cents
   * @param fiatCurrency - Fiat currency code
   * @param tokenDecimals - Token decimals (default 6)
   * @returns Token amount in lamports
   */
  public async convertFromFiat(
    fiatCents: BN,
    fiatCurrency: string,
    tokenDecimals: number = 6
  ): Promise<BN> {
    const price = await this.getPrice(fiatCurrency);
    if (!price) {
      throw new LocalMoneyError(
        `Price not found for ${fiatCurrency}`,
        LocalMoneyErrorCode.ACCOUNT_NOT_FOUND
      );
    }

    const multiplier = new BN(10).pow(new BN(tokenDecimals));
    const priceBN = price.value;

    // (fiatCents * 10^tokenDecimals * 10^8) / (price * 100)
    const result = fiatCents
      .mul(multiplier)
      .mul(new BN(100_000_000))
      .div(priceBN.mul(new BN(100)));

    return result;
  }
}
