use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5");

#[program]
pub mod profile {
    use super::*;

    /// Create a new user profile
    ///
    /// Initializes a profile for a user with encrypted contact information.
    /// Each user can only have one profile.
    ///
    /// # Arguments
    ///
    /// * `ctx` - CreateProfile context with profile PDA and user
    /// * `params` - Contact information and encryption key
    ///
    /// # Access Control
    ///
    /// Can only be called once per user (PDA prevents duplicates).
    pub fn create_profile(ctx: Context<CreateProfile>, params: CreateProfileParams) -> Result<()> {
        instructions::create_profile::handler(ctx, params)
    }

    /// Update contact information
    ///
    /// Allows the profile owner to update their encrypted contact info or encryption key.
    ///
    /// # Arguments
    ///
    /// * `ctx` - UpdateContact context with profile PDA and owner
    /// * `params` - Updated contact information (optional fields)
    ///
    /// # Access Control
    ///
    /// Only the profile owner can update their contact information.
    pub fn update_contact(ctx: Context<UpdateContact>, params: UpdateContactParams) -> Result<()> {
        instructions::update_contact::handler(ctx, params)
    }

    /// Update trade statistics
    ///
    /// Called by the Trade program to update user's trading statistics after
    /// a trade completes or is disputed.
    ///
    /// # Arguments
    ///
    /// * `ctx` - UpdateTradeStats context with profile, caller program, and hub_config
    /// * `params` - Trade statistics to update
    ///
    /// # Access Control
    ///
    /// Only the Trade program (verified via Hub config) can call this instruction.
    pub fn update_trade_stats(
        ctx: Context<UpdateTradeStats>,
        params: UpdateTradeStatsParams,
    ) -> Result<()> {
        instructions::update_trade_stats::handler(ctx, params)
    }

    /// Update active offers/trades counters
    ///
    /// Called by the Offer or Trade programs to increment/decrement counters
    /// when offers or trades are created/completed.
    ///
    /// # Arguments
    ///
    /// * `ctx` - UpdateActiveCounters context with profile, caller program, and hub_config
    /// * `params` - Counter type and operation (increment/decrement)
    ///
    /// # Access Control
    ///
    /// Only the Trade or Offer programs (verified via Hub config) can call this instruction.
    pub fn update_active_counters(
        ctx: Context<UpdateActiveCounters>,
        params: UpdateActiveCountersParams,
    ) -> Result<()> {
        instructions::update_active_counters::handler(ctx, params)
    }
}
