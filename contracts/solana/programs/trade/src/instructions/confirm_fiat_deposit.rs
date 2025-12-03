use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct ConfirmFiatDeposit<'info> {
    #[account(
        mut,
        seeds = [b"trade", trade.id.to_le_bytes().as_ref()],
        bump = trade.bump,
        has_one = buyer @ TradeError::OnlyBuyer,
    )]
    pub trade: Account<'info, Trade>,

    /// The buyer confirming fiat payment
    pub buyer: Signer<'info>,
}

pub fn handler(ctx: Context<ConfirmFiatDeposit>) -> Result<()> {
    let trade = &mut ctx.accounts.trade;
    let clock = Clock::get()?;

    // Check trade is in EscrowFunded state
    require!(
        trade.state == TradeState::EscrowFunded,
        TradeError::InvalidState
    );

    // Check trade hasn't expired
    require!(
        !trade.is_expired(clock.unix_timestamp),
        TradeError::TradeExpired
    );

    // Transition state
    trade.transition_to(TradeState::FiatDeposited)?;

    // Update timestamp
    trade.updated_at = clock.unix_timestamp;

    emit!(FiatDepositConfirmed {
        trade_id: trade.id,
        buyer: trade.buyer,
    });

    Ok(())
}

#[event]
pub struct FiatDepositConfirmed {
    pub trade_id: u64,
    pub buyer: Pubkey,
}
