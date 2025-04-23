use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;

// Corrected imports
use crate::price::FiatCurrency;

// NOTE: Definition for 'Denom' is currently missing and needs to be added.
//       It might be intended to be 'Pubkey'.

/// Trade states enum representing the lifecycle of a trade
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum TradeState {
    RequestCreated,
    RequestCanceled,
    RequestExpired,
    RequestAccepted,
    EscrowFunded,
    EscrowCanceled,
    EscrowRefunded,
    FiatDeposited,
    EscrowReleased,
    EscrowDisputed,
    SettledForMaker,
    SettledForTaker,
}

impl std::fmt::Display for TradeState {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

/// Information about fees collected during trade
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct FeeInfo {
    pub burn_amount: u64,
    pub chain_amount: u64,
    pub warchest_amount: u64,
}

impl FeeInfo {
    pub fn total_fees(&self) -> u64 {
        self.burn_amount + self.chain_amount + self.warchest_amount
    }
}

/// Trade state history item for tracking transitions
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TradeStateItem {
    pub actor: Pubkey,
    pub state: TradeState,
    pub timestamp: i64,
}

/// Represents a new trade request
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct NewTrade {
    pub offer_id: u64,
    pub amount: u64,
    pub taker: Pubkey,
    pub profile_taker_contact: String,
    pub profile_taker_encryption_key: String,
    pub taker_contact: String,
}

/// Role of a trader in a trade
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub enum TraderRole {
    Trader,
    Arbitrator,
}

/// Conversion route for token swaps
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ConversionRoute {
    pub pool: Pubkey,
    pub ask_asset: Pubkey,
    pub offer_asset: Pubkey,
}

/// Step in a multi-hop conversion
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ConversionStep {
    pub trade_denom: Pubkey,
    pub step_previous_balance: u64,
    pub step: u8,
}

/// Main trade structure for detailed trade information
/// This will be stored in a PDA account
#[account]
pub struct Trade {
    pub id: u64,
    pub buyer: Pubkey,
    pub buyer_contact: Option<String>,
    pub seller: Pubkey,
    pub seller_contact: Option<String>,
    pub arbitrator: Pubkey,
    pub arbitrator_buyer_contact: Option<String>,
    pub arbitrator_seller_contact: Option<String>,
    pub offer_program: Pubkey,
    pub offer_id: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub enables_dispute_at: Option<i64>,
    pub denom: Pubkey,
    pub amount: u64,
    pub fiat: FiatCurrency,
    pub denom_fiat_price: u128, // Using u128 for Uint256 equivalent
    pub state_history: Vec<TradeStateItem>,
    pub state: TradeState,
    pub bump: u8,
}

impl Trade {
    pub fn new(
        id: u64,
        buyer: Pubkey,
        seller: Pubkey,
        seller_contact: Option<String>,
        buyer_contact: Option<String>,
        arbitrator: Pubkey,
        offer_program: Pubkey,
        offer_id: u64,
        created_at: i64,
        expires_at: i64,
        denom: Pubkey,
        amount: u64,
        fiat: FiatCurrency,
        denom_fiat_price: u128,
        state_history: Vec<TradeStateItem>,
        bump: u8,
    ) -> Self {
        Self {
            id,
            buyer,
            seller,
            seller_contact,
            buyer_contact,
            arbitrator,
            arbitrator_buyer_contact: None,
            arbitrator_seller_contact: None,
            offer_program,
            offer_id,
            created_at,
            expires_at,
            enables_dispute_at: None,
            denom,
            amount,
            fiat,
            denom_fiat_price,
            state_history,
            state: TradeState::RequestCreated,
            bump,
        }
    }

    pub fn is_expired(&self, current_time: i64) -> bool {
        current_time > self.expires_at
    }

    pub fn set_state(&mut self, new_state: TradeState, actor: Pubkey, timestamp: i64) {
        let state_item = TradeStateItem {
            actor,
            state: new_state.clone(),
            timestamp,
        };
        self.state_history.push(state_item);
        self.state = new_state;
    }
}

/// Response structure with full trade details including profile information
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TradeResponse {
    pub id: u64,
    pub buyer: Pubkey,
    pub buyer_contact: Option<String>,
    pub buyer_encryption_key: Option<String>,
    pub seller: Pubkey,
    pub seller_contact: Option<String>,
    pub seller_encryption_key: Option<String>,
    pub arbitrator: Option<Pubkey>,
    pub arbitrator_encryption_key: Option<String>,
    pub arbitrator_seller_contact: Option<String>,
    pub arbitrator_buyer_contact: Option<String>,
    pub offer_program: Pubkey,
    pub offer_id: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub enables_dispute_at: Option<i64>,
    pub denom: Pubkey,
    pub amount: u64,
    pub fiat: FiatCurrency,
    pub denom_fiat_price: u128,
    pub state_history: Vec<TradeStateItem>,
    pub state: TradeState,
}

/// Utility function to calculate denom fiat price
pub fn calc_denom_fiat_price(offer_rate: u64, denom_fiat_price: u128) -> u128 {
    offer_rate as u128 * denom_fiat_price / 100
}
