use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;

use localmoney_shared::{constants::*, errors::*, hub::Hub, offer::*};

declare_id!("8V7KPa396tMUbU1HpuGGWAWMddfsuQ5K5vLMnxdAurFv");

#[program]
pub mod offer {
    use super::*;

    // Initialize the offer program
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let offer_counter = &mut ctx.accounts.offer_counter;

        // Setup the offer counter for the user
        offer_counter.owner = ctx.accounts.owner.key();
        offer_counter.count = 0;
        offer_counter.bump = ctx.bumps.offer_counter;

        Ok(())
    }

    // Create a new offer
    pub fn create_offer(
        ctx: Context<CreateOffer>,
        direction: OfferDirection,
        fiat_currency: String,
        payment_methods: Vec<PaymentMethod>,
        min_amount: u64,
        max_amount: u64,
        price_premium: i8,
        description: String,
    ) -> Result<()> {
        let offer_counter = &mut ctx.accounts.offer_counter;
        let profile = &ctx.accounts.profile;

        // Check if active offers limit is reached
        if profile.active_offers_count >= ctx.accounts.hub.config.active_offers_limit.into() {
            return Err(LocalMoneyError::ActiveOffersLimitReached.into());
        }

        // Increment the user's offer counter
        offer_counter.count += 1;

        // Initialize the offer
        let offer = &mut ctx.accounts.offer;
        offer.id = offer_counter.count;
        offer.owner = ctx.accounts.owner.key();
        offer.hub = ctx.accounts.hub.key();
        offer.direction = direction;
        offer.token_mint = ctx.accounts.token_mint.key();
        offer.fiat_currency = fiat_currency;
        offer.payment_methods = payment_methods;
        offer.min_amount = min_amount;
        offer.max_amount = max_amount;
        offer.price_premium = price_premium;
        offer.description = description;
        offer.state = OfferState::Active;

        // Set timestamps and bump
        let clock = Clock::get()?;
        offer.created_at = clock.unix_timestamp;
        offer.updated_at = clock.unix_timestamp;
        offer.is_deleted = false;
        offer.bump = ctx.bumps.offer;

        // Call profile program to update active offers count
        // (This would be a CPI call in a real implementation)

        Ok(())
    }

    // Update an existing offer
    pub fn update_offer(
        ctx: Context<UpdateOffer>,
        payment_methods: Vec<PaymentMethod>,
        min_amount: u64,
        max_amount: u64,
        price_premium: i8,
        description: String,
    ) -> Result<()> {
        // Can only update if offer is active or paused
        require!(
            ctx.accounts.offer.state == OfferState::Active
                || ctx.accounts.offer.state == OfferState::Paused,
            LocalMoneyError::InvalidOfferStateChange
        );

        let offer = &mut ctx.accounts.offer;

        // Update offer fields
        offer.payment_methods = payment_methods;
        offer.min_amount = min_amount;
        offer.max_amount = max_amount;
        offer.price_premium = price_premium;
        offer.description = description;

        // Update timestamp
        let clock = Clock::get()?;
        offer.updated_at = clock.unix_timestamp;

        Ok(())
    }

    // Update the state of an offer (pause, close, etc.)
    pub fn update_offer_state(ctx: Context<UpdateOfferState>, new_state: OfferState) -> Result<()> {
        let offer = &mut ctx.accounts.offer;
        let old_state = offer.state;

        // Cannot change state if offer is already closed
        require!(
            old_state != OfferState::Closed && old_state != OfferState::Archive,
            LocalMoneyError::InvalidOfferStateChange
        );

        // Set the new state
        offer.state = new_state;

        // Update timestamp
        let clock = Clock::get()?;
        offer.updated_at = clock.unix_timestamp;

        // Call profile program to update active offers count
        // (This would be a CPI call in a real implementation)

        Ok(())
    }

    // Instruction for querying offers with filtering and pagination
    pub fn query_offers(
        ctx: Context<QueryOffers>,
        direction: Option<OfferDirection>,
        fiat_currency: Option<String>,
        state: Option<OfferState>,
        page: u16,
        page_size: u8,
    ) -> Result<()> {
        let _offers_list = &ctx.accounts.offers_list;

        // This instruction would typically be used by off-chain clients
        // In Solana, we can't return data directly, so this might log or store results
        // For simplicity, we'll log a message indicating the query parameters
        // Real implementation would depend on off-chain indexing or client-side processing

        msg!("Querying offers with direction: {:?}, fiat: {:?}, state: {:?}, page: {}, page_size: {}",
            direction, fiat_currency, state, page, page_size);

        // Placeholder for actual filtering logic which would be handled off-chain
        // or through a different mechanism in a real implementation
        Ok(())
    }
}

// Context for initializing the offer program
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"hub"],
        seeds::program = hub_program.key(),
        bump,
    )]
    pub hub: Account<'info, Hub>,

    #[account(
        init,
        payer = owner,
        space = 8 + std::mem::size_of::<OfferCounter>(),
        seeds = [b"offer_counter", owner.key().as_ref()],
        bump
    )]
    pub offer_counter: Account<'info, OfferCounter>,

    /// CHECK: Account used to derive the program address for constraint checks
    pub hub_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

// Context for creating a new offer
#[derive(Accounts)]
#[instruction(
    direction: OfferDirection,
    fiat_currency: String,
    payment_methods: Vec<PaymentMethod>,
    min_amount: u64,
    max_amount: u64,
    price_premium: i8,
    description: String,
)]
pub struct CreateOffer<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"hub"],
        seeds::program = hub_program.key(),
        bump,
    )]
    pub hub: Account<'info, Hub>,

    pub token_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(
        mut,
        seeds = [b"offer_counter", owner.key().as_ref()],
        bump = offer_counter.bump,
    )]
    pub offer_counter: Account<'info, OfferCounter>,

    #[account(
        init,
        payer = owner,
        space = 8 + std::mem::size_of::<Offer>() + 
                description.len() + 4 + // String size + length prefix
                fiat_currency.len() + 4 + // String size + length prefix
                payment_methods.iter().map(|pm| pm.name.len() + pm.description.len() + 8).sum::<usize>() + 
                4 + (payment_methods.len() * std::mem::size_of::<PaymentMethod>()),
        seeds = [
            b"offer", 
            owner.key().as_ref(), 
            &offer_counter.count.to_le_bytes()
        ],
        bump
    )]
    pub offer: Account<'info, Offer>,

    /// Profile account to check active offers count
    #[account(
        seeds = [PROFILE_SEED, owner.key().as_ref()],
        bump,
    )]
    pub profile: Account<'info, localmoney_shared::profile::Profile>,

    /// CHECK: Account used to derive the program address for constraint checks
    pub hub_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

// Context for updating an offer
#[derive(Accounts)]
#[instruction(
    offer_id: u64,
    payment_methods: Vec<PaymentMethod>,
    min_amount: u64,
    max_amount: u64,
    price_premium: i8,
    description: String,
)]
pub struct UpdateOffer<'info> {
    #[account(
        constraint = offer.owner == owner.key() @ LocalMoneyError::Unauthorized
    )]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"offer", 
            owner.key().as_ref(), 
            &offer_id.to_le_bytes()
        ],
        bump = offer.bump,
    )]
    pub offer: Account<'info, Offer>,
}

// Context for updating an offer's state
#[derive(Accounts)]
#[instruction(offer_id: u64)]
pub struct UpdateOfferState<'info> {
    #[account(
        constraint = offer.owner == owner.key() @ LocalMoneyError::Unauthorized
    )]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"offer", 
            owner.key().as_ref(), 
            &offer_id.to_le_bytes()
        ],
        bump = offer.bump,
    )]
    pub offer: Account<'info, Offer>,
}

// Context for querying offers
#[derive(Accounts)]
#[instruction(
    direction: Option<OfferDirection>,
    fiat_currency: Option<String>,
    state: Option<OfferState>,
    page: u16,
    page_size: u8,
)]
pub struct QueryOffers<'info> {
    #[account(
        seeds = [b"offers_list"],
        bump = offers_list.bump,
    )]
    pub offers_list: Account<'info, OffersList>,
    pub system_program: Program<'info, System>,
}

// Account to store a list of active offers for querying
#[account]
pub struct OffersList {
    pub offers: Vec<Pubkey>, // List of offer account addresses
    pub bump: u8,
}
