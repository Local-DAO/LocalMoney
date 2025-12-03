use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct FreezeEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow_vault", vault.trade_id.to_le_bytes().as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, EscrowVault>,

    /// The program claiming to be the caller (must match Hub's trade_program or arbitrator_program)
    /// CHECK: Verified against hub_config.trade_program or hub_config.arbitrator_program
    pub caller_program: AccountInfo<'info>,

    /// Hub config for authorization - verifies caller is Trade or Arbitrator program
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID,
    )]
    pub hub_config: Account<'info, hub::state::HubConfig>,
}

pub fn handler(ctx: Context<FreezeEscrow>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let hub_config = &ctx.accounts.hub_config;

    // Verify caller_program is Trade or Arbitrator program from Hub config
    let caller = ctx.accounts.caller_program.key();
    require!(
        caller == hub_config.trade_program || caller == hub_config.arbitrator_program,
        EscrowError::Unauthorized
    );

    // Freeze the vault
    vault.freeze()?;

    emit!(EscrowFrozen {
        trade_id: vault.trade_id,
    });

    Ok(())
}

#[event]
pub struct EscrowFrozen {
    pub trade_id: u64,
}
