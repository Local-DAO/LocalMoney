use anchor_lang::prelude::*;

// Offer states
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum OfferState {
    Active,
    Paused,
    Closed,
    Archive,
}

// Offer direction (buy/sell)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum OfferDirection {
    Buy,
    Sell,
}

// Offer fiat payment method
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct PaymentMethod {
    pub name: String,
    pub description: String,
}

// Offer account - Stores information about an offer
#[account]
pub struct Offer {
    pub id: u64,                             // Offer ID (used for uniqueness)
    pub owner: Pubkey,                       // Owner of the offer
    pub hub: Pubkey,                         // Reference to hub account
    pub direction: OfferDirection,           // Buy or Sell
    pub token_mint: Pubkey,                  // Token being offered
    pub fiat_currency: String,               // Fiat currency code (e.g. "USD")
    pub payment_methods: Vec<PaymentMethod>, // Accepted payment methods
    pub min_amount: u64,                     // Minimum fiat amount
    pub max_amount: u64,                     // Maximum fiat amount
    pub price_premium: i8,                   // Price premium percentage (+/-)
    pub description: String,                 // Offer description
    pub state: OfferState,                   // Current state of the offer
    pub created_at: i64,                     // Creation timestamp
    pub updated_at: i64,                     // Last update timestamp
    pub is_deleted: bool,                    // Flag for soft deletion
    pub bump: u8,                            // PDA bump
}

// Derive a PDA for a specific offer
pub fn derive_offer_address(program_id: &Pubkey, owner: &Pubkey, offer_id: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"offer", owner.as_ref(), &offer_id.to_le_bytes()],
        program_id,
    )
}

// Derive a PDA for offer counter
pub fn derive_offer_counter_address(program_id: &Pubkey, owner: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"offer_counter", owner.as_ref()], program_id)
}

// Offer counter account - Tracks the number of offers for a user
#[account]
pub struct OfferCounter {
    pub owner: Pubkey, // Owner of the counter
    pub count: u64,    // Number of offers created by this owner
    pub bump: u8,      // PDA bump
}
