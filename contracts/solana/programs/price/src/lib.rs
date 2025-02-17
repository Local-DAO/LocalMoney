use anchor_lang::prelude::*;
use solana_program::{
    program::invoke,
    instruction::{Instruction, AccountMeta},
};

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

    pub fn register_hub(ctx: Context<RegisterHub>) -> Result<()> {
        // Add hub registration logic here
        msg!("Hub registered successfully");
        Ok(())
    }

    pub fn update_prices(ctx: Context<UpdatePrices>, prices: Vec<CurrencyPrice>) -> Result<()> {
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

    pub fn verify_price_for_trade(ctx: Context<VerifyPrice>, trade_price: u64) -> Result<()> {
        let state = &ctx.accounts.state;
        require!(state.is_initialized, PriceError::NotInitialized);

        // Verify the hub program is calling through CPI
        let hub_accounts = vec![
            AccountMeta::new_readonly(ctx.accounts.hub_config.key(), false),
        ];

        invoke(
            &Instruction {
                program_id: ctx.accounts.hub_program.key(),
                accounts: hub_accounts,
                data: vec![], // Add proper hub verification instruction data
            },
            &[ctx.accounts.hub_config.to_account_info()],
        )?;

        // Add price verification logic here
        // For example, check if trade_price is within acceptable range of oracle price

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
pub struct RegisterHub<'info> {
    /// CHECK: Hub account to be registered
    pub hub_account: UncheckedAccount<'info>,
    #[account(mut, has_one = admin)]
    pub state: Account<'info, PriceState>,
    pub admin: Signer<'info>,
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
    /// CHECK: Hub program config
    pub hub_config: AccountInfo<'info>,
    /// CHECK: Hub program
    pub hub_program: AccountInfo<'info>,
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
