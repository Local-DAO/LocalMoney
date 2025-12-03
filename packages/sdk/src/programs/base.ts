/**
 * Base program client class
 *
 * Provides shared functionality for all program-specific clients:
 * - Connection management
 * - Provider handling
 * - Account fetching
 * - Error parsing
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider, BN, type Idl } from "@coral-xyz/anchor";
import { LocalMoneyError, parseAnchorError } from "../errors";

/**
 * Wallet adapter interface compatible with @solana/wallet-adapter
 */
export interface WalletAdapter {
  publicKey: PublicKey | null;
  signTransaction<T extends Transaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction>(txs: T[]): Promise<T[]>;
}

/**
 * Options for program client initialization
 */
export interface ProgramClientOptions {
  /** Solana connection */
  connection: Connection;
  /** Wallet adapter (optional for read-only mode) */
  wallet?: WalletAdapter | null;
  /** Program ID */
  programId: PublicKey;
}

/**
 * Transaction result
 */
export interface TransactionResult {
  /** Transaction signature */
  signature: string;
  /** Confirmed slot */
  slot?: number;
}

/**
 * Abstract base class for all program clients
 *
 * @typeParam T - IDL type for the program
 */
export abstract class BaseProgram<T extends Idl> {
  protected readonly connection: Connection;
  protected readonly programId: PublicKey;
  protected provider: AnchorProvider | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected program: Program<any> | null = null;
  protected wallet: WalletAdapter | null = null;

  constructor(options: ProgramClientOptions, protected readonly idl: T) {
    this.connection = options.connection;
    this.programId = options.programId;

    if (options.wallet) {
      this.setWallet(options.wallet);
    } else {
      // Create read-only program instance
      this.initializeReadOnly();
    }
  }

  /**
   * Deep clone IDL to avoid Proxy issues with Vue reactivity
   */
  private cloneIdl(): T {
    return JSON.parse(JSON.stringify(this.idl)) as T;
  }

  /**
   * Initialize in read-only mode (no wallet)
   */
  private initializeReadOnly(): void {
    // Create a dummy keypair for read-only access
    const dummyKeypair = Keypair.generate();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dummyWallet: any = {
      publicKey: dummyKeypair.publicKey,
      signTransaction: async () => {
        throw new Error("Wallet not connected");
      },
      signAllTransactions: async () => {
        throw new Error("Wallet not connected");
      },
      payer: dummyKeypair,
    };

    this.provider = new AnchorProvider(this.connection, dummyWallet, {
      commitment: "confirmed",
    });

    // Clone IDL to avoid Vue Proxy issues
    this.program = new Program(this.cloneIdl(), this.provider);
  }

  /**
   * Set the wallet and reinitialize the provider
   *
   * @param wallet - Wallet adapter
   */
  public setWallet(wallet: WalletAdapter): void {
    if (!wallet.publicKey) {
      throw new LocalMoneyError("Wallet not connected", "WALLET_NOT_CONNECTED");
    }

    this.wallet = wallet;

    // Create wallet wrapper for Anchor using a dummy keypair
    const dummyKeypair = Keypair.generate();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anchorWallet: any = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction.bind(wallet),
      signAllTransactions: wallet.signAllTransactions.bind(wallet),
      payer: dummyKeypair,
    };

    this.provider = new AnchorProvider(this.connection, anchorWallet, {
      commitment: "confirmed",
    });

    // Clone IDL to avoid Vue Proxy issues
    this.program = new Program(this.cloneIdl(), this.provider);
  }

  /**
   * Clear the wallet (switch to read-only mode)
   */
  public clearWallet(): void {
    this.wallet = null;
    this.initializeReadOnly();
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

  /**
   * Get the program instance
   *
   * @throws Error if program not initialized
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getProgram(): Program<any> {
    if (!this.program) {
      throw new LocalMoneyError("Program not initialized", "PROGRAM_NOT_INITIALIZED");
    }
    return this.program;
  }

  /**
   * Require wallet connection for write operations
   *
   * @throws Error if wallet not connected
   */
  protected requireWallet(): void {
    if (!this.isConnected) {
      throw new LocalMoneyError(
        "Wallet not connected. Connect a wallet to perform this operation.",
        "WALLET_NOT_CONNECTED"
      );
    }
  }

  /**
   * Fetch a single account with proper deserialization
   *
   * @param pda - Account PDA
   * @param accountName - Name of the account type in IDL
   * @returns Account data or null if not found
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async fetchAccount(pda: PublicKey, accountName: string): Promise<any | null> {
    try {
      const program = this.getProgram();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountInfo = await (program.account as any)[accountName].fetch(pda);
      return accountInfo;
    } catch (error) {
      // Check if account doesn't exist
      if (this.isAccountNotFoundError(error)) {
        return null;
      }
      throw this.parseError(error);
    }
  }

  /**
   * Fetch multiple accounts in a single RPC call
   *
   * @param pdas - Array of account PDAs
   * @param accountName - Name of the account type in IDL
   * @returns Array of account data (null for missing accounts)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async fetchAccounts(pdas: PublicKey[], accountName: string): Promise<any[]> {
    try {
      const program = this.getProgram();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accounts = await (program.account as any)[accountName].fetchMultiple(pdas);
      return accounts;
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Check if an account exists
   *
   * @param pda - Account PDA
   * @returns true if account exists
   */
  protected async accountExists(pda: PublicKey): Promise<boolean> {
    const accountInfo = await this.connection.getAccountInfo(pda);
    return accountInfo !== null;
  }

  /**
   * Get all accounts of a specific type using getProgramAccounts
   *
   * @param accountName - Name of the account type
   * @param filters - Optional memcmp filters
   * @returns Array of accounts with their public keys
   */
  protected async getAllAccounts(
    accountName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filters?: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Array<{ publicKey: PublicKey; account: any }>> {
    try {
      const program = this.getProgram();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accounts = await (program.account as any)[accountName].all(filters);
      return accounts;
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Send and confirm a transaction
   *
   * @param tx - Transaction to send
   * @returns Transaction signature
   */
  protected async sendTransaction(tx: Transaction): Promise<TransactionResult> {
    this.requireWallet();

    try {
      if (!this.provider) {
        throw new LocalMoneyError("Provider not initialized", "PROVIDER_NOT_INITIALIZED");
      }

      const signature = await this.provider.sendAndConfirm(tx);
      const txInfo = await this.connection.getTransaction(signature, {
        commitment: "confirmed",
      });

      return {
        signature,
        slot: txInfo?.slot,
      };
    } catch (error) {
      throw this.parseError(error);
    }
  }

  /**
   * Build a transaction from instructions
   *
   * @param instructions - Transaction instructions
   * @returns Unsigned transaction
   */
  protected async buildTransaction(instructions: TransactionInstruction[]): Promise<Transaction> {
    const tx = new Transaction();
    tx.add(...instructions);

    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    if (this.wallet?.publicKey) {
      tx.feePayer = this.wallet.publicKey;
    }

    return tx;
  }

  /**
   * Check if an error indicates account not found
   */
  protected isAccountNotFoundError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes("Account does not exist") ||
        error.message.includes("could not find account") ||
        error.message.includes("AccountNotFound")
      );
    }
    return false;
  }

  /**
   * Parse and wrap errors with LocalMoneyError
   *
   * @param error - Original error
   * @returns LocalMoneyError with parsed details
   */
  protected parseError(error: unknown): LocalMoneyError {
    // Already a LocalMoneyError
    if (error instanceof LocalMoneyError) {
      return error;
    }

    // Try to parse as Anchor error
    const anchorError = parseAnchorError(error);
    if (anchorError) {
      return anchorError;
    }

    // Wrap generic error
    if (error instanceof Error) {
      return new LocalMoneyError(error.message, "UNKNOWN_ERROR");
    }

    return new LocalMoneyError(String(error), "UNKNOWN_ERROR");
  }

  /**
   * Convert BN to number safely
   *
   * @param bn - BN value
   * @returns number (throws if too large)
   */
  protected bnToNumber(bn: BN): number {
    if (bn.gt(new BN(Number.MAX_SAFE_INTEGER))) {
      throw new LocalMoneyError("Number too large to convert safely", "NUMBER_OVERFLOW");
    }
    return bn.toNumber();
  }
}
