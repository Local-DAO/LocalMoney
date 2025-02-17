use anchor_lang::prelude::*;

declare_id!("Gpy5ATEJY5YawGqJhBd1Xcd59NZW547tCjH9d8s2B1vp");

#[program]
pub mod offer {
    use super::*;

    pub fn create_offer(
        ctx: Context<CreateOffer>,
        amount: u64,
        price_per_token: u64,
        min_amount: u64,
        max_amount: u64,
    ) -> Result<()> {
        require!(
            min_amount <= max_amount && max_amount <= amount,
            OfferError::InvalidAmounts
        );

        let offer = &mut ctx.accounts.offer;
        offer.creator = ctx.accounts.creator.key();
        offer.token_mint = ctx.accounts.token_mint.key();
        offer.amount = amount;
        offer.price_per_token = price_per_token;
        offer.min_amount = min_amount;
        offer.max_amount = max_amount;
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
        let offer = &ctx.accounts.offer;
        require!(
            offer.status == OfferStatus::Active,
            OfferError::InvalidStatus
        );
        require!(
            amount >= offer.min_amount && amount <= offer.max_amount,
            OfferError::InvalidAmount
        );

        // Here we would create a new trade using the trade program via CPI
        // This would involve a CPI call to the trade program

        msg!("Offer taken successfully");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateOffer<'info> {
    #[account(init, payer = creator, space = 8 + std::mem::size_of::<Offer>())]
    pub offer: Account<'info, Offer>,
    #[account(mut)]
    pub creator: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_mint: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateOffer<'info> {
    #[account(mut, has_one = creator)]
    pub offer: Account<'info, Offer>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct OfferStatusUpdate<'info> {
    #[account(mut, has_one = creator)]
    pub offer: Account<'info, Offer>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct TakeOffer<'info> {
    #[account(mut)]
    pub offer: Account<'info, Offer>,
    pub taker: Signer<'info>,
    pub trade_program: Program<'info, System>, // Replace with actual trade program type
}

#[account]
pub struct Offer {
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub price_per_token: u64,
    pub min_amount: u64,
    pub max_amount: u64,
    pub status: OfferStatus,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum OfferStatus {
    Active,
    Paused,
    Closed,
}

#[error_code]
pub enum OfferError {
    #[msg("Invalid offer status for this operation")]
    InvalidStatus,
    #[msg("Amount is outside the allowed range")]
    InvalidAmount,
    #[msg("Invalid amount configuration")]
    InvalidAmounts,
}

#[cfg(test)]
mod tests {

    // Add tests here
}
