use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct EscrowVault {
    /// PDA bump seed
    pub bump: u8,

    /// Associated trade ID
    pub trade_id: u64,

    /// Token mint address
    pub token_mint: Pubkey,

    /// Depositor (who funded the escrow)
    pub depositor: Pubkey,

    /// Amount deposited (in token lamports)
    pub amount: u64,

    /// Whether escrow is funded
    pub is_funded: bool,

    /// Whether escrow is frozen (during dispute)
    pub is_frozen: bool,

    /// Timestamps
    pub funded_at: Option<i64>,
    pub released_at: Option<i64>,
}

impl EscrowVault {
    /// Account space calculation
    /// 8 (discriminator) + 1 (bump) + 8 (trade_id) + 32 (token_mint) +
    /// 32 (depositor) + 8 (amount) + 1 (is_funded) + 1 (is_frozen) +
    /// (1 + 8) (funded_at) + (1 + 8) (released_at)
    pub const LEN: usize = 8 + 1 + 8 + 32 + 32 + 8 + 1 + 1 + 9 + 9;

    /// Mark as funded
    pub fn mark_funded(&mut self, amount: u64, depositor: Pubkey, timestamp: i64) -> Result<()> {
        require!(!self.is_funded, crate::errors::EscrowError::AlreadyFunded);
        require!(amount > 0, crate::errors::EscrowError::InvalidAmount);

        self.amount = amount;
        self.depositor = depositor;
        self.is_funded = true;
        self.funded_at = Some(timestamp);

        Ok(())
    }

    /// Mark as released
    pub fn mark_released(&mut self, timestamp: i64) -> Result<()> {
        require!(self.is_funded, crate::errors::EscrowError::NotFunded);
        require!(!self.is_frozen, crate::errors::EscrowError::EscrowFrozen);

        self.released_at = Some(timestamp);

        Ok(())
    }

    /// Freeze escrow (during dispute)
    pub fn freeze(&mut self) -> Result<()> {
        require!(self.is_funded, crate::errors::EscrowError::NotFunded);
        require!(!self.is_frozen, crate::errors::EscrowError::AlreadyFunded);

        self.is_frozen = true;

        Ok(())
    }

    /// Unfreeze escrow (after dispute resolution)
    pub fn unfreeze(&mut self) -> Result<()> {
        require!(self.is_frozen, crate::errors::EscrowError::EscrowNotFrozen);

        self.is_frozen = false;

        Ok(())
    }

    /// Check if can be released
    pub fn can_release(&self) -> bool {
        self.is_funded && !self.is_frozen
    }

    /// Calculate fee distribution
    pub fn calculate_fees(
        &self,
        burn_fee_pct: u16,
        chain_fee_pct: u16,
        warchest_fee_pct: u16,
        arbitrator_fee_pct: Option<u16>,
    ) -> Result<FeeDistribution> {
        let total_fee_pct = burn_fee_pct as u32
            + chain_fee_pct as u32
            + warchest_fee_pct as u32
            + arbitrator_fee_pct.unwrap_or(0) as u32;

        require!(
            total_fee_pct <= 10000,
            crate::errors::EscrowError::InvalidFeeConfiguration
        );

        // Calculate individual fees (using checked math)
        let burn_fee = self
            .amount
            .checked_mul(burn_fee_pct as u64)
            .and_then(|v| v.checked_div(10000))
            .ok_or(error!(crate::errors::EscrowError::ArithmeticOverflow))?;

        let chain_fee = self
            .amount
            .checked_mul(chain_fee_pct as u64)
            .and_then(|v| v.checked_div(10000))
            .ok_or(error!(crate::errors::EscrowError::ArithmeticOverflow))?;

        let warchest_fee = self
            .amount
            .checked_mul(warchest_fee_pct as u64)
            .and_then(|v| v.checked_div(10000))
            .ok_or(error!(crate::errors::EscrowError::ArithmeticOverflow))?;

        let arbitrator_fee = if let Some(arb_pct) = arbitrator_fee_pct {
            self.amount
                .checked_mul(arb_pct as u64)
                .and_then(|v| v.checked_div(10000))
                .ok_or(error!(crate::errors::EscrowError::ArithmeticOverflow))?
        } else {
            0
        };

        // Calculate total fees
        let total_fees = burn_fee
            .checked_add(chain_fee)
            .and_then(|v| v.checked_add(warchest_fee))
            .and_then(|v| v.checked_add(arbitrator_fee))
            .ok_or(error!(crate::errors::EscrowError::ArithmeticOverflow))?;

        // Calculate recipient amount (remaining after fees)
        let recipient_amount = self
            .amount
            .checked_sub(total_fees)
            .ok_or(error!(crate::errors::EscrowError::ArithmeticOverflow))?;

        Ok(FeeDistribution {
            burn_fee,
            chain_fee,
            warchest_fee,
            arbitrator_fee,
            total_fees,
            recipient_amount,
        })
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct FeeDistribution {
    pub burn_fee: u64,
    pub chain_fee: u64,
    pub warchest_fee: u64,
    pub arbitrator_fee: u64,
    pub total_fees: u64,
    pub recipient_amount: u64,
}
