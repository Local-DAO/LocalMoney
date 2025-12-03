use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(
        mut,
        seeds = [b"dispute", dispute.trade_id.to_le_bytes().as_ref()],
        bump = dispute.bump
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        seeds = [
            b"arbitrator",
            arbitrator.pubkey.as_ref(),
            arbitrator.fiat_currency.as_ref()
        ],
        bump = arbitrator.bump
    )]
    pub arbitrator: Account<'info, Arbitrator>,

    pub arbitrator_signer: Signer<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ResolveDisputeParams {
    pub resolution: DisputeResolution,
}

pub fn handler(ctx: Context<ResolveDispute>, params: ResolveDisputeParams) -> Result<()> {
    let dispute = &mut ctx.accounts.dispute;
    let arbitrator = &mut ctx.accounts.arbitrator;
    let clock = Clock::get()?;

    // Verify signer is the assigned arbitrator
    require!(
        ctx.accounts.arbitrator_signer.key() == arbitrator.pubkey,
        ArbitratorError::Unauthorized
    );

    require!(
        dispute.arbitrator == arbitrator.pubkey,
        ArbitratorError::NotAssignedArbitrator
    );

    // Resolve the dispute
    dispute.resolve(params.resolution, clock.unix_timestamp)?;

    // Mark arbitrator as resolved
    arbitrator.mark_resolved();

    emit!(DisputeResolved {
        trade_id: dispute.trade_id,
        arbitrator: arbitrator.pubkey,
        resolution: params.resolution,
        buyer: dispute.buyer,
        seller: dispute.seller,
    });

    Ok(())
}

#[event]
pub struct DisputeResolved {
    pub trade_id: u64,
    pub arbitrator: Pubkey,
    pub resolution: DisputeResolution,
    pub buyer: Pubkey,
    pub seller: Pubkey,
}
