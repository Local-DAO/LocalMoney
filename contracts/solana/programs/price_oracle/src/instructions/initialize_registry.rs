use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(
        init,
        payer = admin,
        space = PriceProviderRegistry::LEN,
        seeds = [b"price_provider_registry"],
        bump
    )]
    pub registry: Account<'info, PriceProviderRegistry>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeRegistryParams {
    /// Maximum price staleness in seconds (optional, defaults to 1 hour)
    pub max_price_staleness: Option<u64>,
}

pub fn handler(
    ctx: Context<InitializeRegistry>,
    params: InitializeRegistryParams,
) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    let clock = Clock::get()?;

    // Initialize registry
    registry.bump = ctx.bumps.registry;
    registry.admin = ctx.accounts.admin.key();
    registry.total_providers = 0;
    registry.max_price_staleness = params
        .max_price_staleness
        .unwrap_or(PriceProviderRegistry::DEFAULT_MAX_STALENESS);
    registry.initialized_at = clock.unix_timestamp;

    // Validate staleness limit
    require!(
        registry.max_price_staleness <= PriceProviderRegistry::MAX_STALENESS_LIMIT,
        crate::errors::PriceOracleError::InvalidPriceValue
    );

    emit!(RegistryInitialized {
        admin: registry.admin,
        max_price_staleness: registry.max_price_staleness,
    });

    Ok(())
}

#[event]
pub struct RegistryInitialized {
    pub admin: Pubkey,
    pub max_price_staleness: u64,
}
