use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
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
pub struct UpdateConfigParams {
    // Optional program addresses
    pub offer_program: Option<Pubkey>,
    pub trade_program: Option<Pubkey>,
    pub profile_program: Option<Pubkey>,
    pub escrow_program: Option<Pubkey>,
    pub arbitrator_program: Option<Pubkey>,
    pub price_oracle_program: Option<Pubkey>,

    // Optional fee configuration
    pub burn_fee_pct: Option<u16>,
    pub chain_fee_pct: Option<u16>,
    pub warchest_fee_pct: Option<u16>,
    pub conversion_fee_pct: Option<u16>,
    pub arbitrator_fee_pct: Option<u16>,

    // Optional trading limits
    pub min_trade_amount: Option<u64>,
    pub max_trade_amount: Option<u64>,
    pub max_active_offers: Option<u8>,
    pub max_active_trades: Option<u8>,

    // Optional timers
    pub trade_expiration_timer: Option<u64>,
    pub trade_dispute_timer: Option<u64>,

    // Optional treasury addresses
    pub treasury: Option<Pubkey>,
    pub warchest: Option<Pubkey>,
}

pub fn handler(ctx: Context<UpdateConfig>, params: UpdateConfigParams) -> Result<()> {
    let config = &mut ctx.accounts.config;

    // Update program addresses if provided
    if let Some(offer_program) = params.offer_program {
        config.offer_program = offer_program;
    }
    if let Some(trade_program) = params.trade_program {
        config.trade_program = trade_program;
    }
    if let Some(profile_program) = params.profile_program {
        config.profile_program = profile_program;
    }
    if let Some(escrow_program) = params.escrow_program {
        config.escrow_program = escrow_program;
    }
    if let Some(arbitrator_program) = params.arbitrator_program {
        config.arbitrator_program = arbitrator_program;
    }
    if let Some(price_oracle_program) = params.price_oracle_program {
        config.price_oracle_program = price_oracle_program;
    }

    // Update fee configuration if provided
    if let Some(burn_fee_pct) = params.burn_fee_pct {
        config.burn_fee_pct = burn_fee_pct;
    }
    if let Some(chain_fee_pct) = params.chain_fee_pct {
        config.chain_fee_pct = chain_fee_pct;
    }
    if let Some(warchest_fee_pct) = params.warchest_fee_pct {
        config.warchest_fee_pct = warchest_fee_pct;
    }
    if let Some(conversion_fee_pct) = params.conversion_fee_pct {
        config.conversion_fee_pct = conversion_fee_pct;
    }
    if let Some(arbitrator_fee_pct) = params.arbitrator_fee_pct {
        config.arbitrator_fee_pct = arbitrator_fee_pct;
    }

    // Update trading limits if provided
    if let Some(min_trade_amount) = params.min_trade_amount {
        config.min_trade_amount = min_trade_amount;
    }
    if let Some(max_trade_amount) = params.max_trade_amount {
        config.max_trade_amount = max_trade_amount;
    }
    if let Some(max_active_offers) = params.max_active_offers {
        config.max_active_offers = max_active_offers;
    }
    if let Some(max_active_trades) = params.max_active_trades {
        config.max_active_trades = max_active_trades;
    }

    // Update timers if provided
    if let Some(trade_expiration_timer) = params.trade_expiration_timer {
        config.trade_expiration_timer = trade_expiration_timer;
    }
    if let Some(trade_dispute_timer) = params.trade_dispute_timer {
        config.trade_dispute_timer = trade_dispute_timer;
    }

    // Update treasury addresses if provided
    if let Some(treasury) = params.treasury {
        config.treasury = treasury;
    }
    if let Some(warchest) = params.warchest {
        config.warchest = warchest;
    }

    // Validate updated configuration
    config.validate_fees()?;
    config.validate_trading_limits()?;
    config.validate_timers()?;

    emit!(ConfigUpdated {
        admin: config.admin,
        config_address: ctx.accounts.config.key(),
    });

    Ok(())
}

#[event]
pub struct ConfigUpdated {
    pub admin: Pubkey,
    pub config_address: Pubkey,
}
