use anchor_lang::prelude::*;
use solana_program::msg;

declare_id!("CfC3efU4b5ppjSBYJwiKrZtz3hmzBBgSM2s6RCFN4nYA");

#[program]
pub mod profile {
    use super::*;

    pub fn create_profile(ctx: Context<CreateProfile>, username: String) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        profile.owner = ctx.accounts.owner.key();
        profile.username = username;
        profile.reputation_score = 0;
        profile.trades_completed = 0;
        profile.trades_disputed = 0;
        profile.is_verified = false;
        profile.created_at = Clock::get()?.unix_timestamp;
        profile.updated_at = Clock::get()?.unix_timestamp;

        msg!("Profile created successfully");
        Ok(())
    }

    pub fn update_profile(ctx: Context<UpdateProfile>, username: Option<String>) -> Result<()> {
        let profile = &mut ctx.accounts.profile;

        if let Some(new_username) = username {
            profile.username = new_username;
        }

        profile.updated_at = Clock::get()?.unix_timestamp;
        msg!("Profile updated successfully");
        Ok(())
    }

    pub fn update_reputation(ctx: Context<UpdateReputation>, score_delta: i32) -> Result<()> {
        let profile = &mut ctx.accounts.profile;

        // Update reputation score, ensuring it doesn't underflow
        if score_delta < 0 && profile.reputation_score < score_delta.abs() as u32 {
            profile.reputation_score = 0;
        } else if score_delta < 0 {
            profile.reputation_score -= score_delta.abs() as u32;
        } else {
            profile.reputation_score += score_delta as u32;
        }

        profile.updated_at = Clock::get()?.unix_timestamp;
        msg!("Reputation updated successfully");
        Ok(())
    }

    pub fn verify_profile(ctx: Context<VerifyProfile>) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        profile.is_verified = true;
        profile.updated_at = Clock::get()?.unix_timestamp;

        msg!("Profile verified successfully");
        Ok(())
    }

    pub fn record_trade_completion(ctx: Context<RecordTrade>) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        profile.trades_completed += 1;
        profile.updated_at = Clock::get()?.unix_timestamp;

        msg!("Trade completion recorded successfully");
        Ok(())
    }

    pub fn record_trade_dispute(ctx: Context<RecordTrade>) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        profile.trades_disputed += 1;
        profile.updated_at = Clock::get()?.unix_timestamp;

        msg!("Trade dispute recorded successfully");
        Ok(())
    }

    pub fn verify_trade_completion(ctx: Context<VerifyTradeCompletion>) -> Result<()> {
        // Verify trade completion using common module
        common::verify_trade_completion(&ctx.accounts.trade_program, &ctx.accounts.trade)?;

        // Update profile statistics
        let profile = &mut ctx.accounts.profile;
        profile.trades_completed += 1;
        profile.reputation_score = profile.reputation_score.saturating_add(1);
        profile.updated_at = Clock::get()?.unix_timestamp;

        msg!("Trade verification and profile update completed successfully");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(init, payer = owner, space = 8 + std::mem::size_of::<Profile>())]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(mut, has_one = owner)]
    pub profile: Account<'info, Profile>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateReputation<'info> {
    #[account(mut)]
    pub profile: Account<'info, Profile>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct VerifyProfile<'info> {
    #[account(mut)]
    pub profile: Account<'info, Profile>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RecordTrade<'info> {
    #[account(mut)]
    pub profile: Account<'info, Profile>,
    /// CHECK: Trade program account, validated in program logic
    pub trade_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct VerifyTradeCompletion<'info> {
    #[account(mut)]
    pub profile: Account<'info, Profile>,
    /// CHECK: Trade account to verify
    pub trade: AccountInfo<'info>,
    /// CHECK: Trade program
    pub trade_program: AccountInfo<'info>,
}

#[account]
pub struct Profile {
    pub owner: Pubkey,
    pub username: String,
    pub reputation_score: u32,
    pub trades_completed: u32,
    pub trades_disputed: u32,
    pub is_verified: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[error_code]
pub enum ProfileError {
    #[msg("Username is too long")]
    UsernameTooLong,
    #[msg("Invalid authority for this operation")]
    InvalidAuthority,
    #[msg("Invalid trade program")]
    InvalidTradeProgram,
}

#[cfg(test)]
mod tests {

    // Add tests here
}
