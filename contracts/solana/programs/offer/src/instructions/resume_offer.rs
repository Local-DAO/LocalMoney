use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct ResumeOffer<'info> {
    #[account(
        mut,
        seeds = [b"offer", offer.id.to_le_bytes().as_ref()],
        bump = offer.bump,
        has_one = owner @ OfferError::Unauthorized
    )]
    pub offer: Account<'info, Offer>,

    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<ResumeOffer>) -> Result<()> {
    let offer = &mut ctx.accounts.offer;
    let clock = Clock::get()?;

    // Transition to Active state
    offer.transition_to(OfferState::Active)?;

    // Update timestamp
    offer.updated_at = clock.unix_timestamp;

    emit!(OfferResumed {
        offer_id: offer.id,
        owner: offer.owner,
    });

    Ok(())
}

#[event]
pub struct OfferResumed {
    pub offer_id: u64,
    pub owner: Pubkey,
}
