use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct PauseOffer<'info> {
    #[account(
        mut,
        seeds = [b"offer", offer.id.to_le_bytes().as_ref()],
        bump = offer.bump,
        has_one = owner @ OfferError::Unauthorized
    )]
    pub offer: Account<'info, Offer>,

    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<PauseOffer>) -> Result<()> {
    let offer = &mut ctx.accounts.offer;
    let clock = Clock::get()?;

    // Transition to Paused state
    offer.transition_to(OfferState::Paused)?;

    // Update timestamp
    offer.updated_at = clock.unix_timestamp;

    emit!(OfferPaused {
        offer_id: offer.id,
        owner: offer.owner,
    });

    Ok(())
}

#[event]
pub struct OfferPaused {
    pub offer_id: u64,
    pub owner: Pubkey,
}
