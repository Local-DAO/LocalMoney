use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::state::*;
use crate::errors::*;
use offer::state::{Offer, OfferState};
use escrow::cpi::accounts::FundEscrow as EscrowFundAccounts;
use escrow::cpi::fund_escrow as escrow_fund_cpi;
use escrow::program::Escrow;
use escrow::instructions::FundEscrowParams;
use hub::state::HubConfig;

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(
        mut,
        seeds = [b"trade", trade.id.to_le_bytes().as_ref()],
        bump = trade.bump,
    )]
    pub trade: Account<'info, Trade>,

    /// The party funding escrow (buyer or seller depending on offer type)
    #[account(mut)]
    pub funder: Signer<'info>,

    /// Funder's token account
    #[account(
        mut,
        constraint = funder_token_account.mint == trade.token_mint @ TradeError::TokenMintMismatch,
        constraint = funder_token_account.owner == funder.key() @ TradeError::Unauthorized,
    )]
    pub funder_token_account: Account<'info, TokenAccount>,

    /// Escrow vault PDA (will be initialized by escrow program via CPI)
    /// CHECK: Initialized by escrow program
    #[account(mut)]
    pub escrow_vault: UncheckedAccount<'info>,

    /// Escrow vault's token account (ATA controlled by vault PDA)
    #[account(
        mut,
        constraint = vault_token_account.key() == trade.escrow_vault @ TradeError::Unauthorized,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Token mint
    /// CHECK: Validated by escrow program
    pub token_mint: AccountInfo<'info>,

    /// The offer (to determine who should fund and validate it's still active)
    #[account(
        seeds = [b"offer", trade.offer_id.to_le_bytes().as_ref()],
        bump = offer.bump,
        seeds::program = offer::ID,
        constraint = offer.state == OfferState::Active @ TradeError::OfferNotActive
    )]
    pub offer: Account<'info, Offer>,

    /// Hub config for CPI authorization
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// Escrow program for CPI
    pub escrow_program: Program<'info, Escrow>,

    /// The Trade program account for CPI caller identification
    /// CHECK: address is verified to be this program's ID
    #[account(address = crate::ID)]
    pub trade_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<FundEscrow>) -> Result<()> {
    let trade = &mut ctx.accounts.trade;
    let offer = &ctx.accounts.offer;
    let clock = Clock::get()?;

    // Check trade is in RequestAccepted state
    require!(
        trade.state == TradeState::RequestAccepted,
        TradeError::InvalidState
    );

    // Check trade hasn't expired
    require!(
        !trade.is_expired(clock.unix_timestamp),
        TradeError::TradeExpired
    );

    // Get offer type from the validated offer account
    let offer_type = offer.offer_type;

    // Verify funder is the correct party based on offer type
    let expected_funder = trade.get_escrow_funder(offer_type);
    require!(
        ctx.accounts.funder.key() == expected_funder,
        TradeError::Unauthorized
    );

    // Call Escrow program via CPI to fund escrow
    // This creates the EscrowVault state PDA and transfers tokens
    let cpi_program = ctx.accounts.escrow_program.to_account_info();
    let cpi_accounts = EscrowFundAccounts {
        vault: ctx.accounts.escrow_vault.to_account_info(),
        depositor_token_account: ctx.accounts.funder_token_account.to_account_info(),
        vault_token_account: ctx.accounts.vault_token_account.to_account_info(),
        token_mint: ctx.accounts.token_mint.to_account_info(),
        depositor: ctx.accounts.funder.to_account_info(),
        caller_program: ctx.accounts.trade_program.to_account_info(),
        hub_config: ctx.accounts.hub_config.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    escrow_fund_cpi(
        cpi_ctx,
        trade.id,
        FundEscrowParams {
            amount: trade.amount,
        },
    )?;

    // Transition state
    trade.transition_to(TradeState::EscrowFunded)?;

    // Update timestamp
    trade.updated_at = clock.unix_timestamp;

    emit!(EscrowFunded {
        trade_id: trade.id,
        amount: trade.amount,
        funder: ctx.accounts.funder.key(),
    });

    Ok(())
}

#[event]
pub struct EscrowFunded {
    pub trade_id: u64,
    pub amount: u64,
    pub funder: Pubkey,
}
