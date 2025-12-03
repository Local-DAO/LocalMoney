/**
 * Enum type definitions matching the Rust program enums
 */

/**
 * Offer type - whether the offer maker wants to buy or sell tokens
 */
export enum OfferType {
  /** Offer maker wants to buy tokens with fiat */
  Buy = "buy",
  /** Offer maker wants to sell tokens for fiat */
  Sell = "sell",
}

/**
 * Offer state machine
 */
export enum OfferState {
  /** Offer is active and can receive trades */
  Active = "active",
  /** Offer is paused and cannot receive trades */
  Paused = "paused",
  /** Offer is deleted and cannot be used */
  Deleted = "deleted",
}

/**
 * Trade state machine - tracks the lifecycle of a P2P trade
 */
export enum TradeState {
  /** Trade request created, waiting for seller acceptance */
  RequestCreated = "requestCreated",
  /** Trade request accepted by seller */
  RequestAccepted = "requestAccepted",
  /** Escrow has been funded with tokens */
  EscrowFunded = "escrowFunded",
  /** Buyer has confirmed fiat payment */
  FiatDeposited = "fiatDeposited",
  /** Escrow released to recipient, trade complete */
  EscrowReleased = "escrowReleased",
  /** Trade was canceled before escrow funding */
  RequestCanceled = "requestCanceled",
  /** Trade expired before completion */
  RequestExpired = "requestExpired",
  /** Escrow refunded to depositor */
  EscrowRefunded = "escrowRefunded",
  /** Trade is in dispute */
  Disputed = "disputed",
  /** Dispute has been resolved */
  DisputeResolved = "disputeResolved",
}

/**
 * Dispute resolution outcome
 */
export enum DisputeResolution {
  /** Buyer wins the dispute */
  BuyerWins = "buyerWins",
  /** Seller wins the dispute */
  SellerWins = "sellerWins",
}

/**
 * Helper to check if a trade is in a terminal state
 */
export function isTerminalTradeState(state: TradeState): boolean {
  return [
    TradeState.EscrowReleased,
    TradeState.RequestCanceled,
    TradeState.RequestExpired,
    TradeState.EscrowRefunded,
  ].includes(state);
}

/**
 * Helper to check if trade can be canceled
 */
export function canCancelTrade(state: TradeState): boolean {
  return [TradeState.RequestCreated, TradeState.RequestAccepted].includes(state);
}

/**
 * Helper to check if escrow can be funded
 */
export function canFundEscrow(state: TradeState): boolean {
  return state === TradeState.RequestAccepted;
}

/**
 * Helper to check if fiat can be confirmed
 */
export function canConfirmFiat(state: TradeState): boolean {
  return state === TradeState.EscrowFunded;
}

/**
 * Helper to check if escrow can be released
 */
export function canReleaseEscrow(state: TradeState): boolean {
  return state === TradeState.FiatDeposited || state === TradeState.DisputeResolved;
}

/**
 * Helper to check if dispute can be initiated
 */
export function canInitiateDispute(state: TradeState): boolean {
  return [TradeState.EscrowFunded, TradeState.FiatDeposited].includes(state);
}

/**
 * Convert Anchor enum object to SDK enum
 */
export function toOfferType(anchorEnum: Record<string, unknown>): OfferType {
  if ("buy" in anchorEnum) return OfferType.Buy;
  if ("sell" in anchorEnum) return OfferType.Sell;
  throw new Error(`Unknown OfferType: ${JSON.stringify(anchorEnum)}`);
}

/**
 * Convert Anchor enum object to SDK enum
 */
export function toOfferState(anchorEnum: Record<string, unknown>): OfferState {
  if ("active" in anchorEnum) return OfferState.Active;
  if ("paused" in anchorEnum) return OfferState.Paused;
  if ("deleted" in anchorEnum) return OfferState.Deleted;
  throw new Error(`Unknown OfferState: ${JSON.stringify(anchorEnum)}`);
}

/**
 * Convert Anchor enum object to SDK enum
 */
export function toTradeState(anchorEnum: Record<string, unknown>): TradeState {
  if ("requestCreated" in anchorEnum) return TradeState.RequestCreated;
  if ("requestAccepted" in anchorEnum) return TradeState.RequestAccepted;
  if ("escrowFunded" in anchorEnum) return TradeState.EscrowFunded;
  if ("fiatDeposited" in anchorEnum) return TradeState.FiatDeposited;
  if ("escrowReleased" in anchorEnum) return TradeState.EscrowReleased;
  if ("requestCanceled" in anchorEnum) return TradeState.RequestCanceled;
  if ("requestExpired" in anchorEnum) return TradeState.RequestExpired;
  if ("escrowRefunded" in anchorEnum) return TradeState.EscrowRefunded;
  if ("disputed" in anchorEnum) return TradeState.Disputed;
  if ("disputeResolved" in anchorEnum) return TradeState.DisputeResolved;
  throw new Error(`Unknown TradeState: ${JSON.stringify(anchorEnum)}`);
}

/**
 * Convert SDK enum to Anchor enum object
 */
export function fromOfferType(type: OfferType): Record<string, unknown> {
  switch (type) {
    case OfferType.Buy:
      return { buy: {} };
    case OfferType.Sell:
      return { sell: {} };
  }
}

/**
 * Convert SDK enum to Anchor enum object
 */
export function fromOfferState(state: OfferState): Record<string, unknown> {
  switch (state) {
    case OfferState.Active:
      return { active: {} };
    case OfferState.Paused:
      return { paused: {} };
    case OfferState.Deleted:
      return { deleted: {} };
  }
}
