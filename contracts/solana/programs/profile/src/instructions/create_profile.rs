use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(
        init,
        payer = user,
        space = UserProfile::LEN,
        seeds = [b"profile", user.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateProfileParams {
    pub contact_info: String,
    pub encryption_key: String,
}

pub fn handler(ctx: Context<CreateProfile>, params: CreateProfileParams) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    let clock = Clock::get()?;

    // Validate lengths
    require!(
        params.contact_info.len() <= UserProfile::MAX_CONTACT_INFO_LEN,
        ProfileError::ContactInfoTooLong
    );
    require!(
        params.encryption_key.len() <= UserProfile::MAX_ENCRYPTION_KEY_LEN,
        ProfileError::EncryptionKeyTooLong
    );

    // Set PDA bump
    profile.bump = ctx.bumps.profile;

    // Set owner
    profile.owner = ctx.accounts.user.key();

    // Set contact information
    profile.contact_info = params.contact_info;
    profile.encryption_key = params.encryption_key;

    // Initialize statistics to zero
    profile.total_trades = 0;
    profile.completed_trades = 0;
    profile.disputed_trades = 0;
    profile.total_buy_volume = 0;
    profile.total_sell_volume = 0;

    // Initialize counters
    profile.active_offers = 0;
    profile.active_trades = 0;

    // Initialize reputation
    profile.reputation_score = 0;

    // Set timestamps
    profile.created_at = clock.unix_timestamp;
    profile.updated_at = clock.unix_timestamp;

    emit!(ProfileCreated {
        user: profile.owner,
        profile_address: ctx.accounts.profile.key(),
    });

    Ok(())
}

#[event]
pub struct ProfileCreated {
    pub user: Pubkey,
    pub profile_address: Pubkey,
}
