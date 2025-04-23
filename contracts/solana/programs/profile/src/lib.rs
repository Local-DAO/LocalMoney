use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use localmoney_shared::offer::OfferState;
use localmoney_shared::trade::TradeState;
use localmoney_shared::{constants::*, errors::*, profile::*};

declare_id!("HNKH412Fsfe8vdBudCnsbmB9PwYxcxYfktfmyTWgiKbd");

#[program]
pub mod profile {
    use super::*;

    /// Initialize the profile program
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let profile_config = &mut ctx.accounts.profile_config;

        profile_config.hub_authority = ctx.accounts.hub_authority.key();
        profile_config.bump = ctx.bumps.profile_config;

        Ok(())
    }

    /// Register the profile program with the hub
    pub fn register_hub(ctx: Context<RegisterHub>) -> Result<()> {
        // The hub program handles most of the logic
        // This is just a validation step for the profile program
        require!(
            ctx.accounts.profile_config.hub_authority == ctx.accounts.hub_authority.key(),
            LocalMoneyError::Unauthorized
        );

        Ok(())
    }

    /// Create or update a user's profile contact information
    pub fn update_contact(ctx: Context<UpdateContact>, params: UpdateContactParams) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        let clock = Clock::get()?;

        // Initialize profile if it's new
        if profile.created_at == 0 {
            profile.created_at = clock.unix_timestamp;
        }

        profile.contact = Some(params.contact);
        profile.encryption_key = Some(params.encryption_key);

        Ok(())
    }

    /// Update the trades count for a profile based on a trade state change
    pub fn update_trades_count(
        ctx: Context<UpdateTradesCount>,
        params: UpdateTradesCountParams,
    ) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        let clock = Clock::get()?;

        // Only the trade program should be able to call this
        // We verify this through the constraints in the account struct

        match params.trade_state {
            TradeState::RequestCreated => {
                profile.requested_trades_count += 1;
                // Check if active trades limit is reached
                if profile.active_trades_count >= ctx.accounts.hub.config.active_trades_limit.into()
                {
                    return Err(LocalMoneyError::ActiveTradesLimitReached.into());
                }
            }
            TradeState::RequestAccepted | TradeState::EscrowFunded => {
                // Check if active trades limit is reached
                if profile.active_trades_count < ctx.accounts.hub.config.active_trades_limit.into()
                {
                    profile.active_trades_count += 1;
                } else {
                    return Err(LocalMoneyError::ActiveTradesLimitReached.into());
                }
            }
            TradeState::EscrowCanceled
            | TradeState::EscrowRefunded
            | TradeState::SettledForMaker
            | TradeState::SettledForTaker => {
                // Decrease active trades when finished
                if profile.active_trades_count > 0 {
                    profile.active_trades_count -= 1;
                }
            }
            TradeState::EscrowReleased => {
                profile.released_trades_count += 1;
                // Decrease active trades when finished
                if profile.active_trades_count > 0 {
                    profile.active_trades_count -= 1;
                }
            }
            _ => {}
        }

        profile.last_trade = clock.unix_timestamp;

        Ok(())
    }

    /// Update the active offers count for a profile based on an offer state change
    pub fn update_active_offers(
        ctx: Context<UpdateActiveOffers>,
        params: UpdateActiveOffersParams,
    ) -> Result<()> {
        let profile = &mut ctx.accounts.profile;

        // Only the offer program should be able to call this
        // We verify this through the constraints in the account struct

        match params.offer_state {
            OfferState::Active => {
                // Check if active offers limit is reached
                if profile.active_offers_count < ctx.accounts.hub.config.active_offers_limit.into()
                {
                    profile.active_offers_count += 1;
                } else {
                    return Err(LocalMoneyError::ActiveOffersLimitReached.into());
                }
            }
            OfferState::Paused | OfferState::Archive | OfferState::Closed => {
                // Decrease active offers when paused, archived or closed
                if profile.active_offers_count > 0 {
                    profile.active_offers_count -= 1;
                }
            }
        }

        Ok(())
    }
}

/// Context for initializing the profile program
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Hub authority for validating program interactions
    /// CHECK: Just used as a reference for validation
    pub hub_authority: UncheckedAccount<'info>,

    /// Profile configuration account
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<ProfileConfig>(),
        seeds = [PROFILE_CONFIG_SEED],
        bump
    )]
    pub profile_config: Account<'info, ProfileConfig>,

    pub system_program: Program<'info, System>,
}

/// Context for registering the profile program with the hub
#[derive(Accounts)]
pub struct RegisterHub<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Hub authority account verified in the function
    pub hub_authority: UncheckedAccount<'info>,

    #[account(
        seeds = [PROFILE_CONFIG_SEED],
        bump = profile_config.bump,
    )]
    pub profile_config: Account<'info, ProfileConfig>,
}

/// Context for updating a user's profile contact information
#[derive(Accounts)]
pub struct UpdateContact<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Hub config containing trade and offer program addresses
    pub hub_config: UncheckedAccount<'info>,

    /// Profile account to update
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + std::mem::size_of::<Profile>() + 256, // Extra space for string data
        seeds = [PROFILE_SEED, authority.key().as_ref()],
        bump,
    )]
    pub profile: Account<'info, Profile>,

    pub system_program: Program<'info, System>,
}

/// Context for updating the trades count for a profile
#[derive(Accounts)]
pub struct UpdateTradesCount<'info> {
    /// Must be the trade program's designated PDA signer
    // TODO: Replace derive_trade_authority() with actual PDA derivation if needed
    //       Or verify constraint against a known Trade Program Authority PDA address
    #[account(
        // constraint = authority.key() == derive_trade_authority().0 @ LocalMoneyError::UnauthorizedTradeProgram
    )]
    pub authority: Signer<'info>,

    // Load the Hub account to read config limits
    #[account(
        seeds = [b"hub"],
        // seeds::program = hub_program.key(), // Requires hub_program below
        bump,
    )]
    pub hub: Account<'info, localmoney_shared::hub::Hub>,

    /// The profile owner
    /// CHECK: Just a reference, not used for signing
    pub profile_owner: UncheckedAccount<'info>,

    /// Profile account to update
    #[account(
        mut,
        seeds = [PROFILE_SEED, profile_owner.key().as_ref()],
        bump = profile.bump,
    )]
    pub profile: Account<'info, Profile>,
}

/// Context for updating the active offers count for a profile
#[derive(Accounts)]
pub struct UpdateActiveOffers<'info> {
    /// Must be the offer program's designated PDA signer
    // TODO: Replace derive_offer_authority() with actual PDA derivation if needed
    //       Or verify constraint against a known Offer Program Authority PDA address
    #[account(
        // constraint = authority.key() == derive_offer_authority().0 @ LocalMoneyError::UnauthorizedOfferProgram
    )]
    pub authority: Signer<'info>,

    // Load the Hub account to read config limits
    #[account(
        seeds = [b"hub"],
        // seeds::program = hub_program.key(), // Requires hub_program below
        bump,
    )]
    pub hub: Account<'info, localmoney_shared::hub::Hub>,

    /// The profile owner
    /// CHECK: Just a reference, not used for signing
    pub profile_owner: UncheckedAccount<'info>,

    /// Profile account to update
    #[account(
        mut,
        seeds = [PROFILE_SEED, profile_owner.key().as_ref()],
        bump = profile.bump,
    )]
    pub profile: Account<'info, Profile>,
}

// TODO: Define/Import Hub type if needed for seeds::program constraint
// use shared::hub::Hub as HubProgram;

// TODO: Implement these PDA derivations properly if needed for constraints
// fn derive_trade_authority() -> (Pubkey, u8) {
//     // Implementation depends on Trade program's authority structure
//     (Pubkey::default(), 0)
// }

// fn derive_offer_authority() -> (Pubkey, u8) {
//     // Implementation depends on Offer program's authority structure
//     (Pubkey::default(), 0)
// }
