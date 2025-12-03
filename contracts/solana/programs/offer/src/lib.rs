use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::*;

declare_id!("CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo");

#[program]
pub mod offer {
    use super::*;

    /// Initialize the offer counter
    ///
    /// This must be called once before any offers can be created.
    /// It initializes the global offer counter PDA.
    pub fn initialize_counter(ctx: Context<InitializeCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.bump = ctx.bumps.counter;
        counter.next_id = 0;
        Ok(())
    }

    /// Create a new offer
    ///
    /// Creates a new buy or sell offer on the marketplace.
    ///
    /// # Arguments
    ///
    /// * `ctx` - CreateOffer context with offer PDA, counter, owner, token mint, and hub_config
    /// * `params` - Offer parameters
    ///
    /// # Access Control
    ///
    /// Anyone can create an offer, subject to max_active_offers limit from Hub config.
    /// Profile program is called via CPI to update offer counters (with Hub-based authorization).
    pub fn create_offer(ctx: Context<CreateOffer>, params: CreateOfferParams) -> Result<()> {
        instructions::create_offer::handler(ctx, params)
    }

    /// Update an existing offer
    ///
    /// Allows the offer owner to update price, amounts, or description.
    ///
    /// # Arguments
    ///
    /// * `ctx` - UpdateOffer context with offer PDA and owner
    /// * `params` - Updated parameters (all optional)
    ///
    /// # Access Control
    ///
    /// Only the offer owner can update their offer.
    pub fn update_offer(ctx: Context<UpdateOffer>, params: UpdateOfferParams) -> Result<()> {
        instructions::update_offer::handler(ctx, params)
    }

    /// Pause an offer
    ///
    /// Temporarily disables an offer without deleting it.
    ///
    /// # Arguments
    ///
    /// * `ctx` - PauseOffer context with offer PDA and owner
    ///
    /// # Access Control
    ///
    /// Only the offer owner can pause their offer.
    pub fn pause_offer(ctx: Context<PauseOffer>) -> Result<()> {
        instructions::pause_offer::handler(ctx)
    }

    /// Resume a paused offer
    ///
    /// Re-activates a previously paused offer.
    ///
    /// # Arguments
    ///
    /// * `ctx` - ResumeOffer context with offer PDA and owner
    ///
    /// # Access Control
    ///
    /// Only the offer owner can resume their offer.
    pub fn resume_offer(ctx: Context<ResumeOffer>) -> Result<()> {
        instructions::resume_offer::handler(ctx)
    }

    /// Delete an offer
    ///
    /// Permanently marks an offer as deleted. This is a terminal state.
    ///
    /// # Arguments
    ///
    /// * `ctx` - DeleteOffer context with offer PDA and owner
    ///
    /// # Access Control
    ///
    /// Only the offer owner can delete their offer.
    pub fn delete_offer(ctx: Context<DeleteOffer>) -> Result<()> {
        instructions::delete_offer::handler(ctx)
    }
}

#[derive(Accounts)]
pub struct InitializeCounter<'info> {
    #[account(
        init,
        payer = admin,
        space = OfferCounter::LEN,
        seeds = [b"offer_counter"],
        bump
    )]
    pub counter: Account<'info, OfferCounter>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}
