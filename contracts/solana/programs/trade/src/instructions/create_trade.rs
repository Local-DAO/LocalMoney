use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use hub::state::HubConfig;
use offer::state::{Offer, OfferState};
use profile::cpi::accounts::UpdateActiveCounters;
use profile::cpi::update_active_counters;
use profile::program::Profile;
use profile::state::UserProfile;
use profile::instructions::{CounterType, CounterOperation, UpdateActiveCountersParams};

#[derive(Accounts)]
pub struct CreateTrade<'info> {
    #[account(
        init,
        payer = buyer,
        space = Trade::LEN,
        seeds = [b"trade", counter.next_id.to_le_bytes().as_ref()],
        bump
    )]
    pub trade: Account<'info, Trade>,

    #[account(
        mut,
        seeds = [b"trade_counter"],
        bump = counter.bump
    )]
    pub counter: Account<'info, TradeCounter>,

    /// The offer being responded to
    #[account(
        constraint = offer.state == OfferState::Active @ TradeError::OfferNotActive
    )]
    pub offer: Account<'info, Offer>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// Buyer's profile (for limit checking and counter update)
    #[account(
        mut,
        seeds = [b"profile", buyer.key().as_ref()],
        bump = buyer_profile.bump,
        seeds::program = profile::ID
    )]
    pub buyer_profile: Account<'info, UserProfile>,

    /// Hub config (for trade limits and expiration timer)
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// Escrow vault PDA (will be derived and passed in)
    /// CHECK: Escrow vault derivation validated by address
    pub escrow_vault: UncheckedAccount<'info>,

    /// Profile program for CPI
    pub profile_program: Program<'info, Profile>,

    /// The Trade program account for CPI caller identification
    /// CHECK: address is verified to be this program's ID
    #[account(address = crate::ID)]
    pub trade_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateTradeParams {
    pub offer_id: u64,
    pub amount: u64,
    pub fiat_amount: u64,
    pub buyer_contact: String,
}

pub fn handler(ctx: Context<CreateTrade>, params: CreateTradeParams) -> Result<()> {
    let trade = &mut ctx.accounts.trade;
    let counter = &mut ctx.accounts.counter;
    let offer = &ctx.accounts.offer;
    let hub_config = &ctx.accounts.hub_config;
    let clock = Clock::get()?;

    // Check circuit breaker for new trades
    require!(
        !hub_config.global_pause && !hub_config.pause_new_trades,
        TradeError::NewTradesPaused
    );

    // Validate amount is within offer range
    require!(
        params.amount >= offer.min_amount && params.amount <= offer.max_amount,
        TradeError::AmountOutOfRange
    );

    // Validate fiat amount is within hub limits
    require!(
        params.fiat_amount >= hub_config.min_trade_amount &&
        params.fiat_amount <= hub_config.max_trade_amount,
        TradeError::AmountOutOfRange
    );

    // Prevent self-trading
    require!(
        ctx.accounts.buyer.key() != offer.owner,
        TradeError::SelfTradeNotAllowed
    );

    // Check buyer hasn't exceeded max_active_trades limit
    require!(
        ctx.accounts.buyer_profile.active_trades < hub_config.max_active_trades,
        TradeError::MaxActiveTradesReached
    );

    // Get next trade ID
    let trade_id = counter.increment()?;

    // Set PDA bump
    trade.bump = ctx.bumps.trade;

    // Set trade ID and offer reference
    trade.id = trade_id;
    trade.offer_id = params.offer_id;

    // Set parties
    trade.buyer = ctx.accounts.buyer.key();
    // Seller is set from offer owner
    trade.seller = offer.owner;

    // Set initial state
    trade.state = TradeState::RequestCreated;

    // Set amounts
    trade.amount = params.amount;
    trade.fiat_amount = params.fiat_amount;

    // Set contact info
    trade.buyer_contact = params.buyer_contact;
    trade.seller_contact = String::new(); // Will be set when accepted

    // Set fields from offer
    trade.token_mint = offer.token_mint;
    trade.fiat_currency = offer.fiat_currency;

    // Set escrow vault
    trade.escrow_vault = ctx.accounts.escrow_vault.key();

    // Dispute fields
    trade.arbitrator = None;
    trade.dispute_initiated_at = None;

    // Set expiration from hub config
    let expiration_seconds: i64 = hub_config.trade_expiration_timer as i64;
    trade.expires_at = clock.unix_timestamp
        .checked_add(expiration_seconds)
        .ok_or(TradeError::NumericalOverflow)?;

    // Set timestamps
    trade.created_at = clock.unix_timestamp;
    trade.updated_at = clock.unix_timestamp;

    // Call Profile program to increment buyer's active_trades counter via CPI
    let cpi_program = ctx.accounts.profile_program.to_account_info();
    let cpi_accounts = UpdateActiveCounters {
        profile: ctx.accounts.buyer_profile.to_account_info(),
        // Pass this program (Trade) as the caller for authorization verification
        caller_program: ctx.accounts.trade_program.to_account_info(),
        // Hub config for authorization verification
        hub_config: ctx.accounts.hub_config.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    update_active_counters(
        cpi_ctx,
        UpdateActiveCountersParams {
            counter_type: CounterType::ActiveTrades,
            operation: CounterOperation::Increment,
        },
    )?;

    // Validate trade parameters
    trade.validate()?;

    emit!(TradeCreated {
        trade_id: trade.id,
        offer_id: trade.offer_id,
        buyer: trade.buyer,
        amount: trade.amount,
        fiat_amount: trade.fiat_amount,
    });

    Ok(())
}

#[event]
pub struct TradeCreated {
    pub trade_id: u64,
    pub offer_id: u64,
    pub buyer: Pubkey,
    pub amount: u64,
    pub fiat_amount: u64,
}
