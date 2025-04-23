use anchor_lang::prelude::*;
use localmoney_shared::{constants::*, errors::LocalMoneyError, price::*};

declare_id!("HpUVnehKAfNRzC12m9EYwhwjMwbWKTbcaCwPpwVGoNrC");

#[program]
pub mod price {
    use super::*;

    /// Initialize the price program
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let price_config = &mut ctx.accounts.price_config;

        price_config.hub_authority = ctx.accounts.hub_authority.key();
        price_config.price_provider = ctx.accounts.authority.key();

        // Set a default bump value
        price_config.bump = 255; // Will be set by the Anchor account initialization

        Ok(())
    }

    /// Register the price program with the hub
    pub fn register_hub(ctx: Context<RegisterHub>) -> Result<()> {
        // The hub program handles most of the logic
        // This is just a validation step for the price program
        require!(
            ctx.accounts.price_config.hub_authority == ctx.accounts.hub_authority.key(),
            LocalMoneyError::Unauthorized
        );

        Ok(())
    }

    /// Update price data for a fiat currency
    pub fn update_prices(
        ctx: Context<UpdatePrices>,
        currency: FiatCurrency,
        price: u64,
    ) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;
        let currency_price = &mut ctx.accounts.currency_price;

        currency_price.currency = currency;
        currency_price.usd_price = price;
        currency_price.updated_at = current_time;

        Ok(())
    }

    /// Register a price route for a token
    pub fn register_price_route(ctx: Context<RegisterPriceRoute>) -> Result<()> {
        let price_route = &mut ctx.accounts.price_route;

        price_route.offer_asset_mint = ctx.accounts.offer_asset_mint.key();
        price_route.ask_asset_mint = ctx.accounts.ask_asset_mint.key();
        price_route.pool = ctx.accounts.pool.key();

        Ok(())
    }
}

/// Initialize the price program
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Hub authority for validating program interactions
    /// CHECK: Just used as a reference for validation
    pub hub_authority: UncheckedAccount<'info>,

    /// Price configuration account
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<PriceConfig>(),
        seeds = [PRICE_CONFIG_SEED],
        bump,
    )]
    pub price_config: Account<'info, PriceConfig>,

    pub system_program: Program<'info, System>,
}

/// Register the price program with the hub
#[derive(Accounts)]
pub struct RegisterHub<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Hub authority account verified in the function
    pub hub_authority: UncheckedAccount<'info>,

    #[account(
        seeds = [PRICE_CONFIG_SEED],
        bump = price_config.bump,
    )]
    pub price_config: Account<'info, PriceConfig>,
}

/// Update price data for a fiat currency
#[derive(Accounts)]
#[instruction(currency: FiatCurrency, price: u64)]
pub struct UpdatePrices<'info> {
    #[account(
        mut,
        constraint = authority.key() == price_config.price_provider @ LocalMoneyError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [PRICE_CONFIG_SEED],
        bump = price_config.bump
    )]
    pub price_config: Account<'info, PriceConfig>,

    /// Currency price account to update
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + std::mem::size_of::<CurrencyPrice>(),
        seeds = [CURRENCY_PRICE_SEED, currency.to_string().as_bytes()],
        bump
    )]
    pub currency_price: Account<'info, CurrencyPrice>,

    pub system_program: Program<'info, System>,
}

/// Register a price route for conversion between tokens
#[derive(Accounts)]
pub struct RegisterPriceRoute<'info> {
    #[account(
        mut,
        constraint = authority.key() == price_config.hub_authority @ LocalMoneyError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [PRICE_CONFIG_SEED],
        bump = price_config.bump
    )]
    pub price_config: Account<'info, PriceConfig>,

    /// The token being offered
    /// CHECK: Just used as a reference
    pub offer_asset_mint: UncheckedAccount<'info>,

    /// The token being asked for
    /// CHECK: Just used as a reference
    pub ask_asset_mint: UncheckedAccount<'info>,

    /// The pool/AMM that will be used for price conversion
    /// CHECK: Just used as a reference
    pub pool: UncheckedAccount<'info>,

    /// Price route account
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<PriceRoute>(),
        seeds = [
            PRICE_ROUTE_SEED,
            offer_asset_mint.key().as_ref(),
            ask_asset_mint.key().as_ref()
        ],
        bump,
    )]
    pub price_route: Account<'info, PriceRoute>,

    pub system_program: Program<'info, System>,
}
