/**
 * Protocol constants and program IDs for the LocalMoney Solana programs
 */

import { PublicKey, clusterApiUrl } from "@solana/web3.js";

/**
 * Protocol constants matching Rust program definitions
 */

/** Basis points denominator (10000 = 100%) */
export const BASIS_POINTS = 10000;

/** Maximum total fee percentage (1000 = 10%) */
export const MAX_TOTAL_FEE_PCT = 1000;

/** USD cents decimals */
export const USD_CENTS_DECIMALS = 2;

/** Maximum contact info length */
export const MAX_CONTACT_INFO_LENGTH = 280;

/** Maximum description length */
export const MAX_DESCRIPTION_LENGTH = 280;

/** Maximum evidence length for disputes */
export const MAX_EVIDENCE_LENGTH = 500;

/** Token decimals (standard SPL token) */
export const DEFAULT_TOKEN_DECIMALS = 6;

/** Price decimals (8 decimals for precision) */
export const PRICE_DECIMALS = 8;

/**
 * Program IDs for different networks
 */

/**
 * Localnet/Devnet program IDs
 */
export const LOCALNET_PROGRAM_IDS = {
  HUB: new PublicKey("8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH"),
  PROFILE: new PublicKey("86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5"),
  OFFER: new PublicKey("CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo"),
  TRADE: new PublicKey("5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE"),
  ESCROW: new PublicKey("CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ"),
  ARBITRATOR: new PublicKey("J5BNGJ128bxHuWemwaoGkDqy8DVSvsA7o5kpdy9eDoNe"),
  PRICE_ORACLE: new PublicKey("CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw"),
} as const;

/**
 * Devnet program IDs (same as localnet for now)
 */
export const DEVNET_PROGRAM_IDS = { ...LOCALNET_PROGRAM_IDS } as const;

/**
 * Mainnet program IDs (to be updated after mainnet deployment)
 */
export const MAINNET_PROGRAM_IDS = {
  HUB: new PublicKey("11111111111111111111111111111111"), // Placeholder
  PROFILE: new PublicKey("11111111111111111111111111111111"), // Placeholder
  OFFER: new PublicKey("11111111111111111111111111111111"), // Placeholder
  TRADE: new PublicKey("11111111111111111111111111111111"), // Placeholder
  ESCROW: new PublicKey("11111111111111111111111111111111"), // Placeholder
  ARBITRATOR: new PublicKey("11111111111111111111111111111111"), // Placeholder
  PRICE_ORACLE: new PublicKey("11111111111111111111111111111111"), // Placeholder
} as const;

/**
 * Network identifiers
 */
export type NetworkName = "localnet" | "devnet" | "mainnet-beta";

/**
 * Program ID type
 */
export type ProgramIds = typeof LOCALNET_PROGRAM_IDS;

/**
 * Get program IDs for a specific network
 *
 * @param network - Network name
 * @returns Program IDs for the network
 */
export function getProgramIds(network: NetworkName): ProgramIds {
  switch (network) {
    case "localnet":
      return LOCALNET_PROGRAM_IDS;
    case "devnet":
      return DEVNET_PROGRAM_IDS;
    case "mainnet-beta":
      return MAINNET_PROGRAM_IDS;
    default:
      throw new Error(`Unknown network: ${network as string}`);
  }
}

/**
 * Default RPC endpoints
 */
export const RPC_ENDPOINTS = {
  localnet: "http://localhost:8899",
  devnet: clusterApiUrl("devnet"),
  "mainnet-beta": clusterApiUrl("mainnet-beta"),
} as const;

/**
 * Supported fiat currencies (ISO 4217 codes)
 */
export const SUPPORTED_FIAT_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "INR",
  "BRL",
  "MXN",
  "KRW",
  "SGD",
  "HKD",
  "NOK",
  "SEK",
  "DKK",
  "NZD",
  "ZAR",
  "AED",
] as const;

export type SupportedFiatCurrency = (typeof SUPPORTED_FIAT_CURRENCIES)[number];

/**
 * Check if a fiat currency is supported
 */
export function isSupportedFiatCurrency(currency: string): currency is SupportedFiatCurrency {
  return SUPPORTED_FIAT_CURRENCIES.includes(currency.toUpperCase() as SupportedFiatCurrency);
}

/**
 * Common token mints (for devnet/mainnet)
 */
export const COMMON_TOKEN_MINTS = {
  // Native SOL wrapped
  WSOL: new PublicKey("So11111111111111111111111111111111111111112"),
  // USDC (devnet)
  USDC_DEVNET: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  // USDC (mainnet)
  USDC_MAINNET: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
} as const;

/**
 * SPL Token Program ID
 */
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/**
 * Associated Token Program ID
 */
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

/**
 * System Program ID
 */
export const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");
