use anchor_lang::prelude::*;
use crate::errors::*;

/// Price data for a specific fiat currency
///
/// Stores the current exchange rate and metadata for validation.
#[account]
#[derive(Debug)]
pub struct Price {
    /// PDA bump seed
    pub bump: u8,

    /// Fiat currency code (ISO 4217, e.g., "USD", "EUR")
    pub fiat_currency: [u8; 3],

    /// Price value (scaled by decimals)
    /// Example: If decimals=6 and price is 1.50 USD per token,
    /// value = 1_500_000
    pub value: u64,

    /// Number of decimal places for the price
    /// Standard: 6 decimals (same as USDC)
    pub decimals: u8,

    /// Minimum allowed price (for validation)
    pub min_price: u64,

    /// Maximum allowed price (for validation)
    pub max_price: u64,

    /// Provider who last updated this price
    pub last_provider: Pubkey,

    /// Timestamp of last update
    pub last_updated_at: i64,

    /// Timestamp when price was initialized
    pub initialized_at: i64,
}

impl Price {
    /// Account space calculation
    /// 8 (discriminator) + 1 (bump) + 3 (fiat_currency) + 8 (value) +
    /// 1 (decimals) + 8 (min_price) + 8 (max_price) + 32 (last_provider) +
    /// 8 (last_updated_at) + 8 (initialized_at)
    pub const LEN: usize = 8 + 1 + 3 + 8 + 1 + 8 + 8 + 32 + 8 + 8;

    /// Default decimals (6, same as USDC)
    pub const DEFAULT_DECIMALS: u8 = 6;

    /// Default minimum price (0.000001 with 6 decimals)
    pub const DEFAULT_MIN_PRICE: u64 = 1;

    /// Default maximum price (1 million with 6 decimals = 1 trillion)
    pub const DEFAULT_MAX_PRICE: u64 = 1_000_000_000_000;

    /// Validate fiat currency code
    pub fn validate_fiat_currency(fiat: &[u8; 3]) -> Result<()> {
        // Ensure all characters are uppercase ASCII letters
        for &byte in fiat.iter() {
            require!(
                byte.is_ascii_uppercase(),
                PriceOracleError::InvalidFiatCurrency
            );
        }
        Ok(())
    }

    /// Check if price is stale
    pub fn is_stale(&self, max_staleness: u64, current_timestamp: i64) -> bool {
        let age = current_timestamp.saturating_sub(self.last_updated_at);
        age as u64 > max_staleness
    }

    /// Validate price value
    pub fn validate_price_value(&self, value: u64) -> Result<()> {
        require!(value > 0, PriceOracleError::InvalidPriceValue);
        require!(
            value >= self.min_price,
            PriceOracleError::PriceBelowMinimum
        );
        require!(
            value <= self.max_price,
            PriceOracleError::PriceExceedsMaximum
        );
        Ok(())
    }

    /// Update price value
    pub fn update_value(
        &mut self,
        value: u64,
        provider: Pubkey,
        timestamp: i64,
    ) -> Result<()> {
        self.validate_price_value(value)?;
        self.value = value;
        self.last_provider = provider;
        self.last_updated_at = timestamp;
        Ok(())
    }
}
