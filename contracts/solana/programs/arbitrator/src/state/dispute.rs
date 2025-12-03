use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct Dispute {
    /// PDA bump seed
    pub bump: u8,

    /// Associated trade ID
    pub trade_id: u64,

    /// Buyer's public key
    pub buyer: Pubkey,

    /// Seller's public key
    pub seller: Pubkey,

    /// Assigned arbitrator
    pub arbitrator: Pubkey,

    /// Buyer's evidence (hash or short description)
    pub buyer_evidence: Option<String>,

    /// Seller's evidence (hash or short description)
    pub seller_evidence: Option<String>,

    /// Resolution decision
    pub resolution: Option<DisputeResolution>,

    /// Timestamps
    pub created_at: i64,
    pub resolved_at: Option<i64>,
}

impl Dispute {
    /// Account space calculation
    /// 8 (discriminator) + 1 (bump) + 8 (trade_id) + 32 (buyer) + 32 (seller) +
    /// 32 (arbitrator) + (1 + 4 + 500) (buyer_evidence) + (1 + 4 + 500) (seller_evidence) +
    /// (1 + 1) (resolution) + 8 (created_at) + (1 + 8) (resolved_at)
    pub const LEN: usize = 8 + 1 + 8 + 32 + 32 + 32 + 505 + 505 + 2 + 8 + 9;

    /// Maximum evidence length
    pub const MAX_EVIDENCE_LEN: usize = 500;

    /// Submit buyer's evidence
    pub fn submit_buyer_evidence(&mut self, evidence: String) -> Result<()> {
        require!(
            self.buyer_evidence.is_none(),
            crate::errors::ArbitratorError::EvidenceAlreadySubmitted
        );
        require!(
            evidence.len() <= Self::MAX_EVIDENCE_LEN,
            crate::errors::ArbitratorError::EvidenceTooLong
        );

        self.buyer_evidence = Some(evidence);
        Ok(())
    }

    /// Submit seller's evidence
    pub fn submit_seller_evidence(&mut self, evidence: String) -> Result<()> {
        require!(
            self.seller_evidence.is_none(),
            crate::errors::ArbitratorError::EvidenceAlreadySubmitted
        );
        require!(
            evidence.len() <= Self::MAX_EVIDENCE_LEN,
            crate::errors::ArbitratorError::EvidenceTooLong
        );

        self.seller_evidence = Some(evidence);
        Ok(())
    }

    /// Resolve dispute
    pub fn resolve(&mut self, resolution: DisputeResolution, timestamp: i64) -> Result<()> {
        require!(
            self.resolution.is_none(),
            crate::errors::ArbitratorError::DisputeAlreadyResolved
        );

        self.resolution = Some(resolution);
        self.resolved_at = Some(timestamp);

        Ok(())
    }

    /// Check if resolved
    pub fn is_resolved(&self) -> bool {
        self.resolution.is_some()
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum DisputeResolution {
    BuyerWins,
    SellerWins,
}
