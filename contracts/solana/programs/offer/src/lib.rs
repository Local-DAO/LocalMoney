use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use trade::program::Trade as TradeProgram;
use trade::{self, Trade};

declare_id!("FSnCsffRYjRwbpzFCkbwSFtgfSNbxrpYUsq84opqG4wW");

#[program]
pub mod offer {
    use super::*;

    pub fn create_offer(
        ctx: Context<CreateOffer>,
        amount: u64,
        price_per_token: u64, //TODO: instead of price per token, we should use a pct price based of the Price Oracle price of this token
        min_amount: u64,
        max_amount: u64,
        offer_type: OfferType,
    ) -> Result<()> {
        require!(amount > 0, OfferError::InvalidAmount);
        require!(price_per_token > 0, OfferError::InvalidPrice);
        require!(
            min_amount <= max_amount && max_amount <= amount,
            OfferError::InvalidAmounts
        );

        let offer = &mut ctx.accounts.offer;
        offer.maker = ctx.accounts.maker.key();
        offer.token_mint = ctx.accounts.token_mint.key();
        offer.amount = amount;
        offer.price_per_token = price_per_token;
        offer.min_amount = min_amount;
        offer.max_amount = max_amount;
        offer.offer_type = offer_type;
        offer.status = OfferStatus::Active;
        offer.created_at = Clock::get()?.unix_timestamp;
        offer.updated_at = Clock::get()?.unix_timestamp;

        msg!("Offer created successfully");
        Ok(())
    }

    pub fn update_offer(
        ctx: Context<UpdateOffer>,
        price_per_token: Option<u64>,
        min_amount: Option<u64>,
        max_amount: Option<u64>,
    ) -> Result<()> {
        let offer = &mut ctx.accounts.offer;

        if let Some(new_price) = price_per_token {
            offer.price_per_token = new_price;
        }

        if let Some(new_min) = min_amount {
            offer.min_amount = new_min;
        }

        if let Some(new_max) = max_amount {
            offer.max_amount = new_max;
        }

        // Validate amounts after update
        require!(
            offer.min_amount <= offer.max_amount && offer.max_amount <= offer.amount,
            OfferError::InvalidAmounts
        );

        offer.updated_at = Clock::get()?.unix_timestamp;
        msg!("Offer updated successfully");
        Ok(())
    }

    pub fn pause_offer(ctx: Context<OfferStatusUpdate>) -> Result<()> {
        let offer = &mut ctx.accounts.offer;
        require!(
            offer.status == OfferStatus::Active,
            OfferError::InvalidStatus
        );

        offer.status = OfferStatus::Paused;
        offer.updated_at = Clock::get()?.unix_timestamp;
        msg!("Offer paused successfully");
        Ok(())
    }

    pub fn resume_offer(ctx: Context<OfferStatusUpdate>) -> Result<()> {
        let offer = &mut ctx.accounts.offer;
        require!(
            offer.status == OfferStatus::Paused,
            OfferError::InvalidStatus
        );

        offer.status = OfferStatus::Active;
        offer.updated_at = Clock::get()?.unix_timestamp;
        msg!("Offer resumed successfully");
        Ok(())
    }

    pub fn close_offer(ctx: Context<OfferStatusUpdate>) -> Result<()> {
        let offer = &mut ctx.accounts.offer;
        require!(
            offer.status == OfferStatus::Active || offer.status == OfferStatus::Paused,
            OfferError::InvalidStatus
        );

        offer.status = OfferStatus::Closed;
        offer.updated_at = Clock::get()?.unix_timestamp;
        msg!("Offer closed successfully");
        Ok(())
    }

    pub fn take_offer(ctx: Context<TakeOffer>, amount: u64) -> Result<()> {
        // Validate offer status and amounts
        require!(
            ctx.accounts.offer.status == OfferStatus::Active,
            OfferError::InvalidStatus
        );
        require!(amount > 0, OfferError::InvalidAmount);
        require!(
            amount >= ctx.accounts.offer.min_amount && amount <= ctx.accounts.offer.max_amount,
            OfferError::InvalidAmount
        );
        require!(
            amount <= ctx.accounts.offer.amount,
            OfferError::InsufficientAmount
        );

        // Update offer state
        let offer = &mut ctx.accounts.offer;
        offer.amount = offer.amount.saturating_sub(amount);
        offer.updated_at = Clock::get()?.unix_timestamp;

        msg!("Offer taken successfully for {} tokens", amount);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateOffer<'info> {
    #[account(
        init,
        payer = maker,
        space = Offer::LEN,
        seeds = [b"offer".as_ref(), maker.key().as_ref()],
        bump
    )]
    pub offer: Account<'info, Offer>,
    #[account(mut)]
    pub maker: Signer<'info>,
    pub token_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateOffer<'info> {
    #[account(
        mut,
        seeds = [b"offer".as_ref(), maker.key().as_ref()],
        bump,
        has_one = maker
    )]
    pub offer: Account<'info, Offer>,
    pub maker: Signer<'info>,
}

#[derive(Accounts)]
pub struct OfferStatusUpdate<'info> {
    #[account(
        mut,
        seeds = [b"offer".as_ref(), maker.key().as_ref()],
        bump,
        has_one = maker
    )]
    pub offer: Account<'info, Offer>,
    pub maker: Signer<'info>,
}

#[derive(Accounts)]
pub struct TakeOffer<'info> {
    #[account(
        mut,
        has_one = maker,
        has_one = token_mint,
        constraint = offer.status == OfferStatus::Active,
        seeds = [b"offer", maker.key().as_ref()],
        bump
    )]
    pub offer: Account<'info, Offer>,

    /// CHECK: We're only reading the maker pubkey field, no need for additional checks
    pub maker: AccountInfo<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        seeds = [b"trade", maker.key().as_ref(), token_mint.key().as_ref()],
        bump,
        seeds::program = trade_program.key()
    )]
    pub trade: Account<'info, Trade>,

    #[account(mut)]
    pub taker: Signer<'info>,

    pub trade_program: Program<'info, TradeProgram>,
}

#[derive(Accounts)]
pub struct DepositEscrow<'info> {
    #[account(
        mut,
        constraint = offer.status == OfferStatus::Active,
        seeds = [b"offer", offer.maker.as_ref()],
        bump
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        constraint = trade.token_mint == offer.token_mint,
        seeds = [b"trade", offer.maker.as_ref(), offer.token_mint.as_ref()],
        bump,
        seeds::program = trade_program.key()
    )]
    pub trade: Account<'info, Trade>,

    pub depositor: Signer<'info>,

    pub trade_program: Program<'info, TradeProgram>,
}

#[account]
pub struct Offer {
    pub maker: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub price_per_token: u64,
    pub min_amount: u64,
    pub max_amount: u64,
    pub offer_type: OfferType,
    pub status: OfferStatus,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Offer {
    pub const LEN: usize = 8 +  // discriminator
        32 + // maker
        32 + // token_mint
        8 +  // amount
        8 +  // price_per_token
        8 +  // min_amount
        8 +  // max_amount
        1 +  // offer_type
        1 +  // status
        8 +  // created_at
        8 +  // updated_at
        32; // padding for future fields
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Default)]
pub enum OfferStatus {
    #[default]
    Active,
    Paused,
    Closed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Default)]
pub enum OfferType {
    #[default]
    Buy,
    Sell,
}

#[error_code]
pub enum OfferError {
    #[msg("Invalid offer status for this operation")]
    InvalidStatus,
    #[msg("Amount is outside the allowed range")]
    InvalidAmount,
    #[msg("Invalid amount configuration")]
    InvalidAmounts,
    #[msg("Error in price calculation")]
    CalculationError,
    #[msg("Price must be greater than zero")]
    InvalidPrice,
    #[msg("Insufficient amount available")]
    InsufficientAmount,
}
