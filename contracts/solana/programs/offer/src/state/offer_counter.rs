use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct OfferCounter {
    /// PDA bump seed
    pub bump: u8,

    /// Next offer ID to assign
    pub next_id: u64,
}

impl OfferCounter {
    /// Account space calculation
    pub const LEN: usize = 8 + 1 + 8;

    /// Get next ID and increment counter
    pub fn next(&mut self) -> Result<u64> {
        let id = self.next_id;
        self.next_id = self
            .next_id
            .checked_add(1)
            .ok_or(error!(crate::errors::OfferError::OfferCounterOverflow))?;
        Ok(id)
    }
}
