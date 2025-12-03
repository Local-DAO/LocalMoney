use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use hub::state::HubConfig;
use profile::cpi::accounts::UpdateActiveCounters;
use profile::cpi::update_active_counters;
use profile::program::Profile;
use profile::state::UserProfile;
use profile::instructions::{CounterType, CounterOperation, UpdateActiveCountersParams};

#[derive(Accounts)]
pub struct CancelTrade<'info> {
    #[account(
        mut,
        seeds = [b"trade", trade.id.to_le_bytes().as_ref()],
        bump = trade.bump,
    )]
    pub trade: Account<'info, Trade>,

    /// The party canceling (buyer or seller)
    pub canceler: Signer<'info>,

    /// Buyer's profile (for counter update)
    #[account(
        mut,
        seeds = [b"profile", trade.buyer.as_ref()],
        bump = buyer_profile.bump,
        seeds::program = profile::ID
    )]
    pub buyer_profile: Account<'info, UserProfile>,

    /// Hub config for CPI authorization
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// Profile program for CPI
    pub profile_program: Program<'info, Profile>,

    /// The Trade program account for CPI caller identification
    /// CHECK: address is verified to be this program's ID
    #[account(address = crate::ID)]
    pub trade_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<CancelTrade>) -> Result<()> {
    let trade = &mut ctx.accounts.trade;
    let clock = Clock::get()?;

    // Check trade is in RequestCreated or RequestAccepted state (before escrow funded)
    require!(
        trade.state == TradeState::RequestCreated || trade.state == TradeState::RequestAccepted,
        TradeError::InvalidState
    );

    // Verify canceler is buyer or seller
    require!(
        ctx.accounts.canceler.key() == trade.buyer || ctx.accounts.canceler.key() == trade.seller,
        TradeError::Unauthorized
    );

    // Call Profile program via CPI to decrement buyer's active_trades counter
    let cpi_program = ctx.accounts.profile_program.to_account_info();
    let cpi_accounts = UpdateActiveCounters {
        profile: ctx.accounts.buyer_profile.to_account_info(),
        // Pass this program (Trade) as the caller for authorization verification
        caller_program: ctx.accounts.trade_program.to_account_info(),
        // Hub config for authorization verification
        hub_config: ctx.accounts.hub_config.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    update_active_counters(
        cpi_ctx,
        UpdateActiveCountersParams {
            counter_type: CounterType::ActiveTrades,
            operation: CounterOperation::Decrement,
        },
    )?;

    // Transition state
    trade.transition_to(TradeState::RequestCanceled)?;

    // Update timestamp
    trade.updated_at = clock.unix_timestamp;

    emit!(TradeCanceled {
        trade_id: trade.id,
        canceler: ctx.accounts.canceler.key(),
    });

    Ok(())
}

#[event]
pub struct TradeCanceled {
    pub trade_id: u64,
    pub canceler: Pubkey,
}
