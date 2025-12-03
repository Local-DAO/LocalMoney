use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct HubConfig {
    /// PDA bump seed
    pub bump: u8,

    /// Admin authority
    pub admin: Pubkey,

    /// Program addresses
    pub offer_program: Pubkey,
    pub trade_program: Pubkey,
    pub profile_program: Pubkey,
    pub escrow_program: Pubkey,
    pub arbitrator_program: Pubkey,
    pub price_oracle_program: Pubkey,

    /// Fee configuration (basis points, 10000 = 100%)
    pub burn_fee_pct: u16,        // Max 500 (5%)
    pub chain_fee_pct: u16,       // Max 300 (3%)
    pub warchest_fee_pct: u16,    // Max 300 (3%)
    pub conversion_fee_pct: u16,  // Max 500 (5%)
    pub arbitrator_fee_pct: u16,  // Max 200 (2%)

    /// Trading limits (USD cents)
    pub min_trade_amount: u64,
    pub max_trade_amount: u64,
    pub max_active_offers: u8,
    pub max_active_trades: u8,

    /// Timers (seconds)
    pub trade_expiration_timer: u64,
    pub trade_dispute_timer: u64,

    /// Circuit breakers
    pub global_pause: bool,
    pub pause_new_offers: bool,
    pub pause_new_trades: bool,
    pub pause_escrow_funding: bool,
    pub pause_escrow_release: bool,

    /// Treasury addresses
    pub treasury: Pubkey,
    pub warchest: Pubkey,
}

impl HubConfig {
    /// Account space calculation
    /// 8 (discriminator) + 1 (bump) + 32 (admin) + 6*32 (programs) +
    /// 5*2 (fees) + 2*8 + 2*1 (trading limits) + 2*8 (timers) +
    /// 5*1 (circuit breakers) + 2*32 (treasuries)
    pub const LEN: usize = 8 + 1 + 32 + (6 * 32) + (5 * 2) + 16 + 2 + 16 + 5 + 64;

    /// Maximum total fee percentage (10% = 1000 basis points)
    pub const MAX_TOTAL_FEE_PCT: u16 = 1000;

    /// Individual fee limits (basis points)
    pub const MAX_BURN_FEE_PCT: u16 = 500;    // 5%
    pub const MAX_CHAIN_FEE_PCT: u16 = 300;   // 3%
    pub const MAX_WARCHEST_FEE_PCT: u16 = 300; // 3%
    pub const MAX_CONVERSION_FEE_PCT: u16 = 500; // 5%
    pub const MAX_ARBITRATOR_FEE_PCT: u16 = 200; // 2%

    /// Validate fee configuration
    pub fn validate_fees(&self) -> Result<()> {
        // Check individual limits
        require!(
            self.burn_fee_pct <= Self::MAX_BURN_FEE_PCT,
            crate::errors::HubError::FeeExceedsLimit
        );
        require!(
            self.chain_fee_pct <= Self::MAX_CHAIN_FEE_PCT,
            crate::errors::HubError::FeeExceedsLimit
        );
        require!(
            self.warchest_fee_pct <= Self::MAX_WARCHEST_FEE_PCT,
            crate::errors::HubError::FeeExceedsLimit
        );
        require!(
            self.conversion_fee_pct <= Self::MAX_CONVERSION_FEE_PCT,
            crate::errors::HubError::FeeExceedsLimit
        );
        require!(
            self.arbitrator_fee_pct <= Self::MAX_ARBITRATOR_FEE_PCT,
            crate::errors::HubError::FeeExceedsLimit
        );

        // Check total fees don't exceed maximum
        let total_fees = self.burn_fee_pct as u32
            + self.chain_fee_pct as u32
            + self.warchest_fee_pct as u32
            + self.conversion_fee_pct as u32;

        require!(
            total_fees <= Self::MAX_TOTAL_FEE_PCT as u32,
            crate::errors::HubError::InvalidFeeConfiguration
        );

        Ok(())
    }

    /// Validate trading limits
    pub fn validate_trading_limits(&self) -> Result<()> {
        require!(
            self.min_trade_amount < self.max_trade_amount,
            crate::errors::HubError::InvalidTradingLimit
        );
        Ok(())
    }

    /// Validate timers
    pub fn validate_timers(&self) -> Result<()> {
        require!(
            self.trade_expiration_timer > 0,
            crate::errors::HubError::InvalidTimerValue
        );
        require!(
            self.trade_dispute_timer > 0,
            crate::errors::HubError::InvalidTimerValue
        );
        Ok(())
    }

    /// Check if globally paused
    pub fn check_not_paused(&self) -> Result<()> {
        require!(!self.global_pause, crate::errors::HubError::GloballyPaused);
        Ok(())
    }

    /// Check specific operation not paused
    pub fn check_operation_not_paused(&self, operation: CircuitBreakerOperation) -> Result<()> {
        self.check_not_paused()?;

        let is_paused = match operation {
            CircuitBreakerOperation::NewOffers => self.pause_new_offers,
            CircuitBreakerOperation::NewTrades => self.pause_new_trades,
            CircuitBreakerOperation::EscrowFunding => self.pause_escrow_funding,
            CircuitBreakerOperation::EscrowRelease => self.pause_escrow_release,
        };

        require!(!is_paused, crate::errors::HubError::OperationPaused);
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CircuitBreakerOperation {
    NewOffers,
    NewTrades,
    EscrowFunding,
    EscrowRelease,
}
