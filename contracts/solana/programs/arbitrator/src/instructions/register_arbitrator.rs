use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use hub::state::HubConfig;
use hub::program::Hub;

#[derive(Accounts)]
#[instruction(arbitrator_pubkey: Pubkey, fiat_currency: [u8; 3])]
pub struct RegisterArbitrator<'info> {
    #[account(
        init,
        payer = admin,
        space = Arbitrator::LEN,
        seeds = [
            b"arbitrator",
            arbitrator_pubkey.as_ref(),
            fiat_currency.as_ref()
        ],
        bump
    )]
    pub arbitrator: Account<'info, Arbitrator>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// Hub config PDA for admin verification
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID,
        constraint = hub_config.admin == admin.key() @ ArbitratorError::Unauthorized
    )]
    pub hub_config: Account<'info, HubConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterArbitrator>,
    arbitrator_pubkey: Pubkey,
    fiat_currency: [u8; 3],
) -> Result<()> {
    let arbitrator = &mut ctx.accounts.arbitrator;
    let clock = Clock::get()?;

    // Admin verification is handled via Anchor constraint on hub_config account

    // Initialize arbitrator
    arbitrator.bump = ctx.bumps.arbitrator;
    arbitrator.pubkey = arbitrator_pubkey;
    arbitrator.fiat_currency = fiat_currency;
    arbitrator.is_active = true;
    arbitrator.total_disputes = 0;
    arbitrator.resolved_disputes = 0;
    arbitrator.registered_at = clock.unix_timestamp;

    emit!(ArbitratorRegistered {
        arbitrator: arbitrator_pubkey,
        fiat_currency,
    });

    Ok(())
}

#[event]
pub struct ArbitratorRegistered {
    pub arbitrator: Pubkey,
    pub fiat_currency: [u8; 3],
}
