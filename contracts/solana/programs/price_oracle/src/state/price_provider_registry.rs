use anchor_lang::prelude::*;

/// Global registry for managing price providers
///
/// This account stores the admin authority and configuration
/// for the price oracle system.
#[account]
#[derive(Debug)]
pub struct PriceProviderRegistry {
    /// PDA bump seed
    pub bump: u8,

    /// Admin authority (typically Hub admin)
    pub admin: Pubkey,

    /// Total number of registered providers
    pub total_providers: u64,

    /// Maximum price staleness in seconds (default: 1 hour = 3600 seconds)
    pub max_price_staleness: u64,

    /// Timestamp when registry was initialized
    pub initialized_at: i64,
}

impl PriceProviderRegistry {
    /// Account space calculation
    /// 8 (discriminator) + 1 (bump) + 32 (admin) + 8 (total_providers) +
    /// 8 (max_price_staleness) + 8 (initialized_at)
    pub const LEN: usize = 8 + 1 + 32 + 8 + 8 + 8;

    /// Default staleness threshold (1 hour)
    pub const DEFAULT_MAX_STALENESS: u64 = 3600;

    /// Maximum allowed staleness (24 hours)
    pub const MAX_STALENESS_LIMIT: u64 = 86400;

    /// Increment provider counter
    pub fn increment_providers(&mut self) {
        self.total_providers = self.total_providers.saturating_add(1);
    }

    /// Decrement provider counter
    pub fn decrement_providers(&mut self) {
        self.total_providers = self.total_providers.saturating_sub(1);
    }
}
