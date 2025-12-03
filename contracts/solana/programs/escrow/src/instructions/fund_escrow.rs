use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct FundEscrow<'info> {
    #[account(
        init,
        payer = depositor,
        space = EscrowVault::LEN,
        seeds = [b"escrow_vault", trade_id.to_le_bytes().as_ref()],
        bump
    )]
    pub vault: Account<'info, EscrowVault>,

    /// Depositor's token account
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = depositor
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,

    /// Vault's token account (ATA controlled by vault PDA)
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = vault
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Token mint
    /// CHECK: Validated by token program
    pub token_mint: AccountInfo<'info>,

    #[account(mut)]
    pub depositor: Signer<'info>,

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
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct FundEscrowParams {
    pub amount: u64,
}

pub fn handler(ctx: Context<FundEscrow>, trade_id: u64, params: FundEscrowParams) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let hub_config = &ctx.accounts.hub_config;
    let clock = Clock::get()?;

    // Verify caller_program is the authorized Trade program from Hub config
    require!(
        ctx.accounts.caller_program.key() == hub_config.trade_program,
        EscrowError::Unauthorized
    );

    // Validate amount
    require!(params.amount > 0, EscrowError::InvalidAmount);

    // Initialize vault state
    vault.bump = ctx.bumps.vault;
    vault.trade_id = trade_id;
    vault.token_mint = ctx.accounts.token_mint.key();
    vault.depositor = ctx.accounts.depositor.key();
    vault.is_funded = false;
    vault.is_frozen = false;
    vault.funded_at = None;
    vault.released_at = None;

    // Transfer tokens from depositor to vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.depositor_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.depositor.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    token::transfer(cpi_ctx, params.amount)?;

    // Mark vault as funded
    vault.mark_funded(params.amount, ctx.accounts.depositor.key(), clock.unix_timestamp)?;

    emit!(EscrowFunded {
        trade_id,
        depositor: vault.depositor,
        amount: vault.amount,
        token_mint: vault.token_mint,
    });

    Ok(())
}

#[event]
pub struct EscrowFunded {
    pub trade_id: u64,
    pub depositor: Pubkey,
    pub amount: u64,
    pub token_mint: Pubkey,
}
