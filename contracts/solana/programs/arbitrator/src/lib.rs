use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::*;

declare_id!("J5BNGJ128bxHuWemwaoGkDqy8DVSvsA7o5kpdy9eDoNe");

#[program]
pub mod arbitrator {
    use super::*;

    /// Register a new arbitrator for a specific fiat currency
    ///
    /// Admin-only operation to add arbitrators to the system.
    ///
    /// # Arguments
    ///
    /// * `ctx` - RegisterArbitrator context with hub_config for admin verification
    /// * `arbitrator_pubkey` - Public key of the arbitrator
    /// * `fiat_currency` - Fiat currency code (ISO 4217)
    ///
    /// # Access Control
    ///
    /// Only the Hub admin (verified via Hub config) can register arbitrators.
    pub fn register_arbitrator(
        ctx: Context<RegisterArbitrator>,
        arbitrator_pubkey: Pubkey,
        fiat_currency: [u8; 3],
    ) -> Result<()> {
        instructions::register_arbitrator::handler(ctx, arbitrator_pubkey, fiat_currency)
    }

    /// Remove (deactivate) an arbitrator
    ///
    /// Admin-only operation to deactivate arbitrators.
    ///
    /// # Arguments
    ///
    /// * `ctx` - RemoveArbitrator context with hub_config for admin verification
    ///
    /// # Access Control
    ///
    /// Only the Hub admin (verified via Hub config) can remove arbitrators.
    pub fn remove_arbitrator(ctx: Context<RemoveArbitrator>) -> Result<()> {
        instructions::remove_arbitrator::handler(ctx)
    }

    /// Assign an arbitrator to a disputed trade
    ///
    /// Called by the Trade program when a dispute is initiated.
    /// Selects an arbitrator for the given fiat currency.
    ///
    /// # Arguments
    ///
    /// * `ctx` - AssignArbitrator context with hub_config for authorization
    /// * `trade_id` - ID of the disputed trade
    /// * `params` - Buyer, seller, and fiat currency
    ///
    /// # Access Control
    ///
    /// Only the Trade program (verified via Hub config) can call this instruction.
    ///
    /// # Selection Algorithm
    ///
    /// Currently uses a provided arbitrator account. In production,
    /// this could be enhanced with random selection from available arbitrators.
    pub fn assign_arbitrator(
        ctx: Context<AssignArbitrator>,
        trade_id: u64,
        params: AssignArbitratorParams,
    ) -> Result<()> {
        instructions::assign_arbitrator::handler(ctx, trade_id, params)
    }

    /// Submit evidence for a dispute
    ///
    /// Allows buyer or seller to submit their evidence/explanation.
    ///
    /// # Arguments
    ///
    /// * `ctx` - SubmitEvidence context
    /// * `params` - Evidence text and whether submitter is buyer
    ///
    /// # Access Control
    ///
    /// Only the buyer or seller of the disputed trade can submit evidence.
    ///
    /// # Security
    ///
    /// - Evidence can only be submitted once per party
    /// - Maximum length enforced (500 chars)
    /// - Stored on-chain as string (consider IPFS hash for large evidence)
    pub fn submit_evidence(
        ctx: Context<SubmitEvidence>,
        params: SubmitEvidenceParams,
    ) -> Result<()> {
        instructions::submit_evidence::handler(ctx, params)
    }

    /// Resolve a dispute
    ///
    /// Arbitrator makes final decision on who wins the dispute.
    ///
    /// # Arguments
    ///
    /// * `ctx` - ResolveDispute context
    /// * `params` - Resolution (BuyerWins or SellerWins)
    ///
    /// # Access Control
    ///
    /// Only the assigned arbitrator can resolve the dispute.
    ///
    /// # Effects
    ///
    /// - Marks dispute as resolved
    /// - Increments arbitrator's resolution count
    /// - Emits event for Trade program to process
    /// - Trade program should unfreeze and release escrow based on resolution
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        params: ResolveDisputeParams,
    ) -> Result<()> {
        instructions::resolve_dispute::handler(ctx, params)
    }
}
