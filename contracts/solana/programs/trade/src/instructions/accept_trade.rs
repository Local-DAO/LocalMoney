use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct AcceptTrade<'info> {
    #[account(
        mut,
        seeds = [b"trade", trade.id.to_le_bytes().as_ref()],
        bump = trade.bump,
    )]
    pub trade: Account<'info, Trade>,

    /// The seller accepting the trade (must be offer owner)
    #[account(mut)]
    pub seller: Signer<'info>,

    /// The offer being traded
    /// CHECK: Offer account will be validated in handler
    pub offer: UncheckedAccount<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AcceptTradeParams {
    pub seller_contact: String,
}

pub fn handler(ctx: Context<AcceptTrade>, params: AcceptTradeParams) -> Result<()> {
    let trade = &mut ctx.accounts.trade;
    let clock = Clock::get()?;

    // Check trade is in RequestCreated state
    require!(
        trade.state == TradeState::RequestCreated,
        TradeError::InvalidState
    );

    // Check trade hasn't expired
    require!(
        !trade.is_expired(clock.unix_timestamp),
        TradeError::TradeExpired
    );

    // TODO: Deserialize offer and verify seller is offer.owner
    // require!(
    //     ctx.accounts.seller.key() == offer.owner,
    //     TradeError::OnlyOfferOwner
    // );

    // Set seller
    trade.seller = ctx.accounts.seller.key();

    // Set seller contact
    trade.seller_contact = params.seller_contact;

    // Validate contact length
    require!(
        trade.seller_contact.len() <= Trade::MAX_CONTACT_LEN,
        TradeError::ContactInfoTooLong
    );

    // Transition state
    trade.transition_to(TradeState::RequestAccepted)?;

    // Update timestamp
    trade.updated_at = clock.unix_timestamp;

    emit!(TradeAccepted {
        trade_id: trade.id,
        seller: trade.seller,
    });

    Ok(())
}

#[event]
pub struct TradeAccepted {
    pub trade_id: u64,
    pub seller: Pubkey,
}
