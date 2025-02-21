import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';

export async function airdropSol(
  connection: Connection,
  publicKey: PublicKey,
  amount: number = 1
): Promise<void> {
  try {
    const signature = await connection.requestAirdrop(publicKey, amount * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);
  } catch (error) {
    console.error('Error airdropping SOL:', error);
    throw error;
  }
}

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function createTokenMint(
  connection: Connection,
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number
): Promise<PublicKey> {
  try {
    return await createMint(
      connection,
      payer,
      mintAuthority,
      freezeAuthority,
      decimals
    );
  } catch (error) {
    console.error('Error creating token mint:', error);
    throw error;
  }
}

export async function createTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  try {
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      owner,
      false,
      undefined,
      undefined,
      tokenProgramId
    );
    return tokenAccount.address;
  } catch (error) {
    console.error('Error creating token account:', error);
    throw error;
  }
}

export async function mintTokens(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  authority: Keypair,
  amount: number,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID
): Promise<void> {
  try {
    await mintTo(
      connection,
      payer,
      mint,
      destination,
      authority,
      amount,
      [],
      undefined,
      tokenProgramId
    );
  } catch (error) {
    console.error('Error minting tokens:', error);
    throw error;
  }
}

export async function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<number> {
  try {
    const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
    return Number(accountInfo.value.amount);
  } catch (error) {
    console.error('Error getting token balance:', error);
    throw error;
  }
} 