use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::rent::Rent;

use anchor_spl::token::{self, Token};

// Add imports for external programs
use price::program::Price;
use price::{self, PriceState};
use profile::program::Profile;
use profile::{self, Profile as ProfileAccount};

declare_id!("6VXLHER2xPndomqaXWPPUH3733HVmcRMUuU5w9eNVqbZ");

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
        trade.bump = ctx.bumps.trade;

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
        require!(
            ctx.accounts.trade.status == TradeStatus::InProgress,
            TradeError::InvalidTradeStatus
        );

        // Verify price using CPI
        let cpi_program = ctx.accounts.price_program.to_account_info();
        let cpi_accounts = price::cpi::accounts::VerifyPrice {
            oracle: ctx.accounts.price_oracle.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        // Call verify_price_for_trade with the correct parameters
        price::cpi::verify_price_for_trade(
            cpi_ctx,
            ctx.accounts.trade.price,
            "USD".to_string(),
            100, // 1% tolerance
        )?;

        // Transfer tokens from escrow to buyer
        let trade_account_info = ctx.accounts.trade.to_account_info();
        let seller_key = ctx.accounts.seller.key();
        let token_mint = ctx.accounts.trade.token_mint;
        let seeds = &[
            b"trade",
            seller_key.as_ref(),
            token_mint.as_ref(),
            &[ctx.accounts.trade.bump],
        ];
        let signer = &[&seeds[..]];
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.escrow_account.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: trade_account_info,
            },
            signer,
        );
        token::transfer(transfer_ctx, ctx.accounts.trade.amount)?;

        // Update profiles using CPI
        let buyer_profile_ctx = CpiContext::new(
            ctx.accounts.profile_program.to_account_info(),
            profile::cpi::accounts::RecordTrade {
                profile: ctx.accounts.buyer_profile.to_account_info(),
                owner: ctx.accounts.buyer.to_account_info(),
                trade_program: ctx.accounts.trade.to_account_info(),
            },
        );
        profile::cpi::record_trade_completion(buyer_profile_ctx)?;

        let seller_profile_ctx = CpiContext::new(
            ctx.accounts.profile_program.to_account_info(),
            profile::cpi::accounts::RecordTrade {
                profile: ctx.accounts.seller_profile.to_account_info(),
                owner: ctx.accounts.seller.to_account_info(),
                trade_program: ctx.accounts.trade.to_account_info(),
            },
        );
        profile::cpi::record_trade_completion(seller_profile_ctx)?;

        // Update trade status after all CPIs
        let trade = &mut ctx.accounts.trade;
        trade.status = TradeStatus::Completed;
        trade.updated_at = Clock::get()?.unix_timestamp;

        msg!("Trade completed successfully");
        Ok(())
    }

    pub fn cancel_trade(ctx: Context<CancelTrade>) -> Result<()> {
        // Verify trade status and store values we need
        let bump;
        let token_mint;
        let amount;
        {
            let trade = &ctx.accounts.trade;
            require!(
                trade.status == TradeStatus::Open,
                TradeError::InvalidTradeStatus
            );
            bump = trade.bump;
            token_mint = trade.token_mint;
            amount = trade.amount;
        }

        let seller_key = ctx.accounts.seller.key();
        let trade_account_info = ctx.accounts.trade.to_account_info();

        // Return tokens from escrow to seller
        let seeds = &[b"trade", seller_key.as_ref(), token_mint.as_ref(), &[bump]];
        let signer = &[&seeds[..]];
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.escrow_account.to_account_info(),
                to: ctx.accounts.seller_token_account.to_account_info(),
                authority: trade_account_info,
            },
            signer,
        );
        token::transfer(transfer_ctx, amount)?;

        // Update trade status
        let trade = &mut ctx.accounts.trade;
        trade.status = TradeStatus::Cancelled;
        trade.updated_at = Clock::get()?.unix_timestamp;

        msg!("Trade cancelled successfully");
        Ok(())
    }

    pub fn dispute_trade(ctx: Context<DisputeTrade>) -> Result<()> {
        let trade = &mut ctx.accounts.trade;

        // Verify disputer is either buyer or seller
        let disputer_key = ctx.accounts.disputer.key();
        require!(
            trade.seller == disputer_key || trade.buyer == Some(disputer_key),
            TradeError::UnauthorizedDisputer
        );

        require!(
            trade.status == TradeStatus::InProgress,
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

        // Update trade info if necessary
        let trade = &mut ctx.accounts.trade;
        trade.updated_at = Clock::get()?.unix_timestamp;

        msg!("Deposited {} tokens to escrow", amount);
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum TradeStatus {
    Open,
    InProgress,
    Completed,
    Cancelled,
    Disputed,
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
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(amount: u64, price: u64)]
pub struct CreateTrade<'info> {
    #[account(
        init,
        payer = seller,
        space = 8 + // discriminator
            32 + // seller
            (1 + 32) + // buyer (Option<Pubkey>) - 1 for the tag, 32 for the pubkey
            8 + // amount
            8 + // price
            32 + // token_mint
            32 + // escrow_account
            2 + // status (1 for enum discriminator, 1 for variant)
            8 + // created_at
            8 + // updated_at
            1 + // bump
            64, // padding for future updates
        seeds = [b"trade", seller.key().as_ref(), token_mint.key().as_ref()],
        bump
    )]
    pub trade: Account<'info, Trade>,
    #[account(mut)]
    pub seller: Signer<'info>,
    pub token_mint: Account<'info, token::Mint>,
    #[account(mut)]
    pub seller_token_account: Account<'info, token::TokenAccount>,
    #[account(
        init,
        payer = seller,
        token::mint = token_mint,
        token::authority = trade,
    )]
    pub escrow_account: Account<'info, token::TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AcceptTrade<'info> {
    #[account(mut)]
    pub trade: Account<'info, Trade>,
    pub buyer: Signer<'info>,
}

#[derive(Accounts)]
pub struct CompleteTrade<'info> {
    #[account(
        mut,
        seeds = [b"trade", seller.key().as_ref(), trade.token_mint.as_ref()],
        bump,
    )]
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

    // Price verification accounts with proper constraints
    pub price_oracle: Account<'info, PriceState>,
    pub price_program: Program<'info, Price>,

    // Profile accounts with proper constraints
    #[account(
        mut,
        seeds = [b"profile", buyer.key().as_ref()],
        bump,
        seeds::program = profile_program.key()
    )]
    pub buyer_profile: Account<'info, ProfileAccount>,
    #[account(
        mut,
        seeds = [b"profile", seller.key().as_ref()],
        bump,
        seeds::program = profile_program.key()
    )]
    pub seller_profile: Account<'info, ProfileAccount>,
    pub profile_program: Program<'info, Profile>,
}

#[derive(Accounts)]
pub struct CancelTrade<'info> {
    #[account(
        mut,
        seeds = [b"trade", seller.key().as_ref(), trade.token_mint.as_ref()],
        bump = trade.bump,
    )]
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
        constraint = depositor_token_account.owner == depositor.key()
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
}
