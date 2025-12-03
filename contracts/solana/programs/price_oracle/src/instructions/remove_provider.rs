use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct RemoveProvider<'info> {
    #[account(
        mut,
        seeds = [b"price_provider_registry"],
        bump = registry.bump,
        has_one = admin @ PriceOracleError::Unauthorized
    )]
    pub registry: Account<'info, PriceProviderRegistry>,

    #[account(
        mut,
        seeds = [b"price_provider", provider.pubkey.as_ref()],
        bump = provider.bump,
    )]
    pub provider: Account<'info, PriceProvider>,

    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<RemoveProvider>) -> Result<()> {
    let provider = &mut ctx.accounts.provider;
    let registry = &mut ctx.accounts.registry;

    // Only deactivate if currently active
    require!(
        provider.is_active,
        PriceOracleError::ProviderNotActive
    );

    // Deactivate provider
    provider.is_active = false;

    // Decrement registry counter
    registry.decrement_providers();

    emit!(ProviderRemoved {
        provider: provider.pubkey,
        admin: ctx.accounts.admin.key(),
    });

    Ok(())
}

#[event]
pub struct ProviderRemoved {
    pub provider: Pubkey,
    pub admin: Pubkey,
}
