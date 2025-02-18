use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use solana_program::instruction::AccountMeta;

declare_id!("84veR3Kq5jLFCrmgYTSWSyH2RcHYMDVY75EBrqJochp4");

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

        // Calculate total price for the trade
        let total_price = amount
            .checked_mul(offer.price_per_token)
            .ok_or(OfferError::CalculationError)?;

        // Prepare accounts for CPI call
        let accounts = vec![
            AccountMeta::new(ctx.accounts.trade.key(), false),
            AccountMeta::new(ctx.accounts.offer.creator, true),
            AccountMeta::new_readonly(ctx.accounts.token_mint.key(), false),
            AccountMeta::new(ctx.accounts.seller_token_account.key(), false),
            AccountMeta::new(ctx.accounts.escrow_account.key(), false),
            AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
            AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
        ];

        // Create the trade instruction
        let ix = trade::create_trade_instruction(
            &ctx.accounts.trade_program.key(),
            &accounts,
            amount,
            total_price,
        );

        // Invoke the trade program
        solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.trade.to_account_info(),
                ctx.accounts.offer.to_account_info(),
                ctx.accounts.token_mint.to_account_info(),
                ctx.accounts.seller_token_account.to_account_info(),
                ctx.accounts.escrow_account.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        msg!("Offer taken successfully and trade created");
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
    #[account(mut)]
    pub taker: Signer<'info>,
    /// CHECK: Validated in CPI call to trade program
    pub trade: UncheckedAccount<'info>,
    pub token_mint: Box<Account<'info, token::Mint>>,
    #[account(
        mut,
        constraint = seller_token_account.mint == token_mint.key(),
        constraint = seller_token_account.owner == offer.creator
    )]
    pub seller_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub escrow_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    /// CHECK: Validated in CPI call
    pub trade_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
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
    #[msg("Error in price calculation")]
    CalculationError,
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::{system_program, InstructionData};
    use solana_program_test::*;
    use solana_sdk::{
        account::Account as SolanaAccount,
        instruction::{AccountMeta, Instruction},
        signature::Keypair,
        signer::Signer,
        transaction::Transaction,
    };

    #[tokio::test]
    async fn test_offer_flow() {
        // Initialize program test environment
        let mut program_test = ProgramTest::new("offer", crate::ID, None);

        // Generate necessary keypairs
        let creator = Keypair::new();
        let taker = Keypair::new();
        let offer = Keypair::new();
        let token_mint = Keypair::new();

        // Add accounts with some SOL
        program_test.add_account(
            creator.pubkey(),
            SolanaAccount {
                lamports: 1_000_000_000,
                data: vec![],
                owner: system_program::ID,
                executable: false,
                rent_epoch: 0,
            },
        );

        program_test.add_account(
            taker.pubkey(),
            SolanaAccount {
                lamports: 1_000_000_000,
                data: vec![],
                owner: system_program::ID,
                executable: false,
                rent_epoch: 0,
            },
        );

        // Start the test environment
        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

        // Create the CreateOffer instruction
        let mut instruction_data = vec![0u8]; // CreateOffer discriminator
        instruction_data.extend_from_slice(&1000u64.to_le_bytes()); // amount
        instruction_data.extend_from_slice(&100_000u64.to_le_bytes()); // price_per_token
        instruction_data.extend_from_slice(&100u64.to_le_bytes()); // min_amount
        instruction_data.extend_from_slice(&1000u64.to_le_bytes()); // max_amount

        let ix = Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new(offer.pubkey(), false),
                AccountMeta::new(creator.pubkey(), true),
                AccountMeta::new_readonly(token_mint.pubkey(), false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
            data: instruction_data,
        };

        let mut transaction = Transaction::new_with_payer(&[ix], Some(&payer.pubkey()));
        transaction.sign(&[&payer, &creator, &offer], recent_blockhash);

        banks_client.process_transaction(transaction).await.unwrap();

        // Verify offer was created
        let offer_account = banks_client
            .get_account(offer.pubkey())
            .await
            .unwrap()
            .unwrap();
        let offer_data = Offer::try_deserialize(&mut offer_account.data.as_ref()).unwrap();
        assert_eq!(offer_data.creator, creator.pubkey());
        assert_eq!(offer_data.token_mint, token_mint.pubkey());
        assert_eq!(offer_data.amount, 1000);
        assert_eq!(offer_data.price_per_token, 100_000);
        assert_eq!(offer_data.status, OfferStatus::Active);

        // Note: A complete test would need to:
        // 1. Initialize the token mint
        // 2. Create token accounts for seller and escrow
        // 3. Mint tokens to seller's account
        // 4. Set up proper token account authorities
        // 5. Create a proper trade account
        //
        // For now, we've verified the basic offer creation flow
        // The take_offer functionality would need a more complete token setup
        // to test properly
    }
}
