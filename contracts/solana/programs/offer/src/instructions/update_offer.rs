use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct UpdateOffer<'info> {
    #[account(
        mut,
        seeds = [b"offer", offer.id.to_le_bytes().as_ref()],
        bump = offer.bump,
        has_one = owner @ OfferError::Unauthorized
    )]
    pub offer: Account<'info, Offer>,

    pub owner: Signer<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateOfferParams {
    pub min_amount: Option<u64>,
    pub max_amount: Option<u64>,
    pub rate: Option<u64>,
    pub description: Option<String>,
}

pub fn handler(ctx: Context<UpdateOffer>, params: UpdateOfferParams) -> Result<()> {
    let offer = &mut ctx.accounts.offer;
    let clock = Clock::get()?;

    // Check offer is not deleted
    require!(!offer.is_deleted(), OfferError::OfferDeleted);

    // Update parameters if provided
    if let Some(min_amount) = params.min_amount {
        offer.min_amount = min_amount;
    }
    if let Some(max_amount) = params.max_amount {
        offer.max_amount = max_amount;
    }
    if let Some(rate) = params.rate {
        offer.rate = rate;
    }
    if let Some(description) = params.description {
        offer.description = description;
    }

    // Update timestamp
    offer.updated_at = clock.unix_timestamp;

    // Validate updated parameters
    offer.validate()?;

    emit!(OfferUpdated {
        offer_id: offer.id,
        owner: offer.owner,
    });

    Ok(())
}

#[event]
pub struct OfferUpdated {
    pub offer_id: u64,
    pub owner: Pubkey,
}
