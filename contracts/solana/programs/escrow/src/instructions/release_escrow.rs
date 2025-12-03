use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
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

    /// Recipient's token account
    #[account(
        mut,
        token::mint = vault.token_mint
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    /// Treasury token account (for chain fee)
    #[account(
        mut,
        token::mint = vault.token_mint
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// Warchest token account
    #[account(
        mut,
        token::mint = vault.token_mint
    )]
    pub warchest_token_account: Account<'info, TokenAccount>,

    /// Arbitrator token account (optional, for disputes)
    #[account(
        mut,
        token::mint = vault.token_mint
    )]
    pub arbitrator_token_account: Option<Account<'info, TokenAccount>>,

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

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ReleaseEscrowParams {
    pub burn_fee_pct: u16,
    pub chain_fee_pct: u16,
    pub warchest_fee_pct: u16,
    pub arbitrator_fee_pct: Option<u16>,
}

pub fn handler(ctx: Context<ReleaseEscrow>, params: ReleaseEscrowParams) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let hub_config = &ctx.accounts.hub_config;
    let clock = Clock::get()?;

    // Verify caller_program is the authorized Trade program from Hub config
    require!(
        ctx.accounts.caller_program.key() == hub_config.trade_program,
        EscrowError::Unauthorized
    );

    // Check vault can be released
    require!(vault.can_release(), EscrowError::EscrowFrozen);

    // Calculate fee distribution
    let fees = vault.calculate_fees(
        params.burn_fee_pct,
        params.chain_fee_pct,
        params.warchest_fee_pct,
        params.arbitrator_fee_pct,
    )?;

    // Prepare PDA signer seeds
    let trade_id_bytes = vault.trade_id.to_le_bytes();
    let seeds = &[
        b"escrow_vault".as_ref(),
        trade_id_bytes.as_ref(),
        &[vault.bump],
    ];
    let signer = &[&seeds[..]];

    // Transfer chain fee to treasury
    if fees.chain_fee > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.treasury_token_account.to_account_info(),
            authority: vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer(cpi_ctx, fees.chain_fee)?;
    }

    // Transfer warchest fee
    if fees.warchest_fee > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.warchest_token_account.to_account_info(),
            authority: vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer(cpi_ctx, fees.warchest_fee)?;
    }

    // Transfer arbitrator fee (if dispute was resolved)
    if fees.arbitrator_fee > 0 {
        if let Some(arbitrator_account) = &ctx.accounts.arbitrator_token_account {
            let cpi_accounts = Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: arbitrator_account.to_account_info(),
                authority: vault.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

            token::transfer(cpi_ctx, fees.arbitrator_fee)?;
        }
    }

    // Note: Burn fee is handled by burning tokens (not implemented here, as it requires
    // token mint authority or using a burn-capable token like Token-2022)
    // For now, burn fee is effectively retained in the vault or could be sent to a burn address

    // Transfer remaining amount to recipient
    if fees.recipient_amount > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer(cpi_ctx, fees.recipient_amount)?;
    }

    // Mark as released
    vault.mark_released(clock.unix_timestamp)?;

    emit!(EscrowReleased {
        trade_id: vault.trade_id,
        recipient: ctx.accounts.recipient_token_account.owner,
        amount: vault.amount,
        fees: fees.total_fees,
    });

    Ok(())
}

#[event]
pub struct EscrowReleased {
    pub trade_id: u64,
    pub recipient: Pubkey,
    pub amount: u64,
    pub fees: u64,
}
