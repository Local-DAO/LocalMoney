use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::state::*;
use crate::errors::*;
use hub::state::HubConfig;
use profile::cpi::accounts::UpdateActiveCounters;
use profile::cpi::update_active_counters;
use profile::program::Profile;
use profile::state::UserProfile;
use profile::instructions::{CounterType, CounterOperation, UpdateActiveCountersParams};
use escrow::cpi::accounts::RefundEscrow as EscrowRefundAccounts;
use escrow::cpi::refund_escrow as escrow_refund_cpi;
use escrow::program::Escrow;
use escrow::state::EscrowVault;
use offer::state::{Offer, OfferType};

#[derive(Accounts)]
pub struct RefundTrade<'info> {
    #[account(
        mut,
        seeds = [b"trade", trade.id.to_le_bytes().as_ref()],
        bump = trade.bump,
    )]
    pub trade: Account<'info, Trade>,

    /// The party initiating refund (buyer or seller)
    pub refunder: Signer<'info>,

    /// Escrow vault PDA
    #[account(
        mut,
        seeds = [b"escrow_vault", trade.id.to_le_bytes().as_ref()],
        bump = escrow_vault.bump,
        seeds::program = escrow::ID
    )]
    pub escrow_vault: Account<'info, EscrowVault>,

    /// Escrow vault's token account
    #[account(
        mut,
        constraint = escrow_vault_token_account.owner == escrow_vault.key(),
    )]
    pub escrow_vault_token_account: Account<'info, TokenAccount>,

    /// Depositor's token account (to receive refund)
    #[account(mut)]
    pub depositor_token_account: Account<'info, TokenAccount>,

    /// The offer (to determine who deposited)
    #[account(
        seeds = [b"offer", trade.offer_id.to_le_bytes().as_ref()],
        bump = offer.bump,
        seeds::program = offer::ID
    )]
    pub offer: Account<'info, Offer>,

    /// Buyer's profile (for counter update)
    #[account(
        mut,
        seeds = [b"profile", trade.buyer.as_ref()],
        bump = buyer_profile.bump,
        seeds::program = profile::ID
    )]
    pub buyer_profile: Account<'info, UserProfile>,

    /// Hub config for CPI authorization
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// Escrow program for CPI
    pub escrow_program: Program<'info, Escrow>,

    /// Profile program for CPI
    pub profile_program: Program<'info, Profile>,

    /// The Trade program account for CPI caller identification
    /// CHECK: address is verified to be this program's ID
    #[account(address = crate::ID)]
    pub trade_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<RefundTrade>) -> Result<()> {
    let trade = &mut ctx.accounts.trade;
    let clock = Clock::get()?;

    // Check trade is in EscrowFunded state
    require!(
        trade.state == TradeState::EscrowFunded,
        TradeError::InvalidState
    );

    // Verify refunder is buyer or seller
    require!(
        ctx.accounts.refunder.key() == trade.buyer || ctx.accounts.refunder.key() == trade.seller,
        TradeError::Unauthorized
    );

    // Get offer type to determine who deposited
    let offer_type = ctx.accounts.offer.offer_type;

    // Call Escrow program via CPI to refund tokens to depositor
    let escrow_cpi_program = ctx.accounts.escrow_program.to_account_info();
    let escrow_cpi_accounts = EscrowRefundAccounts {
        vault: ctx.accounts.escrow_vault.to_account_info(),
        vault_token_account: ctx.accounts.escrow_vault_token_account.to_account_info(),
        depositor_token_account: ctx.accounts.depositor_token_account.to_account_info(),
        // Pass this program (Trade) as the caller for authorization verification
        caller_program: ctx.accounts.trade_program.to_account_info(),
        // Hub config for authorization verification
        hub_config: ctx.accounts.hub_config.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };
    let escrow_cpi_ctx = CpiContext::new(escrow_cpi_program, escrow_cpi_accounts);

    escrow_refund_cpi(escrow_cpi_ctx)?;

    // Call Profile program via CPI to decrement buyer's active_trades counter
    let profile_cpi_program = ctx.accounts.profile_program.to_account_info();
    let profile_cpi_accounts = UpdateActiveCounters {
        profile: ctx.accounts.buyer_profile.to_account_info(),
        // Pass this program (Trade) as the caller for authorization verification
        caller_program: ctx.accounts.trade_program.to_account_info(),
        // Hub config for authorization verification
        hub_config: ctx.accounts.hub_config.to_account_info(),
    };
    let profile_cpi_ctx = CpiContext::new(profile_cpi_program, profile_cpi_accounts);

    update_active_counters(
        profile_cpi_ctx,
        UpdateActiveCountersParams {
            counter_type: CounterType::ActiveTrades,
            operation: CounterOperation::Decrement,
        },
    )?;

    // Transition state
    trade.transition_to(TradeState::EscrowRefunded)?;

    // Update timestamp
    trade.updated_at = clock.unix_timestamp;

    emit!(TradeRefunded {
        trade_id: trade.id,
        amount: trade.amount,
        depositor: trade.get_escrow_funder(offer_type),
    });

    Ok(())
}

#[event]
pub struct TradeRefunded {
    pub trade_id: u64,
    pub amount: u64,
    pub depositor: Pubkey,
}
