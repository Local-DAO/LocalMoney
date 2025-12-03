use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(
        seeds = [b"price_provider_registry"],
        bump = registry.bump,
    )]
    pub registry: Account<'info, PriceProviderRegistry>,

    #[account(
        mut,
        seeds = [b"price_provider", provider_signer.key().as_ref()],
        bump = provider.bump,
    )]
    pub provider: Account<'info, PriceProvider>,

    #[account(
        mut,
        seeds = [b"price", price.fiat_currency.as_ref()],
        bump = price.bump,
    )]
    pub price: Account<'info, Price>,

    pub provider_signer: Signer<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdatePriceParams {
    /// New price value
    pub value: u64,
}

pub fn handler(
    ctx: Context<UpdatePrice>,
    params: UpdatePriceParams,
) -> Result<()> {
    let price = &mut ctx.accounts.price;
    let provider = &mut ctx.accounts.provider;
    let clock = Clock::get()?;

    // Verify provider is active
    require!(
        provider.is_active,
        PriceOracleError::ProviderNotActive
    );

    // Verify provider pubkey matches signer
    require!(
        provider.pubkey == ctx.accounts.provider_signer.key(),
        PriceOracleError::UnauthorizedProvider
    );

    // Update price
    price.update_value(
        params.value,
        provider.pubkey,
        clock.unix_timestamp,
    )?;

    // Update provider statistics
    provider.increment_updates(clock.unix_timestamp);

    emit!(PriceUpdated {
        fiat_currency: price.fiat_currency,
        value: params.value,
        provider: provider.pubkey,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[event]
pub struct PriceUpdated {
    pub fiat_currency: [u8; 3],
    pub value: u64,
    pub provider: Pubkey,
    pub timestamp: i64,
}
