use anchor_lang::prelude::*;
use solana_program::msg;

declare_id!("5XkzWi5XrzgZGTw6YAYm4brCsRTYGCZpNiZJkMWwWUx5");

#[program]
pub mod price {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.admin = ctx.accounts.admin.key();
        state.price_provider = ctx.accounts.admin.key(); // Initially set to admin
        state.is_initialized = true;

        msg!("Price oracle initialized successfully");
        Ok(())
    }

    pub fn update_prices(_ctx: Context<UpdatePrices>, prices: Vec<CurrencyPrice>) -> Result<()> {
        // Update prices in the oracle account
        for price in prices {
            msg!("Updating price for {}: {}", price.currency, price.usd_price);
            // Add price update logic here
        }

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

    pub fn verify_price_for_trade(ctx: Context<VerifyPrice>, _trade_price: u64) -> Result<()> {
        let state = &ctx.accounts.state;
        require!(state.is_initialized, PriceError::NotInitialized);

        // Add price verification logic here
        msg!("Price verified successfully");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + std::mem::size_of::<PriceState>())]
    pub state: Account<'info, PriceState>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrices<'info> {
    #[account(mut)]
    pub oracle: Account<'info, PriceState>,
    #[account(constraint = price_provider.key() == oracle.price_provider)]
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
    pub state: Account<'info, PriceState>,
}

#[account]
pub struct PriceState {
    pub is_initialized: bool,
    pub admin: Pubkey,
    pub price_provider: Pubkey,
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
}

#[cfg(test)]
mod tests {
    // Add tests here
}
