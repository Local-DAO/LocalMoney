export class SDKError extends Error {
  constructor(message: string, public code: string, public cause?: Error) {
    super(message);
    this.name = 'SDKError';
  }
}

export class WalletError extends SDKError {
  constructor(message: string, cause?: Error) {
    super(message, 'WALLET_ERROR', cause);
    this.name = 'WalletError';
  }
}

export class TokenError extends SDKError {
  constructor(message: string, cause?: Error) {
    super(message, 'TOKEN_ERROR', cause);
    this.name = 'TokenError';
  }
}

export class OfferError extends SDKError {
  constructor(message: string, cause?: Error) {
    super(message, 'OFFER_ERROR', cause);
    this.name = 'OfferError';
  }
}

export class TradeError extends SDKError {
  constructor(message: string, cause?: Error) {
    super(message, 'TRADE_ERROR', cause);
    this.name = 'TradeError';
  }
}

export class ValidationError extends SDKError {
  constructor(message: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', cause);
    this.name = 'ValidationError';
  }
}

export class PriceError extends SDKError {
  constructor(message: string, cause?: Error) {
    super(message, 'PRICE_ERROR', cause);
    this.name = 'PriceError';
  }
}

export function handleError(error: unknown): SDKError {
  if (error instanceof SDKError) {
    return error;
  }

  if (error instanceof Error) {
    // Handle specific Solana/Anchor errors
    if (error.message.includes('TokenAccountNotFound')) {
      return new TokenError('Token account not found', error);
    }
    if (error.message.includes('InsufficientFunds')) {
      return new TokenError('Insufficient funds', error);
    }
    if (error.message.includes('Account not found')) {
      return new OfferError('Offer not found', error);
    }
    return new SDKError('Unknown error', 'UNKNOWN_ERROR', error);
  }

  return new SDKError(
    typeof error === 'string' ? error : 'Unknown error',
    'UNKNOWN_ERROR'
  );
} 