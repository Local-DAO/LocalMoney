use anchor_lang::prelude::*;
use solana_program::msg;

declare_id!("BGuwRibtPCCLCo98AFDk6C3QUPS2VHBkTRyDgkCrySfG");

#[program]
pub mod price {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.admin = ctx.accounts.admin.key();
        state.price_provider = ctx.accounts.admin.key(); // Initially set to admin
        state.is_initialized = true;
        state.prices = Vec::new();

        msg!("Price oracle initialized successfully");
        Ok(())
    }

    pub fn update_prices(ctx: Context<UpdatePrices>, prices: Vec<CurrencyPrice>) -> Result<()> {
        let oracle = &mut ctx.accounts.oracle;

        // Validate the price provider
        require!(
            ctx.accounts.price_provider.key() == oracle.price_provider,
            PriceError::InvalidPriceProvider
        );

        // Update all prices
        oracle.prices = prices.clone();

        msg!("Updated {} prices in the oracle", prices.len());
        Ok(())
    }

    pub fn register_price_route(
        ctx: Context<RegisterPriceRoute>,
        denom: String,
        route: Vec<PriceRoute>,
    ) -> Result<()> {
        let route_data = &mut ctx.accounts.route_data;
        route_data.denom = denom;
        route_data.route = route;

        msg!("Price route registered successfully");
        Ok(())
    }

    pub fn verify_price_for_trade(
        ctx: Context<VerifyPrice>,
        trade_price: u64,
        currency: String,
        tolerance_bps: u16, // Basis points (1/10000) of allowed deviation
    ) -> Result<()> {
        let oracle = &ctx.accounts.oracle;
        require!(oracle.is_initialized, PriceError::NotInitialized);

        // Find the reference price for the given currency
        let reference_price = oracle
            .prices
            .iter()
            .find(|p| p.currency == currency)
            .ok_or(PriceError::PriceNotFound)?;

        // Calculate allowed deviation range
        let tolerance = (reference_price.usd_price as u128)
            .checked_mul(tolerance_bps as u128)
            .unwrap_or(0)
            .checked_div(10000)
            .unwrap_or(0) as u64;

        let min_allowed = reference_price.usd_price.saturating_sub(tolerance);
        let max_allowed = reference_price.usd_price.saturating_add(tolerance);

        require!(
            trade_price >= min_allowed && trade_price <= max_allowed,
            PriceError::PriceOutOfRange
        );

        msg!(
            "Price verified successfully within {}bps tolerance",
            tolerance_bps
        );
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + // discriminator
            1 + // is_initialized
            32 + // admin
            32 + // price_provider
            4 + // vec length
            10 * (4 + 32 + 8 + 8) // space for 10 prices (string length + string + price + timestamp)
    )]
    pub state: Account<'info, PriceState>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrices<'info> {
    #[account(mut)]
    pub oracle: Account<'info, PriceState>,
    #[account(
        constraint = price_provider.key() == oracle.price_provider @ PriceError::InvalidPriceProvider
    )]
    pub price_provider: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterPriceRoute<'info> {
    #[account(init, payer = admin, space = 8 + std::mem::size_of::<PriceRouteData>())]
    pub route_data: Account<'info, PriceRouteData>,
    #[account(mut, has_one = admin)]
    pub state: Account<'info, PriceState>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyPrice<'info> {
    pub oracle: Account<'info, PriceState>,
}

#[account]
#[derive(Default)]
pub struct PriceState {
    pub is_initialized: bool,
    pub admin: Pubkey,
    pub price_provider: Pubkey,
    pub prices: Vec<CurrencyPrice>,
}

#[account]
pub struct PriceRouteData {
    pub denom: String,
    pub route: Vec<PriceRoute>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CurrencyPrice {
    pub currency: String,
    pub usd_price: u64,
    pub updated_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct PriceRoute {
    pub offer_asset: String,
    pub pool: Pubkey,
}

#[error_code]
pub enum PriceError {
    #[msg("Price oracle is not initialized")]
    NotInitialized,
    #[msg("Invalid price provider")]
    InvalidPriceProvider,
    #[msg("Invalid price route configuration")]
    InvalidPriceRoute,
    #[msg("Price not found for the specified currency")]
    PriceNotFound,
    #[msg("Trade price is outside allowed range")]
    PriceOutOfRange,
}

// Re-export for CPI
pub use price::*;
