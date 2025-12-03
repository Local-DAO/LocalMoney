/**
 * Instruction parameter types for the LocalMoney programs
 */

import type { BN } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";

/**
 * Parameters for initializing the Hub
 */
export interface InitializeHubParams {
  /** Offer program ID */
  offerProgram: PublicKey;
  /** Trade program ID */
  tradeProgram: PublicKey;
  /** Profile program ID */
  profileProgram: PublicKey;
  /** Escrow program ID */
  escrowProgram: PublicKey;
  /** Arbitrator program ID */
  arbitratorProgram: PublicKey;
  /** Price Oracle program ID */
  priceOracleProgram: PublicKey;
  /** Burn fee percentage (basis points) */
  burnFeePct: number;
  /** Chain fee percentage (basis points) */
  chainFeePct: number;
  /** Warchest fee percentage (basis points) */
  warchestFeePct: number;
  /** Conversion fee percentage (basis points) */
  conversionFeePct: number;
  /** Arbitrator fee percentage (basis points) */
  arbitratorFeePct: number;
  /** Minimum trade amount in USD cents */
  minTradeAmount: BN;
  /** Maximum trade amount in USD cents */
  maxTradeAmount: BN;
  /** Maximum active offers per user */
  maxActiveOffers: number;
  /** Maximum active trades per user */
  maxActiveTrades: number;
  /** Trade expiration timer in seconds */
  tradeExpirationTimer: BN;
  /** Trade dispute timer in seconds */
  tradeDisputeTimer: BN;
  /** Treasury address */
  treasury: PublicKey;
  /** Warchest address */
  warchest: PublicKey;
}

/**
 * Parameters for updating Hub config (all optional)
 */
export interface UpdateHubConfigParams {
  burnFeePct?: number;
  chainFeePct?: number;
  warchestFeePct?: number;
  conversionFeePct?: number;
  arbitratorFeePct?: number;
  minTradeAmount?: BN;
  maxTradeAmount?: BN;
  maxActiveOffers?: number;
  maxActiveTrades?: number;
  tradeExpirationTimer?: BN;
  tradeDisputeTimer?: BN;
  treasury?: PublicKey;
  warchest?: PublicKey;
}

/**
 * Parameters for setting circuit breaker flags
 */
export interface SetCircuitBreakerParams {
  globalPause?: boolean;
  pauseNewOffers?: boolean;
  pauseNewTrades?: boolean;
  pauseEscrowFunding?: boolean;
  pauseEscrowRelease?: boolean;
}

/**
 * Parameters for creating a profile
 */
export interface CreateProfileParams {
  /** Encrypted contact information */
  contactInfo: string;
  /** Encryption key */
  encryptionKey: string;
}

/**
 * Parameters for updating profile contact
 */
export interface UpdateContactParams {
  /** New encrypted contact information */
  contactInfo: string;
  /** New encryption key */
  encryptionKey: string;
}

/**
 * Parameters for creating an offer
 */
export interface CreateOfferParams {
  /** Offer type (Buy or Sell) */
  offerType: { buy: unknown } | { sell: unknown };
  /** Fiat currency code (3-byte ASCII) */
  fiatCurrency: number[];
  /** Token mint address */
  tokenMint: PublicKey;
  /** Minimum amount in token lamports */
  minAmount: BN;
  /** Maximum amount in token lamports */
  maxAmount: BN;
  /** Exchange rate (fiat cents per token unit) */
  rate: BN;
  /** Description (max 280 chars) */
  description: string;
}

/**
 * Parameters for updating an offer
 */
export interface UpdateOfferParams {
  /** New minimum amount (optional) */
  minAmount?: BN;
  /** New maximum amount (optional) */
  maxAmount?: BN;
  /** New exchange rate (optional) */
  rate?: BN;
  /** New description (optional) */
  description?: string;
}

/**
 * Parameters for creating a trade
 */
export interface CreateTradeParams {
  /** Offer ID to trade against */
  offerId: BN;
  /** Token amount in lamports */
  amount: BN;
  /** Fiat amount in cents */
  fiatAmount: BN;
  /** Buyer's encrypted contact info */
  buyerContact: string;
}

/**
 * Parameters for accepting a trade
 */
export interface AcceptTradeParams {
  /** Seller's encrypted contact info */
  sellerContact: string;
}

/**
 * Parameters for submitting dispute evidence
 */
export interface SubmitEvidenceParams {
  /** Evidence text (max 500 chars) */
  evidence: string;
}

/**
 * Parameters for resolving a dispute
 */
export interface ResolveDisputeParams {
  /** Resolution outcome */
  resolution: { buyerWins: unknown } | { sellerWins: unknown };
}

/**
 * Parameters for updating price
 */
export interface UpdatePriceParams {
  /** New price in USD cents with 8 decimals */
  price: BN;
}

/**
 * Parameters for initializing price registry
 */
export interface InitializeRegistryParams {
  /** Maximum price staleness in seconds */
  maxPriceStaleness: BN;
}
