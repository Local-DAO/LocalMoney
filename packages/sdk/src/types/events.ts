/**
 * Event types emitted by the LocalMoney programs
 */

import type { BN } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";

/**
 * Emitted when a trade counter is initialized
 */
export interface CounterInitializedEvent {
  nextId: BN;
}

/**
 * Emitted when a new trade is created
 */
export interface TradeCreatedEvent {
  tradeId: BN;
  offerId: BN;
  buyer: PublicKey;
  amount: BN;
  fiatAmount: BN;
}

/**
 * Emitted when a trade is accepted by seller
 */
export interface TradeAcceptedEvent {
  tradeId: BN;
  seller: PublicKey;
}

/**
 * Emitted when escrow is funded
 */
export interface EscrowFundedEvent {
  tradeId: BN;
  amount: BN;
  funder: PublicKey;
}

/**
 * Emitted when fiat deposit is confirmed
 */
export interface FiatDepositConfirmedEvent {
  tradeId: BN;
  buyer: PublicKey;
}

/**
 * Emitted when escrow is released
 */
export interface EscrowReleasedEvent {
  tradeId: BN;
  recipient: PublicKey;
  amount: BN;
}

/**
 * Emitted when trade is canceled
 */
export interface TradeCanceledEvent {
  tradeId: BN;
  canceler: PublicKey;
}

/**
 * Emitted when trade expires
 */
export interface TradeExpiredEvent {
  tradeId: BN;
  expiredAt: BN;
}

/**
 * Emitted when escrow is refunded
 */
export interface TradeRefundedEvent {
  tradeId: BN;
  amount: BN;
  depositor: PublicKey;
}

/**
 * Emitted when dispute is initiated
 */
export interface DisputeInitiatedEvent {
  tradeId: BN;
  initiator: PublicKey;
  arbitrator: PublicKey | null;
}

/**
 * Emitted when a new offer is created
 */
export interface OfferCreatedEvent {
  offerId: BN;
  owner: PublicKey;
  offerType: { buy: unknown } | { sell: unknown };
  fiatCurrency: number[];
}

/**
 * Emitted when an offer is updated
 */
export interface OfferUpdatedEvent {
  offerId: BN;
}

/**
 * Emitted when a profile is created
 */
export interface ProfileCreatedEvent {
  owner: PublicKey;
}

/**
 * Emitted when an arbitrator is registered
 */
export interface ArbitratorRegisteredEvent {
  arbitrator: PublicKey;
  fiatCurrency: number[];
}

/**
 * Emitted when a dispute is resolved
 */
export interface DisputeResolvedEvent {
  tradeId: BN;
  resolution: { buyerWins: unknown } | { sellerWins: unknown };
  arbitrator: PublicKey;
}

/**
 * Emitted when price is updated
 */
export interface PriceUpdatedEvent {
  fiatCurrency: number[];
  price: BN;
  provider: PublicKey;
}
