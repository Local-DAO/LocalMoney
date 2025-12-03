use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct UpdateContact<'info> {
    #[account(
        mut,
        seeds = [b"profile", user.key().as_ref()],
        bump = profile.bump,
        has_one = owner @ ProfileError::Unauthorized
    )]
    pub profile: Account<'info, UserProfile>,

    pub user: Signer<'info>,

    /// CHECK: This is the owner field from the profile account
    pub owner: AccountInfo<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateContactParams {
    pub contact_info: Option<String>,
    pub encryption_key: Option<String>,
}

pub fn handler(ctx: Context<UpdateContact>, params: UpdateContactParams) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    let clock = Clock::get()?;

    // Update contact info if provided
    if let Some(contact_info) = params.contact_info {
        require!(
            contact_info.len() <= UserProfile::MAX_CONTACT_INFO_LEN,
            ProfileError::ContactInfoTooLong
        );
        profile.contact_info = contact_info;
    }

    // Update encryption key if provided
    if let Some(encryption_key) = params.encryption_key {
        require!(
            encryption_key.len() <= UserProfile::MAX_ENCRYPTION_KEY_LEN,
            ProfileError::EncryptionKeyTooLong
        );
        profile.encryption_key = encryption_key;
    }

    // Update timestamp
    profile.updated_at = clock.unix_timestamp;

    emit!(ContactUpdated {
        user: profile.owner,
        profile_address: ctx.accounts.profile.key(),
    });

    Ok(())
}

#[event]
pub struct ContactUpdated {
    pub user: Pubkey,
    pub profile_address: Pubkey,
}
