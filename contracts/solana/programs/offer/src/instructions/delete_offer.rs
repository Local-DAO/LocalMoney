use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use hub::state::HubConfig;
use profile::cpi::accounts::UpdateActiveCounters;
use profile::cpi::update_active_counters;
use profile::program::Profile;
use profile::state::UserProfile;
use profile::instructions::{CounterType, CounterOperation, UpdateActiveCountersParams};

#[derive(Accounts)]
pub struct DeleteOffer<'info> {
    #[account(
        mut,
        seeds = [b"offer", offer.id.to_le_bytes().as_ref()],
        bump = offer.bump,
        has_one = owner @ OfferError::Unauthorized
    )]
    pub offer: Account<'info, Offer>,

    pub owner: Signer<'info>,

    /// Owner's profile (for counter update)
    #[account(
        mut,
        seeds = [b"profile", owner.key().as_ref()],
        bump = owner_profile.bump,
        seeds::program = profile::ID
    )]
    pub owner_profile: Account<'info, UserProfile>,

    /// Hub config for CPI authorization
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// Profile program for CPI
    pub profile_program: Program<'info, Profile>,

    /// The Offer program account for CPI caller identification
    /// CHECK: address is verified to be this program's ID
    #[account(address = crate::ID)]
    pub offer_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<DeleteOffer>) -> Result<()> {
    let offer = &mut ctx.accounts.offer;
    let clock = Clock::get()?;

    // Transition to Deleted state
    offer.transition_to(OfferState::Deleted)?;

    // Update timestamp
    offer.updated_at = clock.unix_timestamp;

    // Call Profile program to decrement owner's active_offers counter via CPI
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
            operation: CounterOperation::Decrement,
        },
    )?;

    emit!(OfferDeleted {
        offer_id: offer.id,
        owner: offer.owner,
    });

    Ok(())
}

#[event]
pub struct OfferDeleted {
    pub offer_id: u64,
    pub owner: Pubkey,
}
