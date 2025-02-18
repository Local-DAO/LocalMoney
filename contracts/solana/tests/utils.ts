import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";

export async function createTokenMint(
  connection: Connection,
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null = null,
  decimals = 6
): Promise<PublicKey> {
  const tokenMint = await createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );
  return tokenMint;
}

export async function createTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const tokenAccount = await createAccount(
    connection,
    payer,
    mint,
    owner,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );
  return tokenAccount;
}

export async function mintTokens(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  authority: Keypair,
  amount: number
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
    TOKEN_PROGRAM_ID
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
  address: PublicKey,
  amount: number = 10
): Promise<void> {
  const signature = await connection.requestAirdrop(address, amount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(signature);
}

export function delay(ms: number): Promise<void> {
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