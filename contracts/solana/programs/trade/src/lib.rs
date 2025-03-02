use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::rent::Rent;

use anchor_spl::token::{self, Token};

// Add imports for external programs
use price::program::Price;
use price::{self, PriceState};
use profile::program::Profile;
use profile::{self, Profile as ProfileAccount};

declare_id!("2ebQZghoJAExZ64eUuw5xq7GVycibtsyA2yPKgfNSYNj");

#[program]
pub mod trade {
    use super::*;

    pub fn create_trade(ctx: Context<CreateTrade>, amount: u64, price: u64) -> Result<()> {
        let trade = &mut ctx.accounts.trade;
        trade.maker = ctx.accounts.maker.key();
        trade.taker = ctx.accounts.taker.key();
        trade.amount = amount;
        trade.price = price;
        trade.token_mint = ctx.accounts.token_mint.key();
        trade.escrow_account = ctx.accounts.escrow_account.key();
        trade.status = TradeStatus::Created;
        trade.created_at = Clock::get()?.unix_timestamp;
        trade.updated_at = Clock::get()?.unix_timestamp;
        trade.bump = ctx.bumps.trade;

        msg!("Trade created successfully - requires escrow deposit");
        Ok(())
    }

    pub fn complete_trade(ctx: Context<CompleteTrade>) -> Result<()> {
        require!(
            ctx.accounts.trade.status == TradeStatus::EscrowDeposited,
            TradeError::InvalidTradeStatus
        );

        // Transfer tokens from escrow to taker
        let trade_account_info = ctx.accounts.trade.to_account_info();
        let maker_key = ctx.accounts.maker.key();
        let token_mint = ctx.accounts.trade.token_mint;
        let taker_key = ctx.accounts.taker.key();
        let amount = ctx.accounts.trade.amount;

        // Store the amount bytes in a variable to prevent temporary value dropped error
        let amount_bytes = amount.to_le_bytes();

        // Convert the bump to a byte array for seeds
        let bump = ctx.accounts.trade.bump;

        // Create seed arrays using Anchor's convenience macro
        let trade_pda_seed = [
            b"trade",
            taker_key.as_ref(),
            maker_key.as_ref(),
            token_mint.as_ref(),
            &amount_bytes[..],
            &[bump],
        ];
        let seeds = &[&trade_pda_seed[..]];
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.escrow_account.to_account_info(),
                to: ctx.accounts.taker_token_account.to_account_info(),
                authority: trade_account_info,
            },
            seeds,
        );

        token::transfer(transfer_ctx, amount)?;

        // Update profiles using CPI
        let taker_profile_ctx = CpiContext::new(
            ctx.accounts.profile_program.to_account_info(),
            profile::cpi::accounts::RecordTrade {
                profile: ctx.accounts.taker_profile.to_account_info(),
                owner: ctx.accounts.taker.to_account_info(),
                trade_program: ctx.accounts.trade.to_account_info(),
            },
        );
        profile::cpi::record_trade_completion(taker_profile_ctx)?;

        let maker_profile_ctx = CpiContext::new(
            ctx.accounts.profile_program.to_account_info(),
            profile::cpi::accounts::RecordTrade {
                profile: ctx.accounts.maker_profile.to_account_info(),
                owner: ctx.accounts.maker.to_account_info(),
                trade_program: ctx.accounts.trade.to_account_info(),
            },
        );
        profile::cpi::record_trade_completion(maker_profile_ctx)?;

        // Update trade status after all CPIs
        let trade = &mut ctx.accounts.trade;
        trade.status = TradeStatus::Completed;
        trade.updated_at = Clock::get()?.unix_timestamp;

        msg!("Trade completed successfully");
        Ok(())
    }

    pub fn cancel_trade(ctx: Context<CancelTrade>) -> Result<()> {
        // Verify trade status and store values we need
        let trade = &ctx.accounts.trade;
        require!(
            trade.status == TradeStatus::Created,
            TradeError::InvalidTradeStatus
        );
        // Require the signer is the taker or the maker
        require!(
            ctx.accounts.trader.key() == trade.taker || ctx.accounts.trader.key() == trade.maker,
            TradeError::UnauthorizedTrader
        );

        // Update trade status
        let trade = &mut ctx.accounts.trade;
        trade.status = TradeStatus::Cancelled;
        trade.updated_at = Clock::get()?.unix_timestamp;

        msg!("Trade cancelled successfully");
        Ok(())
    }

    pub fn dispute_trade(ctx: Context<DisputeTrade>) -> Result<()> {
        let trade = &mut ctx.accounts.trade;

        // Verify disputer is either taker or maker
        let disputer_key = ctx.accounts.disputer.key();
        require!(
            trade.maker == disputer_key || trade.taker == disputer_key,
            TradeError::UnauthorizedDisputer
        );

        require!(
            trade.status == TradeStatus::EscrowDeposited,
            TradeError::InvalidTradeStatus
        );

        trade.status = TradeStatus::Disputed;
        trade.updated_at = Clock::get()?.unix_timestamp;

        msg!("Trade disputed successfully");
        Ok(())
    }

    pub fn deposit_escrow(ctx: Context<DepositEscrow>, amount: u64) -> Result<()> {
        // Transfer tokens to escrow
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.depositor_token_account.to_account_info(),
                to: ctx.accounts.escrow_account.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        // Update trade info
        let trade = &mut ctx.accounts.trade;

        // Verify the depositor is the trade maker
        require!(
            trade.maker == ctx.accounts.depositor.key(),
            TradeError::UnauthorizedDepositor
        );

        // Verify the trade is in Created status
        require!(
            trade.status == TradeStatus::Created,
            TradeError::InvalidTradeStatus
        );

        // Update trade status to Open after deposit
        trade.status = TradeStatus::EscrowDeposited;
        trade.updated_at = Clock::get()?.unix_timestamp;

        msg!("Deposited {} tokens to escrow, trade is now open", amount);
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum TradeStatus {
    Created,
    EscrowDeposited,
    Completed,
    Cancelled,
    Disputed,
}

#[account]
pub struct Trade {
    pub maker: Pubkey,
    pub taker: Pubkey,
    pub amount: u64,
    pub price: u64,
    pub token_mint: Pubkey,
    pub escrow_account: Pubkey,
    pub status: TradeStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(amount: u64, price: u64)]
pub struct CreateTrade<'info> {
    #[account(
        init,
        payer = taker,
        space = 8 + // discriminator
            32 + // maker
            32 + // taker
            8 + // amount
            8 + // price
            32 + // token_mint
            32 + // escrow_account
            2 + // status (1 for enum discriminator, 1 for variant)
            8 + // created_at
            8 + // updated_at
            1 + // bump
            64, // padding for future updates
        seeds = [b"trade", taker.key().as_ref(), maker.key().as_ref(), 
            token_mint.key().as_ref(), amount.to_le_bytes().as_ref()],
        bump
    )]
    pub trade: Account<'info, Trade>,
    /// CHECK: trade is initialized by the taker
    pub maker: AccountInfo<'info>,
    #[account(mut)]
    pub taker: Signer<'info>,
    pub token_mint: Account<'info, token::Mint>,
    #[account(mut)]
    pub maker_token_account: Account<'info, token::TokenAccount>,
    #[account(
        init,
        payer = taker,
        token::mint = token_mint,
        token::authority = trade,
    )]
    pub escrow_account: Account<'info, token::TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
#[derive(Accounts)]
pub struct CompleteTrade<'info> {
    #[account(
        mut,
        seeds = [b"trade", trade.taker.key().as_ref(), trade.maker.key().as_ref(), trade.token_mint.as_ref(), trade.amount.to_le_bytes().as_ref()],
        bump,
    )]
    pub trade: Account<'info, Trade>,
    #[account(constraint = trader.key() == trade.maker || trader.key() == trade.taker)]
    pub trader: Signer<'info>,
    /// CHECK: trade.taker is validated in the trade program
    #[account(constraint = taker.key() == trade.taker)]
    pub taker: AccountInfo<'info>,
    /// CHECK: trade.maker is validated in the trade program
    #[account(constraint = maker.key() == trade.maker)]
    pub maker: AccountInfo<'info>,
    #[account(
        mut,
        constraint = escrow_account.key() == trade.escrow_account
    )]
    pub escrow_account: Account<'info, token::TokenAccount>,
    #[account(
        mut,
        constraint = taker_token_account.mint == trade.token_mint,
        constraint = taker_token_account.owner == taker.key()
    )]
    pub taker_token_account: Account<'info, token::TokenAccount>,
    pub token_program: Program<'info, Token>,

    // Price verification accounts with proper constraints
    pub price_oracle: Account<'info, PriceState>,
    pub price_program: Program<'info, Price>,

    // Profile accounts with proper constraints
    #[account(
        mut,
        seeds = [b"profile", taker.key().as_ref()],
        bump,
        seeds::program = profile_program.key()
    )]
    pub taker_profile: Account<'info, ProfileAccount>,
    #[account(
        mut,
        seeds = [b"profile", maker.key().as_ref()],
        bump,
        seeds::program = profile_program.key()
    )]
    pub maker_profile: Account<'info, ProfileAccount>,
    pub profile_program: Program<'info, Profile>,
}

#[derive(Accounts)]
pub struct CancelTrade<'info> {
    #[account(
        mut,
        seeds = [b"trade", trade.taker.as_ref(), trade.maker.as_ref(), 
                trade.token_mint.as_ref(), trade.amount.to_le_bytes().as_ref()],
        bump = trade.bump,
    )]
    pub trade: Account<'info, Trade>,
    #[account(constraint = trader.key() == trade.taker || trader.key() == trade.maker)]
    pub trader: Signer<'info>,
}

#[derive(Accounts)]
pub struct DisputeTrade<'info> {
    #[account(mut)]
    pub trade: Account<'info, Trade>,
    pub disputer: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositEscrow<'info> {
    #[account(mut)]
    pub trade: Account<'info, Trade>,

    #[account(
        mut,
        constraint = escrow_account.key() == trade.escrow_account
    )]
    pub escrow_account: Account<'info, token::TokenAccount>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
        constraint = depositor_token_account.mint == trade.token_mint,
        constraint = depositor.key() == trade.maker || depositor.key() == trade.taker
    )]
    pub depositor_token_account: Account<'info, token::TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum TradeError {
    #[msg("Invalid trade status for this operation")]
    InvalidTradeStatus,
    #[msg("Unauthorized disputer")]
    UnauthorizedDisputer,
    #[msg("Unauthorized to deposit to this trade's escrow")]
    UnauthorizedDepositor,
    #[msg("Unauthorized trader")]
    UnauthorizedTrader,
}
