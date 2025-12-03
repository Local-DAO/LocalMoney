/**
 * PDA derivation utilities for the LocalMoney Solana programs
 *
 * All PDA functions return a tuple of [PublicKey, bump] where:
 * - PublicKey is the derived address
 * - bump is the PDA bump seed used for derivation
 *
 * These functions use synchronous derivation via findProgramAddressSync
 * for better performance and simpler usage.
 */

import { PublicKey } from "@solana/web3.js";
import type { BN } from "@coral-xyz/anchor";
import {
  HUB_CONFIG_SEED,
  PROFILE_SEED,
  OFFER_SEED,
  OFFER_COUNTER_SEED,
  TRADE_SEED,
  TRADE_COUNTER_SEED,
  ESCROW_VAULT_SEED,
  ARBITRATOR_SEED,
  DISPUTE_SEED,
  PRICE_PROVIDER_REGISTRY_SEED,
  PRICE_PROVIDER_SEED,
  PRICE_SEED,
} from "./seeds";

export * from "./seeds";

/**
 * Result of PDA derivation
 */
export type PDATuple = [PublicKey, number];

/**
 * Derive the Hub Config PDA
 *
 * Seeds: ["hub_config"]
 *
 * @param programId - Hub program ID
 * @returns PDA address and bump
 */
export function getHubConfigPDA(programId: PublicKey): PDATuple {
  return PublicKey.findProgramAddressSync([Buffer.from(HUB_CONFIG_SEED)], programId);
}

/**
 * Derive a User Profile PDA
 *
 * Seeds: ["profile", user_pubkey]
 *
 * @param user - User's public key
 * @param programId - Profile program ID
 * @returns PDA address and bump
 */
export function getProfilePDA(user: PublicKey, programId: PublicKey): PDATuple {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PROFILE_SEED), user.toBuffer()],
    programId
  );
}

/**
 * Derive an Offer PDA
 *
 * Seeds: ["offer", offer_id (8 bytes LE)]
 *
 * @param offerId - Offer ID as BN
 * @param programId - Offer program ID
 * @returns PDA address and bump
 */
export function getOfferPDA(offerId: BN, programId: PublicKey): PDATuple {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(OFFER_SEED), offerId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

/**
 * Derive the Offer Counter PDA
 *
 * Seeds: ["offer_counter"]
 *
 * @param programId - Offer program ID
 * @returns PDA address and bump
 */
export function getOfferCounterPDA(programId: PublicKey): PDATuple {
  return PublicKey.findProgramAddressSync([Buffer.from(OFFER_COUNTER_SEED)], programId);
}

/**
 * Derive a Trade PDA
 *
 * Seeds: ["trade", trade_id (8 bytes LE)]
 *
 * @param tradeId - Trade ID as BN
 * @param programId - Trade program ID
 * @returns PDA address and bump
 */
export function getTradePDA(tradeId: BN, programId: PublicKey): PDATuple {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TRADE_SEED), tradeId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

/**
 * Derive the Trade Counter PDA
 *
 * Seeds: ["trade_counter"]
 *
 * @param programId - Trade program ID
 * @returns PDA address and bump
 */
export function getTradeCounterPDA(programId: PublicKey): PDATuple {
  return PublicKey.findProgramAddressSync([Buffer.from(TRADE_COUNTER_SEED)], programId);
}

/**
 * Derive an Escrow Vault PDA
 *
 * Seeds: ["escrow_vault", trade_id (8 bytes LE)]
 *
 * @param tradeId - Trade ID as BN
 * @param programId - Escrow program ID
 * @returns PDA address and bump
 */
export function getEscrowVaultPDA(tradeId: BN, programId: PublicKey): PDATuple {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_VAULT_SEED), tradeId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

/**
 * Derive an Arbitrator PDA
 *
 * Seeds: ["arbitrator", arbitrator_pubkey, fiat_currency (3 bytes)]
 *
 * @param arbitrator - Arbitrator's public key
 * @param fiatCurrency - Fiat currency code (3-char string like "USD")
 * @param programId - Arbitrator program ID
 * @returns PDA address and bump
 */
export function getArbitratorPDA(
  arbitrator: PublicKey,
  fiatCurrency: string,
  programId: PublicKey
): PDATuple {
  const fiatBytes = fiatToBytes(fiatCurrency);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ARBITRATOR_SEED), arbitrator.toBuffer(), Buffer.from(fiatBytes)],
    programId
  );
}

/**
 * Derive a Dispute PDA
 *
 * Seeds: ["dispute", trade_id (8 bytes LE)]
 *
 * @param tradeId - Trade ID as BN
 * @param programId - Arbitrator program ID
 * @returns PDA address and bump
 */
export function getDisputePDA(tradeId: BN, programId: PublicKey): PDATuple {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(DISPUTE_SEED), tradeId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

/**
 * Derive the Price Provider Registry PDA
 *
 * Seeds: ["price_provider_registry"]
 *
 * @param programId - Price Oracle program ID
 * @returns PDA address and bump
 */
export function getPriceProviderRegistryPDA(programId: PublicKey): PDATuple {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PRICE_PROVIDER_REGISTRY_SEED)],
    programId
  );
}

/**
 * Derive a Price Provider PDA
 *
 * Seeds: ["price_provider", provider_pubkey]
 *
 * @param provider - Provider's public key
 * @param programId - Price Oracle program ID
 * @returns PDA address and bump
 */
export function getPriceProviderPDA(provider: PublicKey, programId: PublicKey): PDATuple {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PRICE_PROVIDER_SEED), provider.toBuffer()],
    programId
  );
}

/**
 * Derive a Price PDA
 *
 * Seeds: ["price", fiat_currency (3 bytes)]
 *
 * @param fiatCurrency - Fiat currency code (3-char string like "USD")
 * @param programId - Price Oracle program ID
 * @returns PDA address and bump
 */
export function getPricePDA(fiatCurrency: string, programId: PublicKey): PDATuple {
  const fiatBytes = fiatToBytes(fiatCurrency);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PRICE_SEED), Buffer.from(fiatBytes)],
    programId
  );
}

/**
 * Convert a fiat currency string to a 3-byte array
 *
 * @param fiat - Fiat currency code (e.g., "USD")
 * @returns 3-byte array
 */
export function fiatToBytes(fiat: string): number[] {
  const normalized = fiat.toUpperCase().padEnd(3, "\0");
  const bytes = Buffer.from(normalized, "utf-8").slice(0, 3);
  return Array.from(bytes);
}

/**
 * Convert a 3-byte array back to fiat currency string
 *
 * @param bytes - 3-byte array
 * @returns Fiat currency code
 */
export function bytesToFiat(bytes: number[]): string {
  return Buffer.from(bytes)
    .toString("utf-8")
    .replace(/\0/g, "")
    .trim();
}

/**
 * Get all PDAs related to a specific trade
 *
 * @param tradeId - Trade ID
 * @param programIds - Object containing all program IDs
 * @returns Object with all trade-related PDAs
 */
export function getTradeRelatedPDAs(
  tradeId: BN,
  programIds: {
    trade: PublicKey;
    escrow: PublicKey;
    arbitrator: PublicKey;
  }
): {
  trade: PDATuple;
  escrowVault: PDATuple;
  dispute: PDATuple;
} {
  return {
    trade: getTradePDA(tradeId, programIds.trade),
    escrowVault: getEscrowVaultPDA(tradeId, programIds.escrow),
    dispute: getDisputePDA(tradeId, programIds.arbitrator),
  };
}

/**
 * Get all PDAs related to a specific offer
 *
 * @param offerId - Offer ID
 * @param programId - Offer program ID
 * @returns Object with offer PDA
 */
export function getOfferRelatedPDAs(
  offerId: BN,
  programId: PublicKey
): {
  offer: PDATuple;
} {
  return {
    offer: getOfferPDA(offerId, programId),
  };
}

/**
 * Get all PDAs related to a specific user
 *
 * @param user - User's public key
 * @param programId - Profile program ID
 * @returns Object with profile PDA
 */
export function getUserRelatedPDAs(
  user: PublicKey,
  programId: PublicKey
): {
  profile: PDATuple;
} {
  return {
    profile: getProfilePDA(user, programId),
  };
}

/**
 * Validate that a public key is a valid PDA with expected seeds
 *
 * @param address - Address to validate
 * @param seeds - Expected seeds
 * @param programId - Program ID
 * @returns true if the address matches the derived PDA
 */
export function validatePDA(
  address: PublicKey,
  seeds: (Buffer | Uint8Array)[],
  programId: PublicKey
): boolean {
  try {
    const [expectedPDA] = PublicKey.findProgramAddressSync(seeds, programId);
    return address.equals(expectedPDA);
  } catch {
    return false;
  }
}
