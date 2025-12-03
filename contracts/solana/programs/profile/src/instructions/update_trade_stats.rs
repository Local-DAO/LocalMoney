use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ProfileError;

#[derive(Accounts)]
pub struct UpdateTradeStats<'info> {
    #[account(
        mut,
        seeds = [b"profile", profile.owner.as_ref()],
        bump = profile.bump
    )]
    pub profile: Account<'info, UserProfile>,

    /// The program claiming to be the caller (must match Hub's trade_program)
    /// CHECK: Verified against hub_config.trade_program
    pub caller_program: AccountInfo<'info>,

    /// Hub config for authorization - verifies caller is authorized program
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID,
    )]
    pub hub_config: Account<'info, hub::state::HubConfig>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateTradeStatsParams {
    pub is_buy: bool,
    pub fiat_amount: u64,
    pub completed: bool,
    pub disputed: bool,
}

pub fn handler(ctx: Context<UpdateTradeStats>, params: UpdateTradeStatsParams) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    let hub_config = &ctx.accounts.hub_config;
    let clock = Clock::get()?;

    // Verify caller_program is the authorized Trade program from Hub config
    require!(
        ctx.accounts.caller_program.key() == hub_config.trade_program,
        ProfileError::UnauthorizedProgramCall
    );

    // Update trade statistics
    profile.increment_trade_stats(
        params.is_buy,
        params.fiat_amount,
        params.completed,
        params.disputed,
    );

    // Update timestamp
    profile.updated_at = clock.unix_timestamp;

    emit!(TradeStatsUpdated {
        user: profile.owner,
        total_trades: profile.total_trades,
        completed_trades: profile.completed_trades,
        disputed_trades: profile.disputed_trades,
        reputation_score: profile.reputation_score,
    });

    Ok(())
}

#[event]
pub struct TradeStatsUpdated {
    pub user: Pubkey,
    pub total_trades: u64,
    pub completed_trades: u64,
    pub disputed_trades: u64,
    pub reputation_score: u16,
}
