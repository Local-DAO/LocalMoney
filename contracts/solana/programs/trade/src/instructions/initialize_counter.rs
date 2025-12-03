use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct InitializeCounter<'info> {
    #[account(
        init,
        payer = admin,
        space = TradeCounter::LEN,
        seeds = [b"trade_counter"],
        bump
    )]
    pub counter: Account<'info, TradeCounter>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeCounter>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    counter.bump = ctx.bumps.counter;
    counter.next_id = 0;

    emit!(CounterInitialized {
        next_id: counter.next_id,
    });

    Ok(())
}

#[event]
pub struct CounterInitialized {
    pub next_id: u64,
}
