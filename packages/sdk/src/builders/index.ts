/**
 * High-level transaction builders for common workflows
 *
 * These builders provide convenience methods for constructing multi-step
 * transactions and handling common patterns in the LocalMoney protocol.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

/**
 * Transaction builder result
 */
export interface BuilderResult {
  /** Built transaction */
  transaction: Transaction;
  /** Instructions in the transaction */
  instructions: TransactionInstruction[];
  /** Signers required (besides fee payer) */
  signers: string[];
  /** Estimated compute units */
  estimatedComputeUnits?: number;
}

/**
 * Check if an associated token account exists
 */
export async function tokenAccountExists(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey
): Promise<boolean> {
  const ata = getAssociatedTokenAddressSync(mint, owner);
  const account = await connection.getAccountInfo(ata);
  return account !== null;
}

/**
 * Get or create ATA instruction if needed
 */
export async function getOrCreateATAInstruction(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): Promise<{
  address: PublicKey;
  instruction: TransactionInstruction | null;
}> {
  const ata = getAssociatedTokenAddressSync(mint, owner);
  const exists = await tokenAccountExists(connection, owner, mint);

  if (exists) {
    return { address: ata, instruction: null };
  }

  const instruction = createAssociatedTokenAccountInstruction(
    payer,
    ata,
    owner,
    mint
  );

  return { address: ata, instruction };
}

/**
 * Build a transaction with proper blockhash and fee payer
 */
export async function buildTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  feePayer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();
  tx.add(...instructions);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = feePayer;

  return tx;
}

/**
 * Estimate transaction compute units
 */
export async function estimateComputeUnits(
  connection: Connection,
  transaction: Transaction,
  signers: PublicKey[]
): Promise<number> {
  try {
    const simulation = await connection.simulateTransaction(transaction);
    return simulation.value.unitsConsumed || 200_000; // Default estimate
  } catch {
    return 200_000; // Default if simulation fails
  }
}

/**
 * Trade flow builder - creates all necessary transactions for a complete trade
 */
export class TradeFlowBuilder {
  constructor(
    private readonly connection: Connection,
    private readonly feePayer: PublicKey
  ) {}

  /**
   * Build escrow funding transaction with ATA creation if needed
   */
  async buildFundEscrowTransaction(params: {
    funderTokenAccount: PublicKey;
    escrowVault: PublicKey;
    tokenMint: PublicKey;
    amount: BN;
  }): Promise<{
    setupInstructions: TransactionInstruction[];
    fundInstruction: TransactionInstruction | null;
  }> {
    const setupInstructions: TransactionInstruction[] = [];

    // Check if escrow vault ATA exists
    const escrowATA = getAssociatedTokenAddressSync(
      params.tokenMint,
      params.escrowVault,
      true // allowOwnerOffCurve for PDA
    );

    const escrowATAExists = await this.connection.getAccountInfo(escrowATA);
    if (!escrowATAExists) {
      setupInstructions.push(
        createAssociatedTokenAccountInstruction(
          this.feePayer,
          escrowATA,
          params.escrowVault,
          params.tokenMint
        )
      );
    }

    // The actual fund instruction will be created by the trade client
    return {
      setupInstructions,
      fundInstruction: null, // To be added by caller
    };
  }

  /**
   * Build release transaction with all fee recipient ATAs
   */
  async buildReleaseTransaction(params: {
    tokenMint: PublicKey;
    recipient: PublicKey;
    treasury: PublicKey;
    warchest: PublicKey;
    arbitrator?: PublicKey;
  }): Promise<{
    setupInstructions: TransactionInstruction[];
    tokenAccounts: {
      recipientATA: PublicKey;
      treasuryATA: PublicKey;
      warchestATA: PublicKey;
      arbitratorATA?: PublicKey;
    };
  }> {
    const setupInstructions: TransactionInstruction[] = [];

    // Check/create recipient ATA
    const recipientResult = await getOrCreateATAInstruction(
      this.connection,
      this.feePayer,
      params.recipient,
      params.tokenMint
    );
    if (recipientResult.instruction) {
      setupInstructions.push(recipientResult.instruction);
    }

    // Check/create treasury ATA
    const treasuryResult = await getOrCreateATAInstruction(
      this.connection,
      this.feePayer,
      params.treasury,
      params.tokenMint
    );
    if (treasuryResult.instruction) {
      setupInstructions.push(treasuryResult.instruction);
    }

    // Check/create warchest ATA
    const warchestResult = await getOrCreateATAInstruction(
      this.connection,
      this.feePayer,
      params.warchest,
      params.tokenMint
    );
    if (warchestResult.instruction) {
      setupInstructions.push(warchestResult.instruction);
    }

    // Check/create arbitrator ATA if provided
    let arbitratorATA: PublicKey | undefined;
    if (params.arbitrator) {
      const arbitratorResult = await getOrCreateATAInstruction(
        this.connection,
        this.feePayer,
        params.arbitrator,
        params.tokenMint
      );
      if (arbitratorResult.instruction) {
        setupInstructions.push(arbitratorResult.instruction);
      }
      arbitratorATA = arbitratorResult.address;
    }

    return {
      setupInstructions,
      tokenAccounts: {
        recipientATA: recipientResult.address,
        treasuryATA: treasuryResult.address,
        warchestATA: warchestResult.address,
        arbitratorATA,
      },
    };
  }
}

/**
 * Batch transaction builder for multiple operations
 */
export class BatchTransactionBuilder {
  private instructions: TransactionInstruction[] = [];
  private signersList: string[] = [];

  constructor(private readonly connection: Connection) {}

  /**
   * Add an instruction to the batch
   */
  addInstruction(
    instruction: TransactionInstruction,
    signers?: string[]
  ): BatchTransactionBuilder {
    this.instructions.push(instruction);
    if (signers) {
      this.signersList.push(...signers);
    }
    return this;
  }

  /**
   * Add multiple instructions to the batch
   */
  addInstructions(
    instructions: TransactionInstruction[],
    signers?: string[]
  ): BatchTransactionBuilder {
    this.instructions.push(...instructions);
    if (signers) {
      this.signersList.push(...signers);
    }
    return this;
  }

  /**
   * Build the final transaction
   */
  async build(feePayer: PublicKey): Promise<BuilderResult> {
    const transaction = await buildTransaction(
      this.connection,
      this.instructions,
      feePayer
    );

    const estimatedUnits = await estimateComputeUnits(
      this.connection,
      transaction,
      [feePayer]
    );

    return {
      transaction,
      instructions: [...this.instructions],
      signers: [...new Set(this.signersList)],
      estimatedComputeUnits: estimatedUnits,
    };
  }

  /**
   * Clear all instructions
   */
  clear(): BatchTransactionBuilder {
    this.instructions = [];
    this.signersList = [];
    return this;
  }

  /**
   * Get current instruction count
   */
  get instructionCount(): number {
    return this.instructions.length;
  }
}

/**
 * Helper to split large batches into multiple transactions
 */
export function splitIntoTransactions(
  instructions: TransactionInstruction[],
  maxInstructionsPerTx: number = 5
): TransactionInstruction[][] {
  const batches: TransactionInstruction[][] = [];
  for (let i = 0; i < instructions.length; i += maxInstructionsPerTx) {
    batches.push(instructions.slice(i, i + maxInstructionsPerTx));
  }
  return batches;
}
