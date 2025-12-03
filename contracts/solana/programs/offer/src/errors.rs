use anchor_lang::prelude::*;

#[error_code]
pub enum OfferError {
    #[msg("Unauthorized: only offer owner can perform this action")]
    Unauthorized,

    #[msg("Invalid offer type")]
    InvalidOfferType,

    #[msg("Invalid amount range: min must be less than max")]
    InvalidAmountRange,

    #[msg("Invalid state transition")]
    InvalidStateTransition,

    #[msg("Description exceeds maximum length (280 characters)")]
    DescriptionTooLong,

    #[msg("Invalid fiat currency code")]
    InvalidFiatCurrency,

    #[msg("Offer is not active")]
    OfferNotActive,

    #[msg("Offer is deleted")]
    OfferDeleted,

    #[msg("Maximum active offers reached")]
    MaxActiveOffersReached,

    #[msg("Offer counter overflow")]
    OfferCounterOverflow,

    #[msg("New offers are currently paused")]
    NewOffersPaused,
}
