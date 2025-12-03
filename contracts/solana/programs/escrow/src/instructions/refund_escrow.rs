use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow_vault", vault.trade_id.to_le_bytes().as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, EscrowVault>,

    /// Vault's token account
    #[account(
        mut,
        token::mint = vault.token_mint,
        token::authority = vault
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Depositor's token account (refund destination)
    #[account(
        mut,
        token::mint = vault.token_mint
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,

    /// The program claiming to be the caller (must match Hub's trade_program)
    /// CHECK: Verified against hub_config.trade_program
    pub caller_program: AccountInfo<'info>,

    /// Hub config for authorization - verifies caller is Trade program
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID,
    )]
    pub hub_config: Account<'info, hub::state::HubConfig>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<RefundEscrow>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let hub_config = &ctx.accounts.hub_config;

    // Verify caller_program is the authorized Trade program from Hub config
    require!(
        ctx.accounts.caller_program.key() == hub_config.trade_program,
        EscrowError::Unauthorized
    );

    // Check vault is funded
    require!(vault.is_funded, EscrowError::NotFunded);

    // Check vault is not frozen
    require!(!vault.is_frozen, EscrowError::EscrowFrozen);

    // Prepare PDA signer seeds
    let trade_id_bytes = vault.trade_id.to_le_bytes();
    let seeds = &[
        b"escrow_vault".as_ref(),
        trade_id_bytes.as_ref(),
        &[vault.bump],
    ];
    let signer = &[&seeds[..]];

    // Transfer full amount back to depositor
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.depositor_token_account.to_account_info(),
        authority: vault.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

    token::transfer(cpi_ctx, vault.amount)?;

    emit!(EscrowRefunded {
        trade_id: vault.trade_id,
        depositor: vault.depositor,
        amount: vault.amount,
    });

    Ok(())
}

#[event]
pub struct EscrowRefunded {
    pub trade_id: u64,
    pub depositor: Pubkey,
    pub amount: u64,
}
