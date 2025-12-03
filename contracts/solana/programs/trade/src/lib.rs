use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE");

#[program]
pub mod trade {
    use super::*;

    /// Initialize the trade counter
    ///
    /// This must be called once before any trades can be created.
    /// It initializes the global trade counter PDA.
    pub fn initialize_counter(ctx: Context<InitializeCounter>) -> Result<()> {
        instructions::initialize_counter::handler(ctx)
    }

    /// Create a new trade request
    ///
    /// Creates a trade request against an existing offer.
    ///
    /// # Arguments
    ///
    /// * `ctx` - CreateTrade context with trade PDA, counter, offer, buyer, profiles, hub config
    /// * `params` - Trade parameters (offer_id, amount, fiat_amount, contact info)
    ///
    /// # Access Control
    ///
    /// Anyone can create a trade, subject to limits from Hub config.
    ///
    /// # State Transition
    ///
    /// Initial state: RequestCreated
    ///
    /// # Security
    ///
    /// - Validates offer exists and is Active
    /// - Checks amount within offer's min/max range
    /// - Enforces max_active_trades limit via Profile CPI
    /// - Sets expiration timer from Hub config
    pub fn create_trade(ctx: Context<CreateTrade>, params: CreateTradeParams) -> Result<()> {
        instructions::create_trade::handler(ctx, params)
    }

    /// Accept a trade request
    ///
    /// Seller accepts a buyer's trade request.
    ///
    /// # Arguments
    ///
    /// * `ctx` - AcceptTrade context with trade PDA, seller, offer
    /// * `params` - Seller's encrypted contact info
    ///
    /// # Access Control
    ///
    /// Only the offer owner (seller) can accept the trade.
    ///
    /// # State Transition
    ///
    /// RequestCreated → RequestAccepted
    pub fn accept_trade(ctx: Context<AcceptTrade>, params: AcceptTradeParams) -> Result<()> {
        instructions::accept_trade::handler(ctx, params)
    }

    /// Fund escrow with tokens
    ///
    /// The appropriate party (buyer or seller, depending on offer type) deposits
    /// tokens into the escrow vault.
    ///
    /// # Arguments
    ///
    /// * `ctx` - FundEscrow context with trade PDA, funder, token accounts, escrow vault
    ///
    /// # Access Control
    ///
    /// - For Buy offers: seller funds escrow
    /// - For Sell offers: buyer funds escrow
    ///
    /// # State Transition
    ///
    /// RequestAccepted → EscrowFunded
    ///
    /// # Security
    ///
    /// - Validates funder is correct party based on offer type
    /// - Transfers exact trade amount to escrow vault
    pub fn fund_escrow(ctx: Context<FundEscrow>) -> Result<()> {
        instructions::fund_escrow::handler(ctx)
    }

    /// Confirm fiat payment deposited
    ///
    /// Buyer confirms they have received the off-chain fiat payment.
    ///
    /// # Arguments
    ///
    /// * `ctx` - ConfirmFiatDeposit context with trade PDA, buyer
    ///
    /// # Access Control
    ///
    /// Only the buyer can confirm fiat deposit.
    ///
    /// # State Transition
    ///
    /// EscrowFunded → FiatDeposited
    pub fn confirm_fiat_deposit(ctx: Context<ConfirmFiatDeposit>) -> Result<()> {
        instructions::confirm_fiat_deposit::handler(ctx)
    }

    /// Release escrowed tokens
    ///
    /// Releases tokens from escrow to the recipient with automatic fee distribution.
    ///
    /// # Arguments
    ///
    /// * `ctx` - ReleaseEscrow context with all token accounts, profiles, hub config
    ///
    /// # Access Control
    ///
    /// - Normal flow: seller initiates release
    /// - Dispute flow: arbitrator initiates release
    ///
    /// # State Transition
    ///
    /// FiatDeposited → EscrowReleased (normal flow)
    /// DisputeResolved → EscrowReleased (dispute flow)
    ///
    /// # Security
    ///
    /// - Distributes fees to treasury, warchest, and arbitrator (if disputed)
    /// - Updates both buyer and seller profile statistics
    /// - Decrements active_trades counter
    pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
        instructions::release_escrow::handler(ctx)
    }

    /// Cancel trade request
    ///
    /// Cancels a trade before escrow is funded.
    ///
    /// # Arguments
    ///
    /// * `ctx` - CancelTrade context with trade PDA, canceler
    ///
    /// # Access Control
    ///
    /// Buyer or seller can cancel before escrow is funded.
    ///
    /// # State Transition
    ///
    /// RequestCreated → RequestCanceled
    /// RequestAccepted → RequestCanceled
    ///
    /// # Security
    ///
    /// - Only allowed before escrow is funded
    /// - Decrements active_trades counter
    pub fn cancel_trade(ctx: Context<CancelTrade>) -> Result<()> {
        instructions::cancel_trade::handler(ctx)
    }

    /// Refund escrowed tokens
    ///
    /// Returns escrowed tokens to the depositor after escrow was funded.
    ///
    /// # Arguments
    ///
    /// * `ctx` - RefundTrade context with trade PDA, token accounts
    ///
    /// # Access Control
    ///
    /// Buyer or seller can initiate refund after escrow funded.
    ///
    /// # State Transition
    ///
    /// EscrowFunded → EscrowRefunded
    ///
    /// # Security
    ///
    /// - Returns full amount (no fees on refunds)
    /// - Calls Escrow program via CPI
    /// - Decrements active_trades counter
    pub fn refund_trade(ctx: Context<RefundTrade>) -> Result<()> {
        instructions::refund_trade::handler(ctx)
    }

    /// Initiate a dispute
    ///
    /// Starts the dispute resolution process by assigning an arbitrator
    /// and freezing the escrow.
    ///
    /// # Arguments
    ///
    /// * `ctx` - InitiateDispute context with trade PDA, arbitrator registry
    ///
    /// # Access Control
    ///
    /// Buyer or seller can initiate dispute after escrow funded.
    ///
    /// # State Transition
    ///
    /// EscrowFunded → Disputed
    /// FiatDeposited → Disputed
    ///
    /// # Security
    ///
    /// - Assigns arbitrator via Arbitrator program CPI
    /// - Freezes escrow via Escrow program CPI
    /// - Records dispute timestamp
    pub fn initiate_dispute(ctx: Context<InitiateDispute>) -> Result<()> {
        instructions::initiate_dispute::handler(ctx)
    }

    /// Check and mark trade as expired
    ///
    /// Marks a trade as expired if the expiration timer has passed.
    ///
    /// # Arguments
    ///
    /// * `ctx` - CheckExpiration context with trade PDA
    ///
    /// # Access Control
    ///
    /// Anyone can call this to mark expired trades.
    ///
    /// # State Transition
    ///
    /// RequestCreated → RequestExpired (if expired)
    /// RequestAccepted → RequestExpired (if expired)
    ///
    /// # Security
    ///
    /// - Only transitions if current timestamp > expires_at
    /// - Decrements active_trades counter
    pub fn check_expiration(ctx: Context<CheckExpiration>) -> Result<()> {
        instructions::check_expiration::handler(ctx)
    }
}
