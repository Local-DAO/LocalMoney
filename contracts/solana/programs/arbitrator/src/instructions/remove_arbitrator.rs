use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use hub::state::HubConfig;
use hub::program::Hub;

#[derive(Accounts)]
pub struct RemoveArbitrator<'info> {
    #[account(
        mut,
        seeds = [
            b"arbitrator",
            arbitrator.pubkey.as_ref(),
            arbitrator.fiat_currency.as_ref()
        ],
        bump = arbitrator.bump
    )]
    pub arbitrator: Account<'info, Arbitrator>,

    pub admin: Signer<'info>,

    /// Hub config PDA for admin verification
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID,
        constraint = hub_config.admin == admin.key() @ ArbitratorError::Unauthorized
    )]
    pub hub_config: Account<'info, HubConfig>,
}

pub fn handler(ctx: Context<RemoveArbitrator>) -> Result<()> {
    let arbitrator = &mut ctx.accounts.arbitrator;

    // Admin verification is handled via Anchor constraint on hub_config account

    // Deactivate arbitrator
    arbitrator.is_active = false;

    emit!(ArbitratorRemoved {
        arbitrator: arbitrator.pubkey,
        fiat_currency: arbitrator.fiat_currency,
    });

    Ok(())
}

#[event]
pub struct ArbitratorRemoved {
    pub arbitrator: Pubkey,
    pub fiat_currency: [u8; 3],
}
