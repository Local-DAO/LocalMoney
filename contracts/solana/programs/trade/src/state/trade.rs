use anchor_lang::prelude::*;
use offer::state::OfferType;

#[account]
#[derive(Debug)]
pub struct Trade {
    /// PDA bump seed
    pub bump: u8,

    /// Unique trade ID
    pub id: u64,

    /// Reference to offer
    pub offer_id: u64,

    /// Buyer pubkey
    pub buyer: Pubkey,

    /// Seller pubkey
    pub seller: Pubkey,

    /// Current trade state
    pub state: TradeState,

    /// Token amount (token lamports)
    pub amount: u64,

    /// Fiat amount (fiat cents)
    pub fiat_amount: u64,

    /// SPL token mint
    pub token_mint: Pubkey,

    /// Fiat currency code (ISO 4217, e.g., "USD")
    pub fiat_currency: [u8; 3],

    /// Buyer's encrypted contact info
    pub buyer_contact: String,

    /// Seller's encrypted contact info
    pub seller_contact: String,

    /// Escrow vault PDA
    pub escrow_vault: Pubkey,

    /// Assigned arbitrator (if disputed)
    pub arbitrator: Option<Pubkey>,

    /// Dispute initiated timestamp
    pub dispute_initiated_at: Option<i64>,

    /// Trade expiration timestamp
    pub expires_at: i64,

    /// Timestamps
    pub created_at: i64,
    pub updated_at: i64,
}

impl Trade {
    /// Account space calculation
    /// 8 (discriminator) + 1 (bump) + 8 (id) + 8 (offer_id) +
    /// 32 (buyer) + 32 (seller) + 1 (state) + 8 (amount) + 8 (fiat_amount) +
    /// 32 (token_mint) + 3 (fiat_currency) +
    /// (4 + 280) (buyer_contact) + (4 + 280) (seller_contact) +
    /// 32 (escrow_vault) + (1 + 32) (arbitrator) + (1 + 8) (dispute_initiated_at) +
    /// 8 (expires_at) + 2*8 (timestamps)
    pub const LEN: usize = 8 + 1 + 8 + 8 + 32 + 32 + 1 + 8 + 8 + 32 + 3
        + (4 + 280) + (4 + 280) + 32 + (1 + 32) + (1 + 8) + 8 + 16;

    /// Maximum contact info length
    pub const MAX_CONTACT_LEN: usize = 280;

    /// Validate trade parameters
    pub fn validate(&self) -> Result<()> {
        // Check amount is positive
        require!(
            self.amount > 0,
            crate::errors::TradeError::InvalidAmount
        );

        // Check fiat amount is positive
        require!(
            self.fiat_amount > 0,
            crate::errors::TradeError::InvalidFiatAmount
        );

        // Check contact info lengths
        require!(
            self.buyer_contact.len() <= Self::MAX_CONTACT_LEN,
            crate::errors::TradeError::ContactInfoTooLong
        );

        require!(
            self.seller_contact.len() <= Self::MAX_CONTACT_LEN,
            crate::errors::TradeError::ContactInfoTooLong
        );

        // Validate fiat currency (basic check for null bytes)
        require!(
            self.fiat_currency[0] != 0,
            crate::errors::TradeError::InvalidFiatCurrency
        );

        // Check buyer and seller are different
        require!(
            self.buyer != self.seller,
            crate::errors::TradeError::SelfTradeNotAllowed
        );

        Ok(())
    }

    /// Check if trade can transition to new state
    pub fn can_transition_to(&self, new_state: TradeState) -> bool {
        use TradeState::*;

        match (&self.state, &new_state) {
            // From RequestCreated
            (RequestCreated, RequestAccepted) => true,
            (RequestCreated, RequestCanceled) => true,
            (RequestCreated, RequestExpired) => true,

            // From RequestAccepted
            (RequestAccepted, EscrowFunded) => true,
            (RequestAccepted, RequestExpired) => true,
            (RequestAccepted, RequestCanceled) => true,

            // From EscrowFunded
            (EscrowFunded, FiatDeposited) => true,
            (EscrowFunded, EscrowRefunded) => true,
            (EscrowFunded, Disputed) => true,

            // From FiatDeposited
            (FiatDeposited, EscrowReleased) => true,
            (FiatDeposited, Disputed) => true,

            // From Disputed
            (Disputed, DisputeResolved) => true,

            // From DisputeResolved
            (DisputeResolved, EscrowReleased) => true,
            (DisputeResolved, EscrowRefunded) => true,

            // Terminal states and invalid transitions
            _ => false,
        }
    }

    /// Transition to new state
    pub fn transition_to(&mut self, new_state: TradeState) -> Result<()> {
        require!(
            self.can_transition_to(new_state),
            crate::errors::TradeError::InvalidStateTransition
        );

        self.state = new_state;
        Ok(())
    }

    /// Check if trade has expired
    pub fn is_expired(&self, current_timestamp: i64) -> bool {
        current_timestamp > self.expires_at
    }

    /// Check if trade is in a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(
            self.state,
            TradeState::EscrowReleased
                | TradeState::RequestCanceled
                | TradeState::RequestExpired
                | TradeState::EscrowRefunded
        )
    }

    /// Check if trade is disputed
    pub fn is_disputed(&self) -> bool {
        self.state == TradeState::Disputed || self.state == TradeState::DisputeResolved
    }

    /// Check if escrow is funded
    pub fn is_escrow_funded(&self) -> bool {
        matches!(
            self.state,
            TradeState::EscrowFunded
                | TradeState::FiatDeposited
                | TradeState::Disputed
                | TradeState::DisputeResolved
        )
    }

    /// Get the party who should fund escrow based on offer type
    /// Note: trade.seller = offer owner (maker), trade.buyer = trade creator (taker)
    /// For Sell offers: maker (seller) has crypto and should fund
    /// For Buy offers: taker (buyer in trade struct, but actually selling crypto) should fund
    pub fn get_escrow_funder(&self, offer_type: crate::state::OfferType) -> Pubkey {
        match offer_type {
            // Buy offer: maker wants to buy, so taker (trade.buyer) sells and funds
            crate::state::OfferType::Buy => self.buyer,
            // Sell offer: maker wants to sell, so maker (trade.seller) has crypto and funds
            crate::state::OfferType::Sell => self.seller,
        }
    }

    /// Get the recipient of escrowed funds
    /// For Sell offers: taker (buyer) receives the crypto
    /// For Buy offers: maker (seller in trade struct, but actually buying) receives crypto
    pub fn get_escrow_recipient(&self, offer_type: crate::state::OfferType) -> Pubkey {
        match offer_type {
            // Buy offer: maker (trade.seller) is the buyer and receives crypto
            crate::state::OfferType::Buy => self.seller,
            // Sell offer: taker (trade.buyer) is the buyer and receives crypto
            crate::state::OfferType::Sell => self.buyer,
        }
    }
}

/// Trade state machine
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum TradeState {
    /// Trade request created by buyer
    RequestCreated,
    /// Trade request accepted by seller
    RequestAccepted,
    /// Escrow funded by appropriate party
    EscrowFunded,
    /// Fiat payment deposited (confirmed by buyer)
    FiatDeposited,
    /// Escrow released (trade complete)
    EscrowReleased,
    /// Trade request canceled (before escrow funded)
    RequestCanceled,
    /// Trade request expired
    RequestExpired,
    /// Escrow refunded
    EscrowRefunded,
    /// Dispute initiated
    Disputed,
    /// Dispute resolved by arbitrator
    DisputeResolved,
}

// OfferType is now imported from offer::state::OfferType instead of being duplicated
