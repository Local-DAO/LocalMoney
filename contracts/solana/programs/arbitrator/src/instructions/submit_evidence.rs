use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct SubmitEvidence<'info> {
    #[account(
        mut,
        seeds = [b"dispute", dispute.trade_id.to_le_bytes().as_ref()],
        bump = dispute.bump
    )]
    pub dispute: Account<'info, Dispute>,

    pub submitter: Signer<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SubmitEvidenceParams {
    pub evidence: String,
    pub is_buyer: bool,
}

pub fn handler(ctx: Context<SubmitEvidence>, params: SubmitEvidenceParams) -> Result<()> {
    let dispute = &mut ctx.accounts.dispute;

    // Verify submitter is buyer or seller
    if params.is_buyer {
        require!(
            ctx.accounts.submitter.key() == dispute.buyer,
            ArbitratorError::Unauthorized
        );
        dispute.submit_buyer_evidence(params.evidence)?;
    } else {
        require!(
            ctx.accounts.submitter.key() == dispute.seller,
            ArbitratorError::Unauthorized
        );
        dispute.submit_seller_evidence(params.evidence)?;
    }

    emit!(EvidenceSubmitted {
        trade_id: dispute.trade_id,
        submitter: ctx.accounts.submitter.key(),
        is_buyer: params.is_buyer,
    });

    Ok(())
}

#[event]
pub struct EvidenceSubmitted {
    pub trade_id: u64,
    pub submitter: Pubkey,
    pub is_buyer: bool,
}
