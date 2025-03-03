import { PublicKey } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';

export interface CurrencyPrice {
  currency: string;
  usdPrice: BN;
  updatedAt: BN;
}

export interface PriceRoute {
  offerAsset: string;
  pool: PublicKey;
}

export enum TradeStatus {
  Created = 'created',
  EscrowDeposited = 'escrowDeposited',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Disputed = 'disputed'
}

export enum OfferStatus {
  Active = 'active',
  Paused = 'paused',
  Closed = 'closed'
}

export enum OfferType {
  Buy = 'buy',
  Sell = 'sell'
}

export interface Profile {
  owner: PublicKey;
  username: string;
  reputationScore: number;
  tradesCompleted: number;
  tradesDisputed: number;
  isVerified: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Trade {
  publicKey?: PublicKey;
  maker: PublicKey;
  taker: PublicKey | null;
  amount: BN;
  price: BN;
  tokenMint: PublicKey;
  escrowAccount: PublicKey;
  status: TradeStatus;
  createdAt: number;
  updatedAt: number;
  bump?: number;
}

export interface TradeWithPublicKey extends Trade {
  publicKey: PublicKey;
  account?: Trade;
}

export interface Offer {
  publicKey?: PublicKey;
  maker: PublicKey;
  tokenMint: PublicKey;
  pricePerToken: BN;
  minAmount: BN;
  maxAmount: BN;
  offerType: OfferType;
  status: OfferStatus;
  createdAt: number;
  updatedAt: number;
}

// Add a separate implementation type to handle the getter methods
export type OfferWithGetters = Offer & {
  // Alias properties for compatibility with frontend code
  currencyMint: PublicKey;
  price: BN;
}

export interface OfferWithPublicKey extends Offer {
  publicKey: PublicKey;
  account?: Offer;
} 