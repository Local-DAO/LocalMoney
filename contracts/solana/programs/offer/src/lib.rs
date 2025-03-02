use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

declare_id!("FSnCsffRYjRwbpzFCkbwSFtgfSNbxrpYUsq84opqG4wW");

#[program]
pub mod offer {
    use super::*;

    pub fn create_offer(
        ctx: Context<CreateOffer>,
        price_per_token: u64, //TODO: instead of price per token, we should use a pct price based of the Price Oracle price of this token
        min_amount: u64,
        max_amount: u64,
        offer_type: OfferType,
    ) -> Result<()> {
        require!(price_per_token > 0, OfferError::InvalidPrice);
        require!(min_amount <= max_amount, OfferError::InvalidAmounts);

        let offer = &mut ctx.accounts.offer;
        offer.maker = ctx.accounts.maker.key();
        offer.token_mint = ctx.accounts.token_mint.key();
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
            offer.min_amount <= offer.max_amount,
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
}

#[derive(Accounts)]
#[instruction(price_per_token: u64, min_amount: u64, max_amount: u64, offer_type: OfferType)]
pub struct CreateOffer<'info> {
    #[account(
        init,
        payer = maker,
        space = Offer::LEN,
        seeds = [
            b"offer".as_ref(), 
            maker.key().as_ref(),
            token_mint.key().as_ref(),
            &offer_type.to_u8().to_le_bytes(),
            &min_amount.to_le_bytes(),
            &max_amount.to_le_bytes()
        ],
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
        seeds = [
            b"offer".as_ref(), 
            maker.key().as_ref(),
            offer.token_mint.as_ref(),
            &offer.offer_type.to_u8().to_le_bytes(),
            &offer.min_amount.to_le_bytes(),
            &offer.max_amount.to_le_bytes()
        ],
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
        seeds = [
            b"offer".as_ref(), 
            maker.key().as_ref(),
            offer.token_mint.as_ref(),
            &offer.offer_type.to_u8().to_le_bytes(),
            &offer.min_amount.to_le_bytes(),
            &offer.max_amount.to_le_bytes()
        ],
        bump,
        has_one = maker
    )]
    pub offer: Account<'info, Offer>,
    pub maker: Signer<'info>,
}

#[account]
pub struct Offer {
    pub maker: Pubkey,
    pub token_mint: Pubkey,
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Default, Copy)]
pub enum OfferType {
    #[default]
    Buy,
    Sell,
}

// Add a helper method to convert OfferType to u8 for use in seeds
impl OfferType {
    pub fn to_u8(&self) -> u8 {
        match self {
            OfferType::Buy => 0,
            OfferType::Sell => 1,
        }
    }
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
