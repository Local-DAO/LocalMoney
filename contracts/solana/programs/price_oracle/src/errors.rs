use anchor_lang::prelude::*;

#[error_code]
pub enum PriceOracleError {
    #[msg("Unauthorized: only admin can perform this action")]
    Unauthorized,

    #[msg("Unauthorized: only authorized price providers can update prices")]
    UnauthorizedProvider,

    #[msg("Price is stale (too old)")]
    StalePrice,

    #[msg("Price exceeds maximum allowed value")]
    PriceExceedsMaximum,

    #[msg("Price below minimum allowed value")]
    PriceBelowMinimum,

    #[msg("Invalid fiat currency code")]
    InvalidFiatCurrency,

    #[msg("Price provider is not active")]
    ProviderNotActive,

    #[msg("Invalid price value (zero or negative)")]
    InvalidPriceValue,

    #[msg("Invalid decimals value")]
    InvalidDecimals,

    #[msg("Price already initialized for this currency")]
    PriceAlreadyInitialized,

    #[msg("Provider already registered")]
    ProviderAlreadyRegistered,
}
