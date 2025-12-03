use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct UserProfile {
    /// PDA bump seed
    pub bump: u8,

    /// Profile owner
    pub owner: Pubkey,

    /// Encrypted contact information (max 280 chars)
    pub contact_info: String,

    /// Encryption key for contact info (max 280 chars)
    pub encryption_key: String,

    /// Trading statistics
    pub total_trades: u64,
    pub completed_trades: u64,
    pub disputed_trades: u64,
    pub total_buy_volume: u64,  // USD cents
    pub total_sell_volume: u64, // USD cents

    /// Active counters (for limit enforcement)
    pub active_offers: u8,
    pub active_trades: u8,

    /// Reputation score (0-10000 basis points, 10000 = 100%)
    pub reputation_score: u16,

    /// Timestamps
    pub created_at: i64,
    pub updated_at: i64,
}

impl UserProfile {
    /// Account space calculation
    /// 8 (discriminator) + 1 (bump) + 32 (owner) +
    /// (4 + 280) (contact_info) + (4 + 280) (encryption_key) +
    /// 5*8 (stats) + 2*1 (counters) + 2 (reputation) + 2*8 (timestamps)
    pub const LEN: usize = 8 + 1 + 32 + (4 + 280) + (4 + 280) + 40 + 2 + 2 + 16;

    /// Maximum contact info length
    pub const MAX_CONTACT_INFO_LEN: usize = 280;

    /// Maximum encryption key length
    pub const MAX_ENCRYPTION_KEY_LEN: usize = 280;

    /// Calculate reputation score
    ///
    /// Formula: (completed_trades - disputed_trades) / total_trades * 10000
    /// If total_trades is 0, return 0
    pub fn calculate_reputation(&self) -> u16 {
        if self.total_trades == 0 {
            return 0;
        }

        let successful_trades = self.completed_trades.saturating_sub(self.disputed_trades);
        let reputation = (successful_trades as f64 / self.total_trades as f64 * 10000.0) as u16;

        reputation.min(10000) // Cap at 100%
    }

    /// Update reputation score
    pub fn update_reputation(&mut self) {
        self.reputation_score = self.calculate_reputation();
    }

    /// Increment trade statistics
    pub fn increment_trade_stats(
        &mut self,
        is_buy: bool,
        fiat_amount: u64,
        completed: bool,
        disputed: bool,
    ) {
        self.total_trades = self.total_trades.saturating_add(1);

        if completed {
            self.completed_trades = self.completed_trades.saturating_add(1);
        }

        if disputed {
            self.disputed_trades = self.disputed_trades.saturating_add(1);
        }

        if is_buy {
            self.total_buy_volume = self.total_buy_volume.saturating_add(fiat_amount);
        } else {
            self.total_sell_volume = self.total_sell_volume.saturating_add(fiat_amount);
        }

        self.update_reputation();
    }

    /// Increment active offers counter
    pub fn increment_active_offers(&mut self) -> Result<()> {
        self.active_offers = self
            .active_offers
            .checked_add(1)
            .ok_or(error!(crate::errors::ProfileError::ActiveOffersOverflow))?;
        Ok(())
    }

    /// Decrement active offers counter
    pub fn decrement_active_offers(&mut self) -> Result<()> {
        self.active_offers = self
            .active_offers
            .checked_sub(1)
            .ok_or(error!(crate::errors::ProfileError::InvalidCounterOperation))?;
        Ok(())
    }

    /// Increment active trades counter
    pub fn increment_active_trades(&mut self) -> Result<()> {
        self.active_trades = self
            .active_trades
            .checked_add(1)
            .ok_or(error!(crate::errors::ProfileError::ActiveTradesOverflow))?;
        Ok(())
    }

    /// Decrement active trades counter
    pub fn decrement_active_trades(&mut self) -> Result<()> {
        self.active_trades = self
            .active_trades
            .checked_sub(1)
            .ok_or(error!(crate::errors::ProfileError::InvalidCounterOperation))?;
        Ok(())
    }
}
