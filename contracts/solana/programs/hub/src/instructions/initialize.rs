use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = HubConfig::LEN,
        seeds = [b"hub_config"],
        bump
    )]
    pub config: Account<'info, HubConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeParams {
    // Program addresses
    pub offer_program: Pubkey,
    pub trade_program: Pubkey,
    pub profile_program: Pubkey,
    pub escrow_program: Pubkey,
    pub arbitrator_program: Pubkey,
    pub price_oracle_program: Pubkey,

    // Fee configuration (basis points)
    pub burn_fee_pct: u16,
    pub chain_fee_pct: u16,
    pub warchest_fee_pct: u16,
    pub conversion_fee_pct: u16,
    pub arbitrator_fee_pct: u16,

    // Trading limits
    pub min_trade_amount: u64,
    pub max_trade_amount: u64,
    pub max_active_offers: u8,
    pub max_active_trades: u8,

    // Timers
    pub trade_expiration_timer: u64,
    pub trade_dispute_timer: u64,

    // Treasury addresses
    pub treasury: Pubkey,
    pub warchest: Pubkey,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    let config = &mut ctx.accounts.config;

    // Set PDA bump
    config.bump = ctx.bumps.config;

    // Set admin
    config.admin = ctx.accounts.admin.key();

    // Set program addresses
    config.offer_program = params.offer_program;
    config.trade_program = params.trade_program;
    config.profile_program = params.profile_program;
    config.escrow_program = params.escrow_program;
    config.arbitrator_program = params.arbitrator_program;
    config.price_oracle_program = params.price_oracle_program;

    // Set fee configuration
    config.burn_fee_pct = params.burn_fee_pct;
    config.chain_fee_pct = params.chain_fee_pct;
    config.warchest_fee_pct = params.warchest_fee_pct;
    config.conversion_fee_pct = params.conversion_fee_pct;
    config.arbitrator_fee_pct = params.arbitrator_fee_pct;

    // Set trading limits
    config.min_trade_amount = params.min_trade_amount;
    config.max_trade_amount = params.max_trade_amount;
    config.max_active_offers = params.max_active_offers;
    config.max_active_trades = params.max_active_trades;

    // Set timers
    config.trade_expiration_timer = params.trade_expiration_timer;
    config.trade_dispute_timer = params.trade_dispute_timer;

    // Initialize circuit breakers (all unpaused)
    config.global_pause = false;
    config.pause_new_offers = false;
    config.pause_new_trades = false;
    config.pause_escrow_funding = false;
    config.pause_escrow_release = false;

    // Set treasury addresses
    config.treasury = params.treasury;
    config.warchest = params.warchest;

    // Validate configuration
    config.validate_fees()?;
    config.validate_trading_limits()?;
    config.validate_timers()?;

    emit!(HubInitialized {
        admin: config.admin,
        config_address: ctx.accounts.config.key(),
    });

    Ok(())
}

#[event]
pub struct HubInitialized {
    pub admin: Pubkey,
    pub config_address: Pubkey,
}
