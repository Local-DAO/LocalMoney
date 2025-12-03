use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use hub::state::HubConfig;
use escrow::cpi::accounts::FreezeEscrow as EscrowFreezeAccounts;
use escrow::cpi::freeze_escrow as escrow_freeze_cpi;
use escrow::program::Escrow;
use escrow::state::EscrowVault;
use arbitrator::cpi::accounts::AssignArbitrator as ArbitratorAssignAccounts;
use arbitrator::cpi::assign_arbitrator as arbitrator_assign_cpi;
use arbitrator::program::Arbitrator as ArbitratorProgram;
use arbitrator::state::{Arbitrator, Dispute};
use arbitrator::instructions::AssignArbitratorParams;

#[derive(Accounts)]
pub struct InitiateDispute<'info> {
    #[account(
        mut,
        seeds = [b"trade", trade.id.to_le_bytes().as_ref()],
        bump = trade.bump,
    )]
    pub trade: Account<'info, Trade>,

    /// The party initiating dispute (buyer or seller)
    #[account(mut)]
    pub initiator: Signer<'info>,

    /// Escrow vault (to freeze)
    #[account(
        mut,
        seeds = [b"escrow_vault", trade.id.to_le_bytes().as_ref()],
        bump = escrow_vault.bump,
        seeds::program = escrow::ID
    )]
    pub escrow_vault: Account<'info, EscrowVault>,

    /// Dispute PDA (to be created)
    /// CHECK: Will be created by arbitrator program via CPI
    #[account(mut)]
    pub dispute: UncheckedAccount<'info>,

    /// Arbitrator for this fiat currency
    #[account(
        mut,
        seeds = [
            b"arbitrator",
            arbitrator.pubkey.as_ref(),
            trade.fiat_currency.as_ref()
        ],
        bump = arbitrator.bump,
        seeds::program = arbitrator::ID
    )]
    pub arbitrator: Account<'info, Arbitrator>,

    /// Hub config for CPI authorization
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// Escrow program for CPI
    pub escrow_program: Program<'info, Escrow>,

    /// Arbitrator program for CPI
    pub arbitrator_program: Program<'info, ArbitratorProgram>,

    /// The Trade program account for CPI caller identification
    /// CHECK: address is verified to be this program's ID
    #[account(address = crate::ID)]
    pub trade_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitiateDispute>) -> Result<()> {
    let trade = &mut ctx.accounts.trade;
    let clock = Clock::get()?;

    // Check trade is in EscrowFunded or FiatDeposited state
    require!(
        trade.state == TradeState::EscrowFunded || trade.state == TradeState::FiatDeposited,
        TradeError::InvalidState
    );

    // Check not already disputed
    require!(
        !trade.is_disputed(),
        TradeError::AlreadyDisputed
    );

    // Verify initiator is buyer or seller
    require!(
        ctx.accounts.initiator.key() == trade.buyer || ctx.accounts.initiator.key() == trade.seller,
        TradeError::Unauthorized
    );

    // Call Arbitrator program via CPI to assign arbitrator and create dispute
    let arbitrator_cpi_program = ctx.accounts.arbitrator_program.to_account_info();
    let arbitrator_cpi_accounts = ArbitratorAssignAccounts {
        dispute: ctx.accounts.dispute.to_account_info(),
        arbitrator: ctx.accounts.arbitrator.to_account_info(),
        payer: ctx.accounts.initiator.to_account_info(),
        // Pass this program (Trade) as the caller for authorization verification
        caller_program: ctx.accounts.trade_program.to_account_info(),
        // Hub config for authorization verification
        hub_config: ctx.accounts.hub_config.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };
    let arbitrator_cpi_ctx = CpiContext::new(arbitrator_cpi_program, arbitrator_cpi_accounts);

    arbitrator_assign_cpi(
        arbitrator_cpi_ctx,
        trade.id,
        AssignArbitratorParams {
            buyer: trade.buyer,
            seller: trade.seller,
            fiat_currency: trade.fiat_currency,
        },
    )?;

    // Set the arbitrator on the trade
    trade.arbitrator = Some(ctx.accounts.arbitrator.pubkey);

    // Call Escrow program via CPI to freeze escrow
    let escrow_cpi_program = ctx.accounts.escrow_program.to_account_info();
    let escrow_cpi_accounts = EscrowFreezeAccounts {
        vault: ctx.accounts.escrow_vault.to_account_info(),
        // Pass this program (Trade) as the caller for authorization verification
        caller_program: ctx.accounts.trade_program.to_account_info(),
        // Hub config for authorization verification
        hub_config: ctx.accounts.hub_config.to_account_info(),
    };
    let escrow_cpi_ctx = CpiContext::new(escrow_cpi_program, escrow_cpi_accounts);

    escrow_freeze_cpi(escrow_cpi_ctx)?;

    // Set dispute timestamp
    trade.dispute_initiated_at = Some(clock.unix_timestamp);

    // Transition state
    trade.transition_to(TradeState::Disputed)?;

    // Update timestamp
    trade.updated_at = clock.unix_timestamp;

    emit!(DisputeInitiated {
        trade_id: trade.id,
        initiator: ctx.accounts.initiator.key(),
        arbitrator: trade.arbitrator,
    });

    Ok(())
}

#[event]
pub struct DisputeInitiated {
    pub trade_id: u64,
    pub initiator: Pubkey,
    pub arbitrator: Option<Pubkey>,
}
