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
  Open = 'open',
  InProgress = 'inProgress',
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
  seller: PublicKey;
  buyer: PublicKey | null;
  amount: BN;
  price: BN;
  tokenMint: PublicKey;
  escrowAccount: PublicKey;
  status: TradeStatus;
  createdAt: number;
  updatedAt: number;
  bump: number;
}

export interface Offer {
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