use anchor_lang::prelude::*;

#[error_code]
pub enum TradeError {
    #[msg("Invalid amount: must be greater than 0")]
    InvalidAmount,

    #[msg("Invalid fiat amount: must be greater than 0")]
    InvalidFiatAmount,

    #[msg("Invalid fiat currency code")]
    InvalidFiatCurrency,

    #[msg("Contact information exceeds maximum length (280 characters)")]
    ContactInfoTooLong,

    #[msg("Cannot trade with yourself")]
    SelfTradeNotAllowed,

    #[msg("Invalid state transition")]
    InvalidStateTransition,

    #[msg("Trade has expired")]
    TradeExpired,

    #[msg("Trade has not expired yet")]
    TradeNotExpired,

    #[msg("Unauthorized: only trade parties can perform this action")]
    Unauthorized,

    #[msg("Unauthorized: only buyer can perform this action")]
    OnlyBuyer,

    #[msg("Unauthorized: only seller can perform this action")]
    OnlySeller,

    #[msg("Unauthorized: only offer owner can accept trade")]
    OnlyOfferOwner,

    #[msg("Trade amount is below offer minimum")]
    AmountBelowMinimum,

    #[msg("Trade amount is above offer maximum")]
    AmountAboveMaximum,

    #[msg("Offer is not active")]
    OfferNotActive,

    #[msg("Trade is not in the correct state for this operation")]
    InvalidState,

    #[msg("Escrow is already funded")]
    EscrowAlreadyFunded,

    #[msg("Escrow is not funded")]
    EscrowNotFunded,

    #[msg("Trade is already disputed")]
    AlreadyDisputed,

    #[msg("Trade is not disputed")]
    NotDisputed,

    #[msg("Trade counter overflow")]
    CounterOverflow,

    #[msg("Maximum active trades reached")]
    MaxActiveTradesReached,

    #[msg("Offer type mismatch")]
    OfferTypeMismatch,

    #[msg("Token mint mismatch")]
    TokenMintMismatch,

    #[msg("Fiat currency mismatch")]
    FiatCurrencyMismatch,

    #[msg("Arbitrator not assigned")]
    ArbitratorNotAssigned,

    #[msg("Only assigned arbitrator can resolve dispute")]
    OnlyAssignedArbitrator,

    #[msg("Operation is paused by circuit breaker")]
    OperationPaused,

    #[msg("New trades are paused by circuit breaker")]
    NewTradesPaused,

    #[msg("Trade amount outside offer's min/max range")]
    AmountOutOfRange,

    #[msg("Numerical overflow in calculation")]
    NumericalOverflow,

    #[msg("Escrow release is paused by circuit breaker")]
    EscrowReleasePaused,
}
