use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(fiat_currency: [u8; 3])]
pub struct InitializePrice<'info> {
    #[account(
        seeds = [b"price_provider_registry"],
        bump = registry.bump,
        has_one = admin @ PriceOracleError::Unauthorized
    )]
    pub registry: Account<'info, PriceProviderRegistry>,

    #[account(
        init,
        payer = admin,
        space = Price::LEN,
        seeds = [b"price", fiat_currency.as_ref()],
        bump
    )]
    pub price: Account<'info, Price>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializePriceParams {
    /// Initial price value
    pub initial_value: u64,

    /// Decimals (optional, defaults to 6)
    pub decimals: Option<u8>,

    /// Minimum allowed price (optional)
    pub min_price: Option<u64>,

    /// Maximum allowed price (optional)
    pub max_price: Option<u64>,
}

pub fn handler(
    ctx: Context<InitializePrice>,
    fiat_currency: [u8; 3],
    params: InitializePriceParams,
) -> Result<()> {
    let price = &mut ctx.accounts.price;
    let clock = Clock::get()?;

    // Validate fiat currency code
    Price::validate_fiat_currency(&fiat_currency)?;

    // Initialize price account
    price.bump = ctx.bumps.price;
    price.fiat_currency = fiat_currency;
    price.decimals = params.decimals.unwrap_or(Price::DEFAULT_DECIMALS);
    price.min_price = params.min_price.unwrap_or(Price::DEFAULT_MIN_PRICE);
    price.max_price = params.max_price.unwrap_or(Price::DEFAULT_MAX_PRICE);
    price.initialized_at = clock.unix_timestamp;

    // Validate and set initial value
    price.value = 0; // Temporarily set to validate
    price.validate_price_value(params.initial_value)?;

    price.value = params.initial_value;
    price.last_provider = ctx.accounts.admin.key();
    price.last_updated_at = clock.unix_timestamp;

    // Validate min < max
    require!(
        price.min_price < price.max_price,
        PriceOracleError::InvalidPriceValue
    );

    emit!(PriceInitialized {
        fiat_currency,
        initial_value: params.initial_value,
        decimals: price.decimals,
    });

    Ok(())
}

#[event]
pub struct PriceInitialized {
    pub fiat_currency: [u8; 3],
    pub initial_value: u64,
    pub decimals: u8,
}
