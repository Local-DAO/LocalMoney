use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ProfileError;

#[derive(Accounts)]
pub struct UpdateActiveCounters<'info> {
    #[account(
        mut,
        seeds = [b"profile", profile.owner.as_ref()],
        bump = profile.bump
    )]
    pub profile: Account<'info, UserProfile>,

    /// The program claiming to be the caller (must match Hub's trade_program or offer_program)
    /// CHECK: Verified against hub_config.trade_program or hub_config.offer_program
    pub caller_program: AccountInfo<'info>,

    /// Hub config for authorization - verifies caller is authorized program
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID,
    )]
    pub hub_config: Account<'info, hub::state::HubConfig>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CounterType {
    ActiveOffers,
    ActiveTrades,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CounterOperation {
    Increment,
    Decrement,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateActiveCountersParams {
    pub counter_type: CounterType,
    pub operation: CounterOperation,
}

pub fn handler(
    ctx: Context<UpdateActiveCounters>,
    params: UpdateActiveCountersParams,
) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    let hub_config = &ctx.accounts.hub_config;
    let clock = Clock::get()?;

    // Verify caller_program is an authorized program (Trade or Offer) from Hub config
    let caller = ctx.accounts.caller_program.key();
    require!(
        caller == hub_config.trade_program || caller == hub_config.offer_program,
        ProfileError::UnauthorizedProgramCall
    );

    // Update counter based on type and operation
    match (params.counter_type, params.operation) {
        (CounterType::ActiveOffers, CounterOperation::Increment) => {
            profile.increment_active_offers()?;
        }
        (CounterType::ActiveOffers, CounterOperation::Decrement) => {
            profile.decrement_active_offers()?;
        }
        (CounterType::ActiveTrades, CounterOperation::Increment) => {
            profile.increment_active_trades()?;
        }
        (CounterType::ActiveTrades, CounterOperation::Decrement) => {
            profile.decrement_active_trades()?;
        }
    }

    // Update timestamp
    profile.updated_at = clock.unix_timestamp;

    emit!(ActiveCountersUpdated {
        user: profile.owner,
        active_offers: profile.active_offers,
        active_trades: profile.active_trades,
    });

    Ok(())
}

#[event]
pub struct ActiveCountersUpdated {
    pub user: Pubkey,
    pub active_offers: u8,
    pub active_trades: u8,
}
