use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct Arbitrator {
    /// PDA bump seed
    pub bump: u8,

    /// Arbitrator's public key
    pub pubkey: Pubkey,

    /// Fiat currency this arbitrator handles (ISO 4217 code)
    pub fiat_currency: [u8; 3],

    /// Whether arbitrator is active
    pub is_active: bool,

    /// Statistics
    pub total_disputes: u64,
    pub resolved_disputes: u64,

    /// Registration timestamp
    pub registered_at: i64,
}

impl Arbitrator {
    /// Account space calculation
    /// 8 (discriminator) + 1 (bump) + 32 (pubkey) + 3 (fiat_currency) +
    /// 1 (is_active) + 2*8 (statistics) + 8 (registered_at)
    pub const LEN: usize = 8 + 1 + 32 + 3 + 1 + 16 + 8;

    /// Increment dispute counters
    pub fn increment_dispute(&mut self) {
        self.total_disputes = self.total_disputes.saturating_add(1);
    }

    /// Mark dispute as resolved
    pub fn mark_resolved(&mut self) {
        self.resolved_disputes = self.resolved_disputes.saturating_add(1);
    }

    /// Calculate success rate (basis points)
    pub fn success_rate(&self) -> u16 {
        if self.total_disputes == 0 {
            return 0;
        }

        ((self.resolved_disputes as f64 / self.total_disputes as f64) * 10000.0) as u16
    }
}
