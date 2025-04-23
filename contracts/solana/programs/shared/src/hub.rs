use anchor_lang::prelude::*;

#[account]
pub struct HubConfig {
    pub offer_program: Pubkey,
    pub trade_program: Pubkey,
    pub profile_program: Pubkey,
    pub price_program: Pubkey,
    pub price_provider: Pubkey,
    pub local_market: Pubkey,
    pub local_token_mint: Pubkey,
    pub chain_fee_collector: Pubkey,
    pub warchest: Pubkey,
    pub active_offers_limit: u8,
    pub active_trades_limit: u8,
    pub arbitration_fee_pct: u8,
    pub burn_fee_pct: u8,
    pub chain_fee_pct: u8,
    pub warchest_fee_pct: u8,
    pub trade_expiration_timer: u64, // in seconds
    pub trade_dispute_timer: u64,
    pub trade_limit_min: u64, // in USD
    pub trade_limit_max: u64, // in USD
    pub is_initialized: bool,
}

// Hub Account - Stores the hub configuration
#[account]
pub struct Hub {
    pub admin: Pubkey,
    pub config: HubConfig,
    pub bump: u8,
}

// Derive a PDA for the Hub account
pub fn derive_hub_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"hub"], program_id)
}

// Authority PDA that allows cross program invocation
pub fn derive_authority_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"authority"], program_id)
}
