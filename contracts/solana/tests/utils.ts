import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  createInitializeAccountInstruction,
  ACCOUNT_SIZE,
} from "@solana/spl-token";

const SPL_TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export async function createTokenMint(
  connection: Connection,
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null = null,
  decimals = 6,
  programId = SPL_TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  const tokenMint = await createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals,
    undefined,
    undefined,
    programId
  );
  return tokenMint;
}

export async function createTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
  programId = SPL_TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  const tokenAccount = await createAccount(
    connection,
    payer,
    mint,
    owner,
    undefined,
    undefined,
    programId
  );
  return tokenAccount;
}

export async function mintTokens(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  authority: Keypair,
  amount: number,
  programId = SPL_TOKEN_PROGRAM_ID
): Promise<void> {
  await mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    amount,
    undefined,
    undefined,
    programId
  );
}

export async function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<number> {
  const account = await getAccount(connection, tokenAccount);
  return Number(account.amount);
}

export async function airdropSol(
  connection: Connection,
  publicKey: PublicKey,
  amount = 1
): Promise<void> {
  const signature = await connection.requestAirdrop(publicKey, amount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(signature);
}

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function assertRejects(promise: Promise<any>, errorCode: string): Promise<void> {
  try {
    await promise;
    throw new Error("Expected promise to reject");
  } catch (err) {
    const anchorError = err as anchor.AnchorError;
    if (!anchorError.error || anchorError.error.errorCode.code !== errorCode) {
      throw err;
    }
  }
}

export async function createRegularTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
  programId = SPL_TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  const newAccount = Keypair.generate();
  const rent = await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);

  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: newAccount.publicKey,
    space: ACCOUNT_SIZE,
    lamports: rent,
    programId,
  });

  const initAccountIx = createInitializeAccountInstruction(
    newAccount.publicKey,
    mint,
    owner,
    programId
  );

  const tx = new anchor.web3.Transaction().add(createAccountIx, initAccountIx);
  const latestBlockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.feePayer = payer.publicKey;
  
  const signature = await connection.sendTransaction(tx, [payer, newAccount]);
  await connection.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });

  return newAccount.publicKey;
} 