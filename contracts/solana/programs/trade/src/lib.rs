use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token};
use solana_program::{
    instruction::{AccountMeta, Instruction},
    msg,
    pubkey::Pubkey,
};

// Declare program ID
declare_id!("ENJvkqkwjEKd2CPd9NgcwEywx6ia3tCrvHE1ReZGac8t");

#[program]
pub mod trade {
    use super::*;

    pub fn create_trade(ctx: Context<CreateTrade>, amount: u64, price: u64) -> Result<()> {
        let trade = &mut ctx.accounts.trade;
        trade.seller = ctx.accounts.seller.key();
        trade.buyer = None;
        trade.amount = amount;
        trade.price = price;
        trade.token_mint = ctx.accounts.token_mint.key();
        trade.escrow_account = ctx.accounts.escrow_account.key();
        trade.status = TradeStatus::Open;
        trade.created_at = Clock::get()?.unix_timestamp;
        trade.updated_at = Clock::get()?.unix_timestamp;

        // Transfer tokens to escrow
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.seller_token_account.to_account_info(),
                to: ctx.accounts.escrow_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        msg!("Trade created successfully");
        Ok(())
    }

    pub fn accept_trade(ctx: Context<AcceptTrade>) -> Result<()> {
        let trade = &mut ctx.accounts.trade;
        require!(
            trade.status == TradeStatus::Open,
            TradeError::InvalidTradeStatus
        );

        trade.buyer = Some(ctx.accounts.buyer.key());
        trade.status = TradeStatus::InProgress;
        trade.updated_at = Clock::get()?.unix_timestamp;

        msg!("Trade accepted successfully");
        Ok(())
    }

    pub fn complete_trade(ctx: Context<CompleteTrade>) -> Result<()> {
        let trade = &mut ctx.accounts.trade;
        require!(
            trade.status == TradeStatus::InProgress,
            TradeError::InvalidTradeStatus
        );

        // Verify price using common module
        common::verify_price(
            &ctx.accounts.price_program,
            &ctx.accounts.price_oracle,
            trade.price,
        )?;

        // Transfer tokens from escrow to buyer
        let trade_account_info = trade.to_account_info();

        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.buyer_token_account.to_account_info(),
                to: ctx.accounts.escrow_account.to_account_info(),
                authority: trade_account_info,
            },
        );

        token::transfer(transfer_ctx, trade.amount)?;

        // Update profiles using common module
        common::update_profile_stats(
            &ctx.accounts.profile_program,
            &ctx.accounts.buyer_profile,
            &ctx.accounts.seller_profile,
        )?;

        trade.status = TradeStatus::Completed;
        trade.updated_at = Clock::get()?.unix_timestamp;

        msg!("Trade completed successfully");
        Ok(())
    }

    pub fn cancel_trade(ctx: Context<CancelTrade>) -> Result<()> {
        let trade = &mut ctx.accounts.trade;
        require!(
            trade.status == TradeStatus::Open,
            TradeError::InvalidTradeStatus
        );

        // Return tokens from escrow to seller
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.escrow_account.to_account_info(),
                to: ctx.accounts.seller_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, trade.amount)?;

        trade.status = TradeStatus::Cancelled;
        trade.updated_at = Clock::get()?.unix_timestamp;

        msg!("Trade cancelled successfully");
        Ok(())
    }

    pub fn dispute_trade(ctx: Context<DisputeTrade>) -> Result<()> {
        let trade = &mut ctx.accounts.trade;
        require!(
            trade.status == TradeStatus::InProgress,
            TradeError::InvalidTradeStatus
        );

        // Verify disputer is either buyer or seller
        let disputer_key = ctx.accounts.disputer.key();
        require!(
            trade.seller == disputer_key || trade.buyer == Some(disputer_key),
            TradeError::UnauthorizedDisputer
        );

        trade.status = TradeStatus::Disputed;
        trade.updated_at = Clock::get()?.unix_timestamp;

        msg!("Trade disputed successfully");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateTrade<'info> {
    #[account(init, payer = seller, space = 8 + std::mem::size_of::<Trade>())]
    pub trade: Account<'info, Trade>,
    #[account(mut)]
    pub seller: Signer<'info>,
    pub token_mint: Box<Account<'info, token::Mint>>,
    #[account(
        mut,
        constraint = seller_token_account.mint == token_mint.key(),
        constraint = seller_token_account.owner == seller.key()
    )]
    pub seller_token_account: Box<Account<'info, token::TokenAccount>>,
    #[account(
        mut,
        constraint = escrow_account.mint == token_mint.key()
    )]
    pub escrow_account: Box<Account<'info, token::TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptTrade<'info> {
    #[account(mut)]
    pub trade: Account<'info, Trade>,
    pub buyer: Signer<'info>,
}

#[derive(Accounts)]
pub struct CompleteTrade<'info> {
    #[account(mut)]
    pub trade: Account<'info, Trade>,
    #[account(constraint = seller.key() == trade.seller)]
    pub seller: Signer<'info>,
    #[account(constraint = buyer.key() == trade.buyer.unwrap())]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        constraint = escrow_account.key() == trade.escrow_account
    )]
    pub escrow_account: Box<Account<'info, token::TokenAccount>>,
    #[account(
        mut,
        constraint = buyer_token_account.mint == trade.token_mint,
        constraint = buyer_token_account.owner == buyer.key()
    )]
    pub buyer_token_account: Box<Account<'info, token::TokenAccount>>,
    pub token_program: Program<'info, Token>,
    /// CHECK: Price oracle account from price program
    pub price_oracle: AccountInfo<'info>,
    /// CHECK: Price program
    pub price_program: AccountInfo<'info>,
    /// CHECK: Profile program
    pub profile_program: AccountInfo<'info>,
    /// CHECK: Buyer's profile account
    #[account(mut)]
    pub buyer_profile: AccountInfo<'info>,
    /// CHECK: Seller's profile account
    #[account(mut)]
    pub seller_profile: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CancelTrade<'info> {
    #[account(mut)]
    pub trade: Account<'info, Trade>,
    #[account(constraint = seller.key() == trade.seller)]
    pub seller: Signer<'info>,
    #[account(
        mut,
        constraint = escrow_account.key() == trade.escrow_account
    )]
    pub escrow_account: Box<Account<'info, token::TokenAccount>>,
    #[account(
        mut,
        constraint = seller_token_account.mint == trade.token_mint,
        constraint = seller_token_account.owner == seller.key()
    )]
    pub seller_token_account: Box<Account<'info, token::TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DisputeTrade<'info> {
    #[account(mut)]
    pub trade: Account<'info, Trade>,
    pub disputer: Signer<'info>,
}

#[account]
pub struct Trade {
    pub seller: Pubkey,
    pub buyer: Option<Pubkey>,
    pub amount: u64,
    pub price: u64,
    pub token_mint: Pubkey,
    pub escrow_account: Pubkey,
    pub status: TradeStatus,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum TradeStatus {
    Open,
    InProgress,
    Completed,
    Cancelled,
    Disputed,
}

#[error_code]
pub enum TradeError {
    #[msg("Invalid trade status for this operation")]
    InvalidTradeStatus,
    #[msg("Only buyer or seller can dispute a trade")]
    UnauthorizedDisputer,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum TradeInstruction {
    CreateTrade { amount: u64, price: u64 },
    CompleteTrade,
    CancelTrade,
    DisputeTrade,
}

impl TradeInstruction {
    pub fn serialize(&self) -> Vec<u8> {
        let mut data = Vec::new();
        AnchorSerialize::serialize(self, &mut data).expect("Failed to serialize trade instruction");
        data
    }
}

// Add this to the trade program module
pub fn create_trade_instruction(
    program_id: &Pubkey,
    accounts: &[AccountMeta],
    amount: u64,
    price: u64,
) -> Instruction {
    let data = TradeInstruction::CreateTrade { amount, price }.serialize();

    Instruction {
        program_id: *program_id,
        accounts: accounts.to_vec(),
        data,
    }
}
