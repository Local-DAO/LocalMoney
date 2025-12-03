use anchor_lang::prelude::*;

/// Global counter for sequential trade IDs
#[account]
#[derive(Debug)]
pub struct TradeCounter {
    /// PDA bump seed
    pub bump: u8,

    /// Next available trade ID
    pub next_id: u64,
}

impl TradeCounter {
    /// Account space calculation
    /// 8 (discriminator) + 1 (bump) + 8 (next_id)
    pub const LEN: usize = 8 + 1 + 8;

    /// Get next trade ID and increment counter
    pub fn increment(&mut self) -> Result<u64> {
        let current_id = self.next_id;

        // Check for overflow
        self.next_id = self
            .next_id
            .checked_add(1)
            .ok_or(crate::errors::TradeError::CounterOverflow)?;

        Ok(current_id)
    }
}
