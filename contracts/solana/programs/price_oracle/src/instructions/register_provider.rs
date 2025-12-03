use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(provider_pubkey: Pubkey)]
pub struct RegisterProvider<'info> {
    #[account(
        mut,
        seeds = [b"price_provider_registry"],
        bump = registry.bump,
        has_one = admin @ PriceOracleError::Unauthorized
    )]
    pub registry: Account<'info, PriceProviderRegistry>,

    #[account(
        init,
        payer = admin,
        space = PriceProvider::LEN,
        seeds = [b"price_provider", provider_pubkey.as_ref()],
        bump
    )]
    pub provider: Account<'info, PriceProvider>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterProvider>,
    provider_pubkey: Pubkey,
) -> Result<()> {
    let provider = &mut ctx.accounts.provider;
    let registry = &mut ctx.accounts.registry;
    let clock = Clock::get()?;

    // Initialize provider
    provider.bump = ctx.bumps.provider;
    provider.pubkey = provider_pubkey;
    provider.is_active = true;
    provider.total_updates = 0;
    provider.registered_at = clock.unix_timestamp;
    provider.last_update_at = 0;

    // Increment registry counter
    registry.increment_providers();

    emit!(ProviderRegistered {
        provider: provider_pubkey,
        admin: ctx.accounts.admin.key(),
    });

    Ok(())
}

#[event]
pub struct ProviderRegistered {
    pub provider: Pubkey,
    pub admin: Pubkey,
}
