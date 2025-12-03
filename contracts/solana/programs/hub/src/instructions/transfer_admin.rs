use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct TransferAdmin<'info> {
    #[account(
        mut,
        seeds = [b"hub_config"],
        bump = config.bump,
        has_one = admin @ HubError::Unauthorized
    )]
    pub config: Account<'info, HubConfig>,

    pub admin: Signer<'info>,

    /// CHECK: New admin address, validated in handler
    pub new_admin: AccountInfo<'info>,
}

pub fn handler(ctx: Context<TransferAdmin>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let old_admin = config.admin;
    let new_admin = ctx.accounts.new_admin.key();

    // Validate new admin is not zero address
    require!(
        new_admin != Pubkey::default(),
        HubError::InvalidAddress
    );

    // Transfer admin
    config.admin = new_admin;

    emit!(AdminTransferred {
        old_admin,
        new_admin,
        config_address: ctx.accounts.config.key(),
    });

    Ok(())
}

#[event]
pub struct AdminTransferred {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
    pub config_address: Pubkey,
}
