use crate::offer::OfferState;
use crate::trade::TradeState;
use anchor_lang::prelude::*;

#[account]
pub struct ProfileConfig {
    pub hub_authority: Pubkey,
    pub bump: u8,
}

#[account]
pub struct Profile {
    pub owner: Pubkey,
    pub contact: Option<String>,
    pub encryption_key: Option<String>,
    pub created_at: i64,
    pub last_trade: i64,
    pub requested_trades_count: u32,
    pub released_trades_count: u32,
    pub active_trades_count: u32,
    pub active_offers_count: u32,
    pub bump: u8,
}

impl Profile {
    pub fn new(owner: Pubkey) -> Self {
        Self {
            owner,
            contact: None,
            encryption_key: None,
            created_at: 0,
            last_trade: 0,
            requested_trades_count: 0,
            released_trades_count: 0,
            active_trades_count: 0,
            active_offers_count: 0,
            bump: 0,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateContactParams {
    pub contact: String,
    pub encryption_key: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateTradesCountParams {
    pub trade_state: TradeState,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateActiveOffersParams {
    pub offer_state: OfferState,
}
