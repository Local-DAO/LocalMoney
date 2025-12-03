use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct Offer {
    /// PDA bump seed
    pub bump: u8,

    /// Unique offer ID
    pub id: u64,

    /// Offer owner
    pub owner: Pubkey,

    /// Offer type (Buy or Sell)
    pub offer_type: OfferType,

    /// Offer state
    pub state: OfferState,

    /// Fiat currency code (ISO 4217, e.g., "USD")
    pub fiat_currency: [u8; 3],

    /// SPL token mint
    pub token_mint: Pubkey,

    /// Minimum amount (token lamports)
    pub min_amount: u64,

    /// Maximum amount (token lamports)
    pub max_amount: u64,

    /// Exchange rate (fiat cents per token unit)
    pub rate: u64,

    /// Description (max 280 chars)
    pub description: String,

    /// Timestamps
    pub created_at: i64,
    pub updated_at: i64,
}

impl Offer {
    /// Account space calculation
    /// 8 (discriminator) + 1 (bump) + 8 (id) + 32 (owner) +
    /// 1 (offer_type) + 1 (state) + 3 (fiat_currency) + 32 (token_mint) +
    /// 3*8 (amounts/rate) + (4 + 280) (description) + 2*8 (timestamps)
    pub const LEN: usize = 8 + 1 + 8 + 32 + 1 + 1 + 3 + 32 + 24 + (4 + 280) + 16;

    /// Maximum description length
    pub const MAX_DESCRIPTION_LEN: usize = 280;

    /// Validate offer parameters
    pub fn validate(&self) -> Result<()> {
        // Check amount range
        require!(
            self.min_amount < self.max_amount,
            crate::errors::OfferError::InvalidAmountRange
        );

        // Check description length
        require!(
            self.description.len() <= Self::MAX_DESCRIPTION_LEN,
            crate::errors::OfferError::DescriptionTooLong
        );

        // Validate fiat currency (basic check for null bytes)
        require!(
            self.fiat_currency[0] != 0,
            crate::errors::OfferError::InvalidFiatCurrency
        );

        Ok(())
    }

    /// Check if offer can transition to new state
    pub fn can_transition_to(&self, new_state: OfferState) -> bool {
        use OfferState::*;

        match (&self.state, &new_state) {
            // From Active
            (Active, Paused) => true,
            (Active, Deleted) => true,

            // From Paused
            (Paused, Active) => true,
            (Paused, Deleted) => true,

            // Deleted is terminal state
            (Deleted, _) => false,

            // No self-transitions needed
            _ => false,
        }
    }

    /// Transition to new state
    pub fn transition_to(&mut self, new_state: OfferState) -> Result<()> {
        require!(
            self.can_transition_to(new_state),
            crate::errors::OfferError::InvalidStateTransition
        );

        self.state = new_state;
        Ok(())
    }

    /// Check if offer is active
    pub fn is_active(&self) -> bool {
        self.state == OfferState::Active
    }

    /// Check if offer is deleted
    pub fn is_deleted(&self) -> bool {
        self.state == OfferState::Deleted
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum OfferType {
    Buy,
    Sell,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum OfferState {
    Active,
    Paused,
    Deleted,
}
