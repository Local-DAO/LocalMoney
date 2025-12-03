use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use hub::state::HubConfig;
use hub::program::Hub;
use profile::cpi::accounts::UpdateActiveCounters;
use profile::cpi::update_active_counters;
use profile::program::Profile;
use profile::state::UserProfile;
use profile::instructions::{CounterType, CounterOperation, UpdateActiveCountersParams};

#[derive(Accounts)]
pub struct CreateOffer<'info> {
    #[account(
        init,
        payer = owner,
        space = Offer::LEN,
        seeds = [b"offer", counter.next_id.to_le_bytes().as_ref()],
        bump
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        mut,
        seeds = [b"offer_counter"],
        bump = counter.bump
    )]
    pub counter: Account<'info, OfferCounter>,

    #[account(mut)]
    pub owner: Signer<'info>,

    /// Owner's profile (for limit checking and counter update)
    #[account(
        mut,
        seeds = [b"profile", owner.key().as_ref()],
        bump = owner_profile.bump,
        seeds::program = profile::ID
    )]
    pub owner_profile: Account<'info, UserProfile>,

    /// Hub config (for max_active_offers limit and circuit breaker)
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// CHECK: Token mint address, validated by token program
    pub token_mint: AccountInfo<'info>,

    /// Profile program for CPI
    pub profile_program: Program<'info, Profile>,

    /// The Offer program account for CPI caller identification
    /// CHECK: address is verified to be this program's ID
    #[account(address = crate::ID)]
    pub offer_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> CreateOffer<'info> {
    /// Helper to get this program's ID for CPI calls
    pub fn this_program(&self) -> Pubkey {
        crate::ID
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateOfferParams {
    pub offer_type: OfferType,
    pub fiat_currency: [u8; 3],
    pub min_amount: u64,
    pub max_amount: u64,
    pub rate: u64,
    pub description: String,
}

pub fn handler(ctx: Context<CreateOffer>, params: CreateOfferParams) -> Result<()> {
    let offer = &mut ctx.accounts.offer;
    let counter = &mut ctx.accounts.counter;
    let hub_config = &ctx.accounts.hub_config;
    let owner_profile = &ctx.accounts.owner_profile;
    let clock = Clock::get()?;

    // Check circuit breaker for new offers
    require!(
        !hub_config.global_pause && !hub_config.pause_new_offers,
        OfferError::NewOffersPaused
    );

    // Check user hasn't exceeded max_active_offers limit
    require!(
        owner_profile.active_offers < hub_config.max_active_offers,
        OfferError::MaxActiveOffersReached
    );

    // Get next offer ID
    let offer_id = counter.next()?;

    // Set PDA bump
    offer.bump = ctx.bumps.offer;

    // Set offer ID and owner
    offer.id = offer_id;
    offer.owner = ctx.accounts.owner.key();

    // Set offer details
    offer.offer_type = params.offer_type;
    offer.state = OfferState::Active;
    offer.fiat_currency = params.fiat_currency;
    offer.token_mint = ctx.accounts.token_mint.key();

    // Set amounts and rate
    offer.min_amount = params.min_amount;
    offer.max_amount = params.max_amount;
    offer.rate = params.rate;

    // Set description
    offer.description = params.description;

    // Set timestamps
    offer.created_at = clock.unix_timestamp;
    offer.updated_at = clock.unix_timestamp;

    // Validate offer parameters
    offer.validate()?;

    // Call Profile program to increment owner's active_offers counter via CPI
    let cpi_program = ctx.accounts.profile_program.to_account_info();
    let cpi_accounts = UpdateActiveCounters {
        profile: ctx.accounts.owner_profile.to_account_info(),
        // Pass this program (Offer) as the caller for authorization verification
        caller_program: ctx.accounts.offer_program.to_account_info(),
        // Hub config for authorization verification
        hub_config: ctx.accounts.hub_config.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    update_active_counters(
        cpi_ctx,
        UpdateActiveCountersParams {
            counter_type: CounterType::ActiveOffers,
            operation: CounterOperation::Increment,
        },
    )?;

    emit!(OfferCreated {
        offer_id: offer.id,
        owner: offer.owner,
        offer_type: offer.offer_type,
        fiat_currency: offer.fiat_currency,
        token_mint: offer.token_mint,
    });

    Ok(())
}

#[event]
pub struct OfferCreated {
    pub offer_id: u64,
    pub owner: Pubkey,
    pub offer_type: OfferType,
    pub fiat_currency: [u8; 3],
    pub token_mint: Pubkey,
}
