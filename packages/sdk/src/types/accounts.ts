/**
 * Account state types with better documentation
 * These wrap the generated Anchor types for improved DX
 */

import { PublicKey } from "@solana/web3.js";
import type { BN } from "@coral-xyz/anchor";
import { OfferType, OfferState, TradeState } from "./enums";

/**
 * Hub configuration account - central protocol settings
 */
export interface HubConfigAccount {
  /** PDA bump seed */
  bump: number;
  /** Admin authority public key */
  admin: PublicKey;
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
  /** Burn fee percentage (basis points, 10000 = 100%) */
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
  /** Global pause flag */
  globalPause: boolean;
  /** Pause new offers flag */
  pauseNewOffers: boolean;
  /** Pause new trades flag */
  pauseNewTrades: boolean;
  /** Pause escrow funding flag */
  pauseEscrowFunding: boolean;
  /** Pause escrow release flag */
  pauseEscrowRelease: boolean;
  /** Treasury address */
  treasury: PublicKey;
  /** Warchest address */
  warchest: PublicKey;
}

/**
 * User profile account - reputation and trading stats
 */
export interface UserProfileAccount {
  /** PDA bump seed */
  bump: number;
  /** Profile owner public key */
  owner: PublicKey;
  /** Encrypted contact information (max 280 chars) */
  contactInfo: string;
  /** Encryption key for contact info */
  encryptionKey: string;
  /** Total trades participated in */
  totalTrades: BN;
  /** Successfully completed trades */
  completedTrades: BN;
  /** Disputed trades */
  disputedTrades: BN;
  /** Total buy volume */
  totalBuyVolume: BN;
  /** Total sell volume */
  totalSellVolume: BN;
  /** Current active offers */
  activeOffers: number;
  /** Current active trades */
  activeTrades: number;
  /** Reputation score (0-10000 basis points, 10000 = 100%) */
  reputationScore: number;
  /** Account creation timestamp */
  createdAt: BN;
  /** Last update timestamp */
  updatedAt: BN;
}

/**
 * Offer account - marketplace listing
 */
export interface OfferAccount {
  /** PDA bump seed */
  bump: number;
  /** Unique offer ID */
  id: BN;
  /** Offer owner public key */
  owner: PublicKey;
  /** Offer type (Buy or Sell) */
  offerType: OfferType;
  /** Offer state */
  state: OfferState;
  /** Fiat currency code (ISO 4217, e.g., "USD") as byte array */
  fiatCurrency: number[];
  /** SPL token mint */
  tokenMint: PublicKey;
  /** Minimum amount in token lamports */
  minAmount: BN;
  /** Maximum amount in token lamports */
  maxAmount: BN;
  /** Exchange rate (fiat cents per token unit) */
  rate: BN;
  /** Description (max 280 chars) */
  description: string;
  /** Creation timestamp */
  createdAt: BN;
  /** Last update timestamp */
  updatedAt: BN;
}

/**
 * Trade account - P2P exchange state
 */
export interface TradeAccount {
  /** PDA bump seed */
  bump: number;
  /** Unique trade ID */
  id: BN;
  /** Reference to offer ID */
  offerId: BN;
  /** Buyer public key */
  buyer: PublicKey;
  /** Seller public key */
  seller: PublicKey;
  /** Current trade state */
  state: TradeState;
  /** Token amount in lamports */
  amount: BN;
  /** Fiat amount in cents */
  fiatAmount: BN;
  /** SPL token mint */
  tokenMint: PublicKey;
  /** Fiat currency code as byte array */
  fiatCurrency: number[];
  /** Buyer's encrypted contact info */
  buyerContact: string;
  /** Seller's encrypted contact info */
  sellerContact: string;
  /** Escrow vault PDA */
  escrowVault: PublicKey;
  /** Assigned arbitrator (if disputed) */
  arbitrator: PublicKey | null;
  /** Dispute initiated timestamp */
  disputeInitiatedAt: BN | null;
  /** Trade expiration timestamp */
  expiresAt: BN;
  /** Creation timestamp */
  createdAt: BN;
  /** Last update timestamp */
  updatedAt: BN;
}

/**
 * Escrow vault account - token custody
 */
export interface EscrowVaultAccount {
  /** PDA bump seed */
  bump: number;
  /** Associated trade ID */
  tradeId: BN;
  /** Token mint address */
  tokenMint: PublicKey;
  /** Depositor public key */
  depositor: PublicKey;
  /** Amount deposited in token lamports */
  amount: BN;
  /** Whether escrow is funded */
  isFunded: boolean;
  /** Whether escrow is frozen (during dispute) */
  isFrozen: boolean;
  /** Funded timestamp */
  fundedAt: BN | null;
  /** Released timestamp */
  releasedAt: BN | null;
}

/**
 * Arbitrator account - dispute handler
 */
export interface ArbitratorAccount {
  /** PDA bump seed */
  bump: number;
  /** Arbitrator's public key */
  pubkey: PublicKey;
  /** Fiat currency this arbitrator handles */
  fiatCurrency: number[];
  /** Whether arbitrator is active */
  isActive: boolean;
  /** Total disputes assigned */
  totalDisputes: BN;
  /** Resolved disputes */
  resolvedDisputes: BN;
  /** Registration timestamp */
  registeredAt: BN;
}

/**
 * Dispute account - dispute details
 */
export interface DisputeAccount {
  /** PDA bump seed */
  bump: number;
  /** Associated trade ID */
  tradeId: BN;
  /** Assigned arbitrator public key */
  arbitrator: PublicKey;
  /** Buyer's evidence (max 500 chars) */
  buyerEvidence: string;
  /** Seller's evidence (max 500 chars) */
  sellerEvidence: string;
  /** Whether buyer has submitted evidence */
  buyerEvidenceSubmitted: boolean;
  /** Whether seller has submitted evidence */
  sellerEvidenceSubmitted: boolean;
  /** Resolution outcome */
  resolution: { buyerWins: unknown } | { sellerWins: unknown } | null;
  /** Dispute creation timestamp */
  createdAt: BN;
  /** Resolution timestamp */
  resolvedAt: BN | null;
}

/**
 * Price account - fiat exchange rate
 */
export interface PriceAccount {
  /** PDA bump seed */
  bump: number;
  /** Fiat currency code */
  fiatCurrency: number[];
  /** Price value (scaled by decimals) */
  value: BN;
  /** Number of decimal places */
  decimals: number;
  /** Minimum allowed price */
  minPrice: BN;
  /** Maximum allowed price */
  maxPrice: BN;
  /** Last provider who updated */
  lastProvider: PublicKey;
  /** Last update timestamp */
  lastUpdatedAt: BN;
  /** Initialization timestamp */
  initializedAt: BN;
}

/**
 * Price provider account
 */
export interface PriceProviderAccount {
  /** PDA bump seed */
  bump: number;
  /** Provider public key */
  pubkey: PublicKey;
  /** Whether provider is active */
  isActive: boolean;
  /** Registration timestamp */
  registeredAt: BN;
}

/**
 * Price provider registry account
 */
export interface PriceProviderRegistryAccount {
  /** PDA bump seed */
  bump: number;
  /** Admin authority */
  admin: PublicKey;
  /** Maximum price staleness in seconds */
  maxPriceStaleness: BN;
  /** Number of registered providers */
  providerCount: number;
}

/**
 * Trade counter account
 */
export interface TradeCounterAccount {
  /** PDA bump seed */
  bump: number;
  /** Next available trade ID */
  nextId: BN;
}

/**
 * Offer counter account
 */
export interface OfferCounterAccount {
  /** PDA bump seed */
  bump: number;
  /** Next available offer ID */
  nextId: BN;
}
