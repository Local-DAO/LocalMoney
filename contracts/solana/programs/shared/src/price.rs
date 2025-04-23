use anchor_lang::prelude::*;

// Currency types
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum FiatCurrency {
    USD,
    EUR,
    JPY,
    GBP,
    CAD,
    // Add more currencies as needed
}

impl ToString for FiatCurrency {
    fn to_string(&self) -> String {
        match self {
            FiatCurrency::USD => "USD".to_string(),
            FiatCurrency::EUR => "EUR".to_string(),
            FiatCurrency::JPY => "JPY".to_string(),
            FiatCurrency::GBP => "GBP".to_string(),
            FiatCurrency::CAD => "CAD".to_string(),
        }
    }
}

// Price configuration and state accounts
#[account]
pub struct PriceConfig {
    pub hub_authority: Pubkey,
    pub price_provider: Pubkey,
    pub bump: u8,
}

// Price data account
#[account]
pub struct CurrencyPrice {
    pub currency: FiatCurrency,
    pub usd_price: u64,  // Price in USD * PRICE_SCALE
    pub updated_at: i64, // Unix timestamp of last update
    pub bump: u8,
}

impl CurrencyPrice {
    pub fn new(currency: FiatCurrency) -> Self {
        Self {
            currency,
            usd_price: 0,
            updated_at: 0,
            bump: 0,
        }
    }
}

// Price route for token conversion
#[account]
pub struct PriceRoute {
    pub offer_asset_mint: Pubkey, // The asset being offered
    pub ask_asset_mint: Pubkey,   // The asset being requested
    pub pool: Pubkey,             // The AMM/DEX pool address
    pub bump: u8,
}

impl ToString for PriceRoute {
    fn to_string(&self) -> String {
        format!(
            "{:?}->{:?} via {:?}",
            self.offer_asset_mint.to_string(),
            self.ask_asset_mint.to_string(),
            self.pool.to_string()
        )
    }
}

// Price response for querying token prices in fiat
#[account]
pub struct DenomFiatPrice {
    pub token_mint: Pubkey,
    pub fiat: FiatCurrency,
    pub price: u64, // Price scaled by PRICE_SCALE
}

// Constants
pub const PRICE_SCALE: u64 = 1_000_000; // 6 decimal places
