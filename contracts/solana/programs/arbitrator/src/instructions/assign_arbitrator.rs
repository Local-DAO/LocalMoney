use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct AssignArbitrator<'info> {
    #[account(
        init,
        payer = payer,
        space = Dispute::LEN,
        seeds = [b"dispute", trade_id.to_le_bytes().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        seeds = [
            b"arbitrator",
            arbitrator.pubkey.as_ref(),
            arbitrator.fiat_currency.as_ref()
        ],
        bump = arbitrator.bump
    )]
    pub arbitrator: Account<'info, Arbitrator>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// The program claiming to be the caller (must match Hub's trade_program)
    /// CHECK: Verified against hub_config.trade_program
    pub caller_program: AccountInfo<'info>,

    /// Hub config for authorization - verifies caller is Trade program
    #[account(
        seeds = [b"hub_config"],
        bump = hub_config.bump,
        seeds::program = hub::ID,
    )]
    pub hub_config: Account<'info, hub::state::HubConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AssignArbitratorParams {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub fiat_currency: [u8; 3],
}

pub fn handler(
    ctx: Context<AssignArbitrator>,
    trade_id: u64,
    params: AssignArbitratorParams,
) -> Result<()> {
    let dispute = &mut ctx.accounts.dispute;
    let arbitrator = &mut ctx.accounts.arbitrator;
    let hub_config = &ctx.accounts.hub_config;
    let clock = Clock::get()?;

    // Verify caller_program is the authorized Trade program from Hub config
    require!(
        ctx.accounts.caller_program.key() == hub_config.trade_program,
        ArbitratorError::Unauthorized
    );

    // Verify arbitrator is active
    require!(arbitrator.is_active, ArbitratorError::NotActive);

    // Verify arbitrator currency matches trade currency
    require!(
        arbitrator.fiat_currency == params.fiat_currency,
        ArbitratorError::InvalidFiatCurrency
    );

    // Check for conflict of interest
    require!(
        arbitrator.pubkey != params.buyer && arbitrator.pubkey != params.seller,
        ArbitratorError::ConflictOfInterest
    );

    // Initialize dispute
    dispute.bump = ctx.bumps.dispute;
    dispute.trade_id = trade_id;
    dispute.buyer = params.buyer;
    dispute.seller = params.seller;
    dispute.arbitrator = arbitrator.pubkey;
    dispute.buyer_evidence = None;
    dispute.seller_evidence = None;
    dispute.resolution = None;
    dispute.created_at = clock.unix_timestamp;
    dispute.resolved_at = None;

    // Increment arbitrator's dispute count
    arbitrator.increment_dispute();

    emit!(ArbitratorAssigned {
        trade_id,
        arbitrator: arbitrator.pubkey,
        buyer: params.buyer,
        seller: params.seller,
    });

    Ok(())
}

#[event]
pub struct ArbitratorAssigned {
    pub trade_id: u64,
    pub arbitrator: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
}
