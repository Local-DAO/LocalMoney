use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ");

#[program]
pub mod escrow {
    use super::*;

    /// Fund an escrow for a trade
    ///
    /// Locks tokens in a PDA-controlled Associated Token Account for the duration
    /// of a trade. Only the Trade program should call this via CPI.
    ///
    /// # Arguments
    ///
    /// * `ctx` - FundEscrow context with vault PDA, token accounts, and hub_config
    /// * `trade_id` - Unique trade identifier
    /// * `params` - Amount to escrow
    ///
    /// # Access Control
    ///
    /// Only the Trade program (verified via Hub config) can call this instruction.
    ///
    /// # Security
    ///
    /// - Validates amount > 0
    /// - Uses PDA as vault authority (no one can steal funds)
    /// - Emits event for off-chain tracking
    pub fn fund_escrow(
        ctx: Context<FundEscrow>,
        trade_id: u64,
        params: FundEscrowParams,
    ) -> Result<()> {
        instructions::fund_escrow::handler(ctx, trade_id, params)
    }

    /// Release escrowed tokens with fee distribution
    ///
    /// Distributes tokens to recipient with automatic fee deductions for:
    /// - Chain fee (to treasury)
    /// - Warchest fee
    /// - Arbitrator fee (if dispute was resolved)
    /// - Burn fee (retained/sent to burn address)
    ///
    /// # Arguments
    ///
    /// * `ctx` - ReleaseEscrow context with all recipient token accounts and hub_config
    /// * `params` - Fee percentages from Hub config
    ///
    /// # Access Control
    ///
    /// Only the Trade program (verified via Hub config) can call this instruction.
    ///
    /// # Security
    ///
    /// - Checks vault is not frozen
    /// - Validates fee configuration doesn't exceed 100%
    /// - Uses checked arithmetic for fee calculations
    /// - PDA signs all token transfers
    pub fn release_escrow(
        ctx: Context<ReleaseEscrow>,
        params: ReleaseEscrowParams,
    ) -> Result<()> {
        instructions::release_escrow::handler(ctx, params)
    }

    /// Refund escrowed tokens to depositor
    ///
    /// Returns the full escrowed amount to the original depositor.
    /// Used when a trade is canceled after escrow was funded.
    ///
    /// # Arguments
    ///
    /// * `ctx` - RefundEscrow context with vault, depositor token account, and hub_config
    ///
    /// # Access Control
    ///
    /// Only the Trade program (verified via Hub config) can call this instruction.
    ///
    /// # Security
    ///
    /// - Checks vault is funded
    /// - Checks vault is not frozen
    /// - Returns full amount (no fees on refunds)
    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        instructions::refund_escrow::handler(ctx)
    }

    /// Freeze escrow during dispute
    ///
    /// Prevents release of escrowed funds while a dispute is being resolved.
    ///
    /// # Arguments
    ///
    /// * `ctx` - FreezeEscrow context with vault PDA and hub_config
    ///
    /// # Access Control
    ///
    /// Only the Trade or Arbitrator programs (verified via Hub config) can call this instruction.
    pub fn freeze_escrow(ctx: Context<FreezeEscrow>) -> Result<()> {
        instructions::freeze_escrow::handler(ctx)
    }

    /// Unfreeze escrow after dispute resolution
    ///
    /// Allows release of escrowed funds after arbitrator resolves the dispute.
    ///
    /// # Arguments
    ///
    /// * `ctx` - UnfreezeEscrow context with vault PDA and hub_config
    ///
    /// # Access Control
    ///
    /// Only the Arbitrator program (verified via Hub config) can call this instruction.
    pub fn unfreeze_escrow(ctx: Context<UnfreezeEscrow>) -> Result<()> {
        instructions::unfreeze_escrow::handler(ctx)
    }
}
