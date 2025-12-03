use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::state::*;
use crate::errors::*;
use hub::state::HubConfig;
use hub::program::Hub;
use profile::cpi::accounts::UpdateTradeStats;
use profile::cpi::update_trade_stats;
use profile::program::Profile;
use profile::state::UserProfile;
use profile::instructions::{UpdateTradeStatsParams, UpdateActiveCountersParams, CounterType, CounterOperation};
use escrow::cpi::accounts::ReleaseEscrow as EscrowReleaseAccounts;
use escrow::cpi::release_escrow as escrow_release_cpi;
use escrow::program::Escrow;
use escrow::state::EscrowVault;
use escrow::instructions::ReleaseEscrowParams;
use offer::state::{Offer, OfferType};

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    #[account(
        mut,
        seeds = [b"trade", trade.id.to_le_bytes().as_ref()],
        bump = trade.bump,
    )]
    pub trade: Box<Account<'info, Trade>>,

    /// The party initiating release (seller for normal flow, or arbitrator for disputes)
    pub releaser: Signer<'info>,

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

    /// Recipient's token account (buyer or seller depending on offer type and dispute)
    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    /// Treasury token account (for chain fee)
    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// Warchest token account (for warchest fee)
    #[account(mut)]
    pub warchest_token_account: Account<'info, TokenAccount>,

    /// Arbitrator token account (for arbitrator fee if disputed)
    #[account(mut)]
    pub arbitrator_token_account: Option<Account<'info, TokenAccount>>,

    /// Hub config (for fee configuration)
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID
    )]
    pub hub_config: Box<Account<'info, HubConfig>>,

    /// Buyer's profile (for statistics update)
    #[account(
        mut,
        seeds = [b"profile", trade.buyer.as_ref()],
        bump = buyer_profile.bump,
        seeds::program = profile::ID
    )]
    pub buyer_profile: Box<Account<'info, UserProfile>>,

    /// Seller's profile (for statistics update)
    #[account(
        mut,
        seeds = [b"profile", trade.seller.as_ref()],
        bump = seller_profile.bump,
        seeds::program = profile::ID
    )]
    pub seller_profile: Box<Account<'info, UserProfile>>,

    /// The offer (to determine recipient and offer type)
    #[account(
        seeds = [b"offer", trade.offer_id.to_le_bytes().as_ref()],
        bump = offer.bump,
        seeds::program = offer::ID
    )]
    pub offer: Box<Account<'info, Offer>>,

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

pub fn handler(ctx: Context<ReleaseEscrow>) -> Result<()> {
    let trade = &mut ctx.accounts.trade;
    let hub_config = &ctx.accounts.hub_config;
    let offer = &ctx.accounts.offer;
    let clock = Clock::get()?;

    // Check circuit breaker for escrow release
    require!(
        !hub_config.global_pause && !hub_config.pause_escrow_release,
        TradeError::EscrowReleasePaused
    );

    // Check trade is in FiatDeposited or DisputeResolved state
    require!(
        trade.state == TradeState::FiatDeposited || trade.state == TradeState::DisputeResolved,
        TradeError::InvalidState
    );

    // For DisputeResolved, verify releaser is the assigned arbitrator
    if trade.state == TradeState::DisputeResolved {
        require!(
            trade.arbitrator.is_some(),
            TradeError::ArbitratorNotAssigned
        );
        require!(
            ctx.accounts.releaser.key() == trade.arbitrator.unwrap(),
            TradeError::OnlyAssignedArbitrator
        );
    } else {
        // For normal flow, verify releaser is seller
        require!(
            ctx.accounts.releaser.key() == trade.seller,
            TradeError::OnlySeller
        );
    }

    // Get fee configuration from Hub config
    let burn_fee_pct = hub_config.burn_fee_pct;
    let chain_fee_pct = hub_config.chain_fee_pct;
    let warchest_fee_pct = hub_config.warchest_fee_pct;
    let arbitrator_fee_pct = if trade.is_disputed() {
        Some(hub_config.arbitrator_fee_pct)
    } else {
        None
    };

    // Call Escrow program via CPI to release with fee distribution
    let cpi_program = ctx.accounts.escrow_program.to_account_info();
    let cpi_accounts = EscrowReleaseAccounts {
        vault: ctx.accounts.escrow_vault.to_account_info(),
        vault_token_account: ctx.accounts.escrow_vault_token_account.to_account_info(),
        recipient_token_account: ctx.accounts.recipient_token_account.to_account_info(),
        treasury_token_account: ctx.accounts.treasury_token_account.to_account_info(),
        warchest_token_account: ctx.accounts.warchest_token_account.to_account_info(),
        arbitrator_token_account: ctx.accounts.arbitrator_token_account.as_ref().map(|a| a.to_account_info()),
        // Pass this program (Trade) as the caller for authorization verification
        caller_program: ctx.accounts.trade_program.to_account_info(),
        // Hub config for authorization verification
        hub_config: ctx.accounts.hub_config.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    escrow_release_cpi(
        cpi_ctx,
        ReleaseEscrowParams {
            burn_fee_pct,
            chain_fee_pct,
            warchest_fee_pct,
            arbitrator_fee_pct,
        },
    )?;

    // Determine which party is buyer and which is seller for statistics
    let is_buyer_trade = offer.offer_type == OfferType::Buy;

    // Reuse AccountInfo for CPI calls
    let profile_program_info = ctx.accounts.profile_program.to_account_info();
    let trade_program_info = ctx.accounts.trade_program.to_account_info();
    let hub_config_info = ctx.accounts.hub_config.to_account_info();

    // Call Profile program via CPI to update buyer statistics
    let buyer_cpi_accounts = UpdateTradeStats {
        profile: ctx.accounts.buyer_profile.to_account_info(),
        // Pass this program (Trade) as the caller for authorization verification
        caller_program: trade_program_info.clone(),
        // Hub config for authorization verification
        hub_config: hub_config_info.clone(),
    };
    let buyer_cpi_ctx = CpiContext::new(profile_program_info.clone(), buyer_cpi_accounts);

    update_trade_stats(
        buyer_cpi_ctx,
        UpdateTradeStatsParams {
            is_buy: is_buyer_trade,
            fiat_amount: trade.fiat_amount,
            completed: true,
            disputed: trade.is_disputed(),
        },
    )?;

    // Call Profile program via CPI to update seller statistics
    let seller_cpi_accounts = UpdateTradeStats {
        profile: ctx.accounts.seller_profile.to_account_info(),
        // Pass this program (Trade) as the caller for authorization verification
        caller_program: trade_program_info,
        // Hub config for authorization verification
        hub_config: hub_config_info,
    };
    let seller_cpi_ctx = CpiContext::new(profile_program_info, seller_cpi_accounts);

    update_trade_stats(
        seller_cpi_ctx,
        UpdateTradeStatsParams {
            is_buy: !is_buyer_trade,
            fiat_amount: trade.fiat_amount,
            completed: true,
            disputed: trade.is_disputed(),
        },
    )?;

    // Transition state
    trade.transition_to(TradeState::EscrowReleased)?;

    // Update timestamp
    trade.updated_at = clock.unix_timestamp;

    // Determine recipient based on offer type
    let recipient = trade.get_escrow_recipient(offer.offer_type);

    emit!(EscrowReleased {
        trade_id: trade.id,
        recipient,
        amount: trade.amount,
    });

    Ok(())
}

#[event]
pub struct EscrowReleased {
    pub trade_id: u64,
    pub recipient: Pubkey,
    pub amount: u64,
}
