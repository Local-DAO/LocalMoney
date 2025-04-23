use anchor_lang::prelude::*;

#[error_code]
pub enum LocalMoneyError {
    #[msg("Unauthorized.")]
    Unauthorized,

    #[msg("Invalid parameter.")]
    InvalidParameter,

    #[msg("Hub already registered.")]
    HubAlreadyRegistered,

    #[msg("The sum of platform fees must be less than 10%.")]
    InvalidPlatformFee,

    #[msg("Min amount must be less than Max amount.")]
    InvalidMinMax,

    #[msg("Amount is outside of offer amount range.")]
    InvalidOfferAmount,

    #[msg("Invalid state change.")]
    InvalidOfferStateChange,

    #[msg("Offer max amount is above the trading limit.")]
    OfferMaxAboveTradingLimit,

    #[msg("Offer not found.")]
    OfferNotFound,

    #[msg("Value out of range.")]
    ValueOutOfRange,

    #[msg("Fund escrow error. Required amount doesn't match sent amount.")]
    FundEscrowError,

    #[msg("Dispute requested too early.")]
    PrematureDisputeRequest,

    #[msg("Invalid token mint.")]
    InvalidMint,

    #[msg("Invalid price for token. Must be greater than zero.")]
    InvalidPriceForToken,

    #[msg("Invalid sender, must be Trade's buyer or seller.")]
    InvalidSender,

    #[msg("Invalid trade amount.")]
    InvalidTradeAmount,

    #[msg("Trade state is invalid.")]
    InvalidTradeState,

    #[msg("Invalid trade state change.")]
    InvalidTradeStateChange,

    #[msg("Refund error: Not Expired")]
    RefundErrorNotExpired,

    #[msg("This trade has expired.")]
    TradeExpired,

    #[msg("Swap Error: received amount is less than expected.")]
    SwapErrorInvalidAmount,

    #[msg("Swap Error: missing token mint.")]
    SwapErrorMissingMint,

    #[msg("Unknown instruction.")]
    UnknownInstruction,

    #[msg("Active offers limit reached.")]
    ActiveOffersLimitReached,

    #[msg("Active trades limit reached.")]
    ActiveTradesLimitReached,

    #[msg("Dispute is not enabled for this trade.")]
    DisputeNotEnabled,

    #[msg("Fee calculation error.")]
    FeeCalculationError,

    #[msg("Escrow balance mismatch.")]
    EscrowBalanceMismatch,

    #[msg("Invalid fee collector account.")]
    InvalidFeeCollectorAccount,
}
