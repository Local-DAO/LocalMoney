use anchor_lang::prelude::*;

/// Individual price provider account
///
/// Each authorized provider has their own account tracking
/// their statistics and authorization status.
#[account]
#[derive(Debug)]
pub struct PriceProvider {
    /// PDA bump seed
    pub bump: u8,

    /// Provider's public key
    pub pubkey: Pubkey,

    /// Whether provider is active
    pub is_active: bool,

    /// Total number of price updates submitted
    pub total_updates: u64,

    /// Timestamp when provider was registered
    pub registered_at: i64,

    /// Last update timestamp
    pub last_update_at: i64,
}

impl PriceProvider {
    /// Account space calculation
    /// 8 (discriminator) + 1 (bump) + 32 (pubkey) + 1 (is_active) +
    /// 8 (total_updates) + 8 (registered_at) + 8 (last_update_at)
    pub const LEN: usize = 8 + 1 + 32 + 1 + 8 + 8 + 8;

    /// Increment update counter
    pub fn increment_updates(&mut self, timestamp: i64) {
        self.total_updates = self.total_updates.saturating_add(1);
        self.last_update_at = timestamp;
    }
}
