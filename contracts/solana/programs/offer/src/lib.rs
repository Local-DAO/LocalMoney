use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use trade::program::Trade as TradeProgram;
use trade::{self, Trade};

declare_id!("52CejgfZEeefMzvYqJ7RmcT4NzemCDZf4nsX3kywuw2B");

// Constants for account sizes
pub const MINT_SIZE: usize = 82;
pub const TOKEN_ACCOUNT_SIZE: usize = 165;

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
        require!(amount > 0, OfferError::InvalidAmount);
        require!(price_per_token > 0, OfferError::InvalidPrice);
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

        // Calculate total price
        let _total_price = amount
            .checked_mul(ctx.accounts.offer.price_per_token)
            .ok_or(OfferError::CalculationError)?;

        // Check escrow balance and transfer if needed
        let escrow_balance = ctx.accounts.escrow_account.amount;
        if escrow_balance < amount {
            let transfer_amount = amount - escrow_balance;

            // Create signer seeds
            let seeds: &[&[&[u8]]] = &[&[
                b"trade",
                &ctx.accounts.creator.key().to_bytes(),
                &ctx.accounts.token_mint.key().to_bytes(),
                &[ctx.bumps.trade],
            ]];

            // Transfer tokens to escrow using CpiContext
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.seller_token_account.to_account_info(),
                        to: ctx.accounts.escrow_account.to_account_info(),
                        authority: ctx.accounts.trade.to_account_info(),
                    },
                    seeds,
                ),
                transfer_amount,
            )?;
        }

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
        payer = creator,
        space = Offer::LEN,
        seeds = [b"offer".as_ref(), creator.key().as_ref()],
        bump
    )]
    pub offer: Account<'info, Offer>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub token_mint: Account<'info, token::Mint>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateOffer<'info> {
    #[account(
        mut,
        seeds = [b"offer".as_ref(), creator.key().as_ref()],
        bump,
        has_one = creator
    )]
    pub offer: Account<'info, Offer>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct OfferStatusUpdate<'info> {
    #[account(
        mut,
        seeds = [b"offer".as_ref(), creator.key().as_ref()],
        bump,
        has_one = creator
    )]
    pub offer: Account<'info, Offer>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct TakeOffer<'info> {
    #[account(
        mut,
        has_one = creator,
        has_one = token_mint,
        constraint = offer.status == OfferStatus::Active,
        seeds = [b"offer", creator.key().as_ref()],
        bump
    )]
    pub offer: Account<'info, Offer>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_mint: Account<'info, token::Mint>,

    #[account(
        mut,
        constraint = seller_token_account.mint == token_mint.key(),
        constraint = seller_token_account.owner == creator.key(),
        token::mint = token_mint
    )]
    pub seller_token_account: Account<'info, token::TokenAccount>,

    #[account(
        mut,
        constraint = escrow_account.mint == token_mint.key(),
        constraint = escrow_account.owner == trade.key(),
        token::mint = token_mint,
        token::authority = trade
    )]
    pub escrow_account: Account<'info, token::TokenAccount>,

    #[account(
        seeds = [b"trade", creator.key().as_ref(), token_mint.key().as_ref()],
        bump,
        seeds::program = trade_program.key()
    )]
    pub trade: Account<'info, Trade>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub trade_program: Program<'info, TradeProgram>,
}

#[account]
#[derive(Default)]
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

impl Offer {
    pub const LEN: usize = 8 +  // discriminator
        32 +     // creator pubkey
        32 +     // token_mint pubkey
        8 +      // amount
        8 +      // price_per_token
        8 +      // min_amount
        8 +      // max_amount
        2 +      // status enum (1 for discriminator, 1 for variant)
        6 +      // padding for alignment
        8 +      // created_at
        8 +      // updated_at
        256; // padding for future updates
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug, Default)]
pub enum OfferStatus {
    #[default]
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
    #[msg("Price must be greater than zero")]
    InvalidPrice,
    #[msg("Insufficient amount available")]
    InsufficientAmount,
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::system_program;
    use solana_program_test::*;
    use solana_sdk::{
        account::Account as SolanaAccount,
        instruction::{AccountMeta, Instruction},
        signature::Keypair,
        signer::Signer,
        transaction::Transaction,
    };

    const TRADE_PROGRAM_ID: &str = "8c2oLSoAo2FG2HpyvhfNghRTzpQRV4k3wR7jWPA4rHpH";

    #[tokio::test]
    async fn test_offer_flow() {
        // Initialize program test environment
        let mut program_test = ProgramTest::new("offer", crate::ID, None);

        // Generate necessary keypairs
        let creator = Keypair::new();
        let taker = Keypair::new();
        let offer = Keypair::new();
        let token_mint = Keypair::new();
        let buyer = Keypair::new();

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

        program_test.add_account(
            buyer.pubkey(),
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

        // Create token mint
        let token_mint = Keypair::new();
        let mint_rent = banks_client.get_rent().await.unwrap().minimum_balance(82); // Mint size

        let ix = solana_sdk::system_instruction::create_account(
            &payer.pubkey(),
            &token_mint.pubkey(),
            mint_rent,
            82, // Mint size
            &spl_token::id(),
        );
        let mut transaction = Transaction::new_with_payer(&[ix], Some(&payer.pubkey()));
        transaction.sign(&[&payer, &token_mint], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Create seller token account
        let seller_token_account = Keypair::new();
        let ix = solana_sdk::system_instruction::create_account(
            &payer.pubkey(),
            &seller_token_account.pubkey(),
            banks_client.get_rent().await.unwrap().minimum_balance(165), // Token account size
            165,                                                         // Token account size
            &spl_token::id(),
        );
        let mut transaction = Transaction::new_with_payer(&[ix], Some(&payer.pubkey()));
        transaction.sign(&[&payer, &seller_token_account], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Create escrow token account
        let escrow_token_account = Keypair::new();
        let ix = solana_sdk::system_instruction::create_account(
            &payer.pubkey(),
            &escrow_token_account.pubkey(),
            banks_client.get_rent().await.unwrap().minimum_balance(165), // Token account size
            165,                                                         // Token account size
            &spl_token::id(),
        );
        let mut transaction = Transaction::new_with_payer(&[ix], Some(&payer.pubkey()));
        transaction.sign(&[&payer, &escrow_token_account], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Create offer PDA
        let (offer_pda, _) =
            Pubkey::find_program_address(&[b"offer", creator.pubkey().as_ref()], &crate::ID);

        // Create trade PDA
        let (trade_pda, trade_bump) = Pubkey::find_program_address(
            &[
                b"trade",
                creator.pubkey().as_ref(),
                token_mint.pubkey().as_ref(),
            ],
            &Pubkey::new_from_array(TRADE_PROGRAM_ID.as_bytes().try_into().unwrap()),
        );

        // Create offer
        let create_offer_ix = Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new(offer_pda, false),
                AccountMeta::new(creator.pubkey(), true),
                AccountMeta::new_readonly(token_mint.pubkey(), false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
            data: {
                let mut data = vec![0u8]; // CreateOffer discriminator
                data.extend_from_slice(&1_000_000u64.to_le_bytes()); // amount
                data.extend_from_slice(&1_000u64.to_le_bytes()); // price_per_token
                data.extend_from_slice(&100_000u64.to_le_bytes()); // min_amount
                data.extend_from_slice(&1_000_000u64.to_le_bytes()); // max_amount
                data
            },
        };
        let mut transaction =
            Transaction::new_with_payer(&[create_offer_ix], Some(&payer.pubkey()));
        transaction.sign(&[&payer, &creator], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Take offer
        let take_offer_ix = Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new(offer_pda, false),
                AccountMeta::new_readonly(creator.pubkey(), true),
                AccountMeta::new_readonly(token_mint.pubkey(), false),
                AccountMeta::new(seller_token_account.pubkey(), false),
                AccountMeta::new(escrow_token_account.pubkey(), false),
                AccountMeta::new_readonly(trade_pda, false),
                AccountMeta::new(buyer.pubkey(), true),
                AccountMeta::new_readonly(spl_token::id(), false),
                AccountMeta::new_readonly(system_program::ID, false),
                AccountMeta::new_readonly(solana_sdk::sysvar::rent::ID, false),
            ],
            data: {
                let mut data = vec![5u8]; // TakeOffer discriminator
                data.extend_from_slice(&500_000u64.to_le_bytes()); // amount to take
                data
            },
        };

        let mut transaction = Transaction::new_with_payer(&[take_offer_ix], Some(&payer.pubkey()));
        transaction.sign(&[&payer, &buyer, &creator], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Verify escrow balance
        let escrow_account = banks_client
            .get_account(escrow_token_account.pubkey())
            .await
            .unwrap()
            .unwrap();
        let escrow_token = TokenAccount::try_deserialize(&mut &escrow_account.data[..]).unwrap();
        assert_eq!(escrow_token.amount, 500_000);
    }
}
