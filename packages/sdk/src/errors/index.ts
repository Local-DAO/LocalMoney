/**
 * Error handling for the LocalMoney SDK
 */

/**
 * Error codes for the LocalMoney SDK
 */
export enum LocalMoneyErrorCode {
  // SDK errors
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  WALLET_NOT_CONNECTED = "WALLET_NOT_CONNECTED",
  PROGRAM_NOT_INITIALIZED = "PROGRAM_NOT_INITIALIZED",
  PROVIDER_NOT_INITIALIZED = "PROVIDER_NOT_INITIALIZED",
  NUMBER_OVERFLOW = "NUMBER_OVERFLOW",
  INVALID_PARAMETER = "INVALID_PARAMETER",
  ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND",
  NETWORK_ERROR = "NETWORK_ERROR",
  SIMULATION_FAILED = "SIMULATION_FAILED",

  // Trade errors
  INVALID_AMOUNT = "INVALID_AMOUNT",
  INVALID_FIAT_AMOUNT = "INVALID_FIAT_AMOUNT",
  INVALID_FIAT_CURRENCY = "INVALID_FIAT_CURRENCY",
  CONTACT_INFO_TOO_LONG = "CONTACT_INFO_TOO_LONG",
  SELF_TRADE_NOT_ALLOWED = "SELF_TRADE_NOT_ALLOWED",
  INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION",
  TRADE_EXPIRED = "TRADE_EXPIRED",
  TRADE_NOT_EXPIRED = "TRADE_NOT_EXPIRED",
  UNAUTHORIZED = "UNAUTHORIZED",
  ONLY_BUYER = "ONLY_BUYER",
  ONLY_SELLER = "ONLY_SELLER",
  ONLY_OFFER_OWNER = "ONLY_OFFER_OWNER",
  AMOUNT_BELOW_MINIMUM = "AMOUNT_BELOW_MINIMUM",
  AMOUNT_ABOVE_MAXIMUM = "AMOUNT_ABOVE_MAXIMUM",
  OFFER_NOT_ACTIVE = "OFFER_NOT_ACTIVE",
  INVALID_STATE = "INVALID_STATE",
  ESCROW_ALREADY_FUNDED = "ESCROW_ALREADY_FUNDED",
  ESCROW_NOT_FUNDED = "ESCROW_NOT_FUNDED",
  ALREADY_DISPUTED = "ALREADY_DISPUTED",
  NOT_DISPUTED = "NOT_DISPUTED",
  COUNTER_OVERFLOW = "COUNTER_OVERFLOW",
  MAX_ACTIVE_TRADES_REACHED = "MAX_ACTIVE_TRADES_REACHED",
  OFFER_TYPE_MISMATCH = "OFFER_TYPE_MISMATCH",
  TOKEN_MINT_MISMATCH = "TOKEN_MINT_MISMATCH",
  FIAT_CURRENCY_MISMATCH = "FIAT_CURRENCY_MISMATCH",
  ARBITRATOR_NOT_ASSIGNED = "ARBITRATOR_NOT_ASSIGNED",
  ONLY_ASSIGNED_ARBITRATOR = "ONLY_ASSIGNED_ARBITRATOR",
  OPERATION_PAUSED = "OPERATION_PAUSED",
  NEW_TRADES_PAUSED = "NEW_TRADES_PAUSED",
  AMOUNT_OUT_OF_RANGE = "AMOUNT_OUT_OF_RANGE",
  NUMERICAL_OVERFLOW = "NUMERICAL_OVERFLOW",
  ESCROW_RELEASE_PAUSED = "ESCROW_RELEASE_PAUSED",

  // Offer errors
  DESCRIPTION_TOO_LONG = "DESCRIPTION_TOO_LONG",
  MIN_GREATER_THAN_MAX = "MIN_GREATER_THAN_MAX",
  MAX_ACTIVE_OFFERS_REACHED = "MAX_ACTIVE_OFFERS_REACHED",
  OFFER_NOT_FOUND = "OFFER_NOT_FOUND",
  NEW_OFFERS_PAUSED = "NEW_OFFERS_PAUSED",

  // Profile errors
  PROFILE_NOT_FOUND = "PROFILE_NOT_FOUND",
  PROFILE_ALREADY_EXISTS = "PROFILE_ALREADY_EXISTS",

  // Arbitrator errors
  ARBITRATOR_NOT_FOUND = "ARBITRATOR_NOT_FOUND",
  ARBITRATOR_NOT_ACTIVE = "ARBITRATOR_NOT_ACTIVE",
  EVIDENCE_TOO_LONG = "EVIDENCE_TOO_LONG",
  DISPUTE_NOT_FOUND = "DISPUTE_NOT_FOUND",
  EVIDENCE_ALREADY_SUBMITTED = "EVIDENCE_ALREADY_SUBMITTED",

  // Price Oracle errors
  PRICE_STALE = "PRICE_STALE",
  INVALID_PRICE = "INVALID_PRICE",
  PROVIDER_NOT_AUTHORIZED = "PROVIDER_NOT_AUTHORIZED",
}

/**
 * Custom error class for LocalMoney SDK
 */
export class LocalMoneyError extends Error {
  constructor(
    message: string,
    public readonly code: string = LocalMoneyErrorCode.UNKNOWN_ERROR,
    public readonly logs?: string[],
    public readonly programError?: number
  ) {
    super(message);
    this.name = "LocalMoneyError";

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LocalMoneyError);
    }
  }

  /**
   * Create a formatted error message
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      programError: this.programError,
      logs: this.logs,
    };
  }
}

/**
 * Mapping of Anchor program error codes to SDK error codes
 */
const PROGRAM_ERROR_MAP: Record<number, { code: LocalMoneyErrorCode; message: string }> = {
  // Trade errors (6000-6031)
  6000: { code: LocalMoneyErrorCode.INVALID_AMOUNT, message: "Invalid amount: must be greater than 0" },
  6001: { code: LocalMoneyErrorCode.INVALID_FIAT_AMOUNT, message: "Invalid fiat amount: must be greater than 0" },
  6002: { code: LocalMoneyErrorCode.INVALID_FIAT_CURRENCY, message: "Invalid fiat currency code" },
  6003: { code: LocalMoneyErrorCode.CONTACT_INFO_TOO_LONG, message: "Contact information exceeds maximum length (280 characters)" },
  6004: { code: LocalMoneyErrorCode.SELF_TRADE_NOT_ALLOWED, message: "Cannot trade with yourself" },
  6005: { code: LocalMoneyErrorCode.INVALID_STATE_TRANSITION, message: "Invalid state transition" },
  6006: { code: LocalMoneyErrorCode.TRADE_EXPIRED, message: "Trade has expired" },
  6007: { code: LocalMoneyErrorCode.TRADE_NOT_EXPIRED, message: "Trade has not expired yet" },
  6008: { code: LocalMoneyErrorCode.UNAUTHORIZED, message: "Unauthorized: only trade parties can perform this action" },
  6009: { code: LocalMoneyErrorCode.ONLY_BUYER, message: "Unauthorized: only buyer can perform this action" },
  6010: { code: LocalMoneyErrorCode.ONLY_SELLER, message: "Unauthorized: only seller can perform this action" },
  6011: { code: LocalMoneyErrorCode.ONLY_OFFER_OWNER, message: "Unauthorized: only offer owner can accept trade" },
  6012: { code: LocalMoneyErrorCode.AMOUNT_BELOW_MINIMUM, message: "Trade amount is below offer minimum" },
  6013: { code: LocalMoneyErrorCode.AMOUNT_ABOVE_MAXIMUM, message: "Trade amount is above offer maximum" },
  6014: { code: LocalMoneyErrorCode.OFFER_NOT_ACTIVE, message: "Offer is not active" },
  6015: { code: LocalMoneyErrorCode.INVALID_STATE, message: "Trade is not in the correct state for this operation" },
  6016: { code: LocalMoneyErrorCode.ESCROW_ALREADY_FUNDED, message: "Escrow is already funded" },
  6017: { code: LocalMoneyErrorCode.ESCROW_NOT_FUNDED, message: "Escrow is not funded" },
  6018: { code: LocalMoneyErrorCode.ALREADY_DISPUTED, message: "Trade is already disputed" },
  6019: { code: LocalMoneyErrorCode.NOT_DISPUTED, message: "Trade is not disputed" },
  6020: { code: LocalMoneyErrorCode.COUNTER_OVERFLOW, message: "Trade counter overflow" },
  6021: { code: LocalMoneyErrorCode.MAX_ACTIVE_TRADES_REACHED, message: "Maximum active trades reached" },
  6022: { code: LocalMoneyErrorCode.OFFER_TYPE_MISMATCH, message: "Offer type mismatch" },
  6023: { code: LocalMoneyErrorCode.TOKEN_MINT_MISMATCH, message: "Token mint mismatch" },
  6024: { code: LocalMoneyErrorCode.FIAT_CURRENCY_MISMATCH, message: "Fiat currency mismatch" },
  6025: { code: LocalMoneyErrorCode.ARBITRATOR_NOT_ASSIGNED, message: "Arbitrator not assigned" },
  6026: { code: LocalMoneyErrorCode.ONLY_ASSIGNED_ARBITRATOR, message: "Only assigned arbitrator can resolve dispute" },
  6027: { code: LocalMoneyErrorCode.OPERATION_PAUSED, message: "Operation is paused by circuit breaker" },
  6028: { code: LocalMoneyErrorCode.NEW_TRADES_PAUSED, message: "New trades are paused by circuit breaker" },
  6029: { code: LocalMoneyErrorCode.AMOUNT_OUT_OF_RANGE, message: "Trade amount outside offer's min/max range" },
  6030: { code: LocalMoneyErrorCode.NUMERICAL_OVERFLOW, message: "Numerical overflow in calculation" },
  6031: { code: LocalMoneyErrorCode.ESCROW_RELEASE_PAUSED, message: "Escrow release is paused by circuit breaker" },
};

/**
 * Parse Anchor error from transaction logs or error object
 *
 * @param error - Error to parse
 * @returns LocalMoneyError if parseable, null otherwise
 */
export function parseAnchorError(error: unknown): LocalMoneyError | null {
  if (!error) return null;

  // Check if it's an Anchor error with error code
  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof (error as Record<string, unknown>).error === "object"
  ) {
    const errorObj = (error as { error: { errorCode?: { number?: number }; errorMessage?: string } }).error;
    if (errorObj.errorCode?.number) {
      const mapped = PROGRAM_ERROR_MAP[errorObj.errorCode.number];
      if (mapped) {
        return new LocalMoneyError(
          mapped.message,
          mapped.code,
          undefined,
          errorObj.errorCode.number
        );
      }
    }
    if (errorObj.errorMessage) {
      return new LocalMoneyError(errorObj.errorMessage, LocalMoneyErrorCode.UNKNOWN_ERROR);
    }
  }

  // Try to extract error code from error message
  if (error instanceof Error) {
    const codeMatch = error.message.match(/custom program error: 0x([0-9a-f]+)/i);
    if (codeMatch) {
      const errorCode = parseInt(codeMatch[1], 16);
      const mapped = PROGRAM_ERROR_MAP[errorCode];
      if (mapped) {
        return new LocalMoneyError(mapped.message, mapped.code, undefined, errorCode);
      }
      return new LocalMoneyError(
        `Program error ${errorCode}`,
        LocalMoneyErrorCode.UNKNOWN_ERROR,
        undefined,
        errorCode
      );
    }

    // Check for logs in the error
    if ("logs" in error && Array.isArray((error as { logs: string[] }).logs)) {
      return new LocalMoneyError(
        error.message,
        LocalMoneyErrorCode.UNKNOWN_ERROR,
        (error as { logs: string[] }).logs
      );
    }
  }

  return null;
}

/**
 * Check if an error is a specific LocalMoney error
 *
 * @param error - Error to check
 * @param code - Error code to match
 */
export function isLocalMoneyError(
  error: unknown,
  code?: LocalMoneyErrorCode
): error is LocalMoneyError {
  if (!(error instanceof LocalMoneyError)) {
    return false;
  }
  if (code) {
    return error.code === code;
  }
  return true;
}

/**
 * Helper to create common errors
 */
export const Errors = {
  walletNotConnected: () =>
    new LocalMoneyError("Wallet not connected", LocalMoneyErrorCode.WALLET_NOT_CONNECTED),
  accountNotFound: (name: string) =>
    new LocalMoneyError(`${name} account not found`, LocalMoneyErrorCode.ACCOUNT_NOT_FOUND),
  invalidParameter: (param: string, reason?: string) =>
    new LocalMoneyError(
      `Invalid parameter: ${param}${reason ? ` - ${reason}` : ""}`,
      LocalMoneyErrorCode.INVALID_PARAMETER
    ),
  simulationFailed: (reason: string, logs?: string[]) =>
    new LocalMoneyError(`Simulation failed: ${reason}`, LocalMoneyErrorCode.SIMULATION_FAILED, logs),
};
