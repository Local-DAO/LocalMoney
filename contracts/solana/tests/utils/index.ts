import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

// Re-export BN from anchor module
const { BN } = anchor;
type BN = anchor.BN;

/**
 * PDA Derivation Helpers
 */

export async function getHubConfigPDA(programId: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync([Buffer.from("hub_config")], programId);
}

export async function getProfilePDA(
  user: PublicKey,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync([Buffer.from("profile"), user.toBuffer()], programId);
}

export async function getOfferPDA(
  offerId: BN,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("offer"), offerId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

export async function getOfferCounterPDA(programId: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync([Buffer.from("offer_counter")], programId);
}

export async function getTradePDA(
  tradeId: BN,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("trade"), tradeId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

export async function getTradeCounterPDA(programId: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync([Buffer.from("trade_counter")], programId);
}

export async function getEscrowVaultPDA(
  tradeId: BN,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_vault"), tradeId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

export async function getArbitratorPDA(
  arbitrator: PublicKey,
  fiatCurrency: string,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("arbitrator"), arbitrator.toBuffer(), Buffer.from(fiatCurrency)],
    programId
  );
}

export async function getPricePDA(
  fiatCurrency: string,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("price"), Buffer.from(fiatCurrency)],
    programId
  );
}

export async function getPriceProviderRegistryPDA(
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("price_provider_registry")],
    programId
  );
}

export async function getPriceProviderPDA(
  provider: PublicKey,
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("price_provider"), provider.toBuffer()],
    programId
  );
}

/**
 * Test Helpers
 */

export async function airdrop(
  connection: anchor.web3.Connection,
  address: PublicKey,
  amount: number = 10 * anchor.web3.LAMPORTS_PER_SOL
): Promise<void> {
  const signature = await connection.requestAirdrop(address, amount);
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature,
    ...latestBlockhash,
  });
}

export async function createTestToken(
  connection: anchor.web3.Connection,
  payer: Keypair,
  decimals: number = 6
): Promise<PublicKey> {
  return await createMint(connection, payer, payer.publicKey, payer.publicKey, decimals);
}

export async function mintTestTokens(
  connection: anchor.web3.Connection,
  payer: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  amount: number
): Promise<void> {
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    destination
  );

  await mintTo(connection, payer, mint, tokenAccount.address, payer, amount);
}

export function fiatToBytes(fiat: string): number[] {
  const bytes = Buffer.from(fiat.toUpperCase().padEnd(3, "\0"), "utf-8").slice(0, 3);
  return Array.from(bytes);
}

export function bytesToFiat(bytes: number[]): string {
  return Buffer.from(bytes).toString("utf-8").replace(/\0/g, "");
}

/**
 * Constants
 */

export const BASIS_POINTS = 10000;
export const MAX_TOTAL_FEE_PCT = 1000; // 10%
export const USD_CENTS_DECIMALS = 2;

/**
 * Test User Management
 */

export class TestUser {
  keypair: Keypair;
  publicKey: PublicKey;

  constructor() {
    this.keypair = Keypair.generate();
    this.publicKey = this.keypair.publicKey;
  }

  async airdrop(connection: anchor.web3.Connection, amount?: number): Promise<void> {
    await airdrop(connection, this.publicKey, amount);
  }
}

/**
 * Program ID constants (will be updated after deployment)
 */
export const PROGRAM_IDS = {
  HUB: new PublicKey("8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH"),
  PROFILE: new PublicKey("86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5"),
  OFFER: new PublicKey("CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo"),
  TRADE: new PublicKey("5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE"),
  ESCROW: new PublicKey("CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ"),
  ARBITRATOR: new PublicKey("J5BNGJ128bxHuWemwaoGkDqy8DVSvsA7o5kpdy9eDoNe"),
  PRICE_ORACLE: new PublicKey("CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw"),
};
