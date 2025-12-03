use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct SetCircuitBreaker<'info> {
    #[account(
        mut,
        seeds = [b"hub_config"],
        bump = config.bump,
        has_one = admin @ HubError::Unauthorized
    )]
    pub config: Account<'info, HubConfig>,

    pub admin: Signer<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CircuitBreakerParams {
    pub global_pause: Option<bool>,
    pub pause_new_offers: Option<bool>,
    pub pause_new_trades: Option<bool>,
    pub pause_escrow_funding: Option<bool>,
    pub pause_escrow_release: Option<bool>,
}

pub fn handler(ctx: Context<SetCircuitBreaker>, params: CircuitBreakerParams) -> Result<()> {
    let config = &mut ctx.accounts.config;

    // Update circuit breakers if provided
    if let Some(global_pause) = params.global_pause {
        config.global_pause = global_pause;
    }
    if let Some(pause_new_offers) = params.pause_new_offers {
        config.pause_new_offers = pause_new_offers;
    }
    if let Some(pause_new_trades) = params.pause_new_trades {
        config.pause_new_trades = pause_new_trades;
    }
    if let Some(pause_escrow_funding) = params.pause_escrow_funding {
        config.pause_escrow_funding = pause_escrow_funding;
    }
    if let Some(pause_escrow_release) = params.pause_escrow_release {
        config.pause_escrow_release = pause_escrow_release;
    }

    emit!(CircuitBreakerSet {
        admin: config.admin,
        global_pause: config.global_pause,
        pause_new_offers: config.pause_new_offers,
        pause_new_trades: config.pause_new_trades,
        pause_escrow_funding: config.pause_escrow_funding,
        pause_escrow_release: config.pause_escrow_release,
    });

    Ok(())
}

#[event]
pub struct CircuitBreakerSet {
    pub admin: Pubkey,
    pub global_pause: bool,
    pub pause_new_offers: bool,
    pub pause_new_trades: bool,
    pub pause_escrow_funding: bool,
    pub pause_escrow_release: bool,
}
