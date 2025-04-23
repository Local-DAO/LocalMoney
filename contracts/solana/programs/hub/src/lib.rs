use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, CreateAccount};
use anchor_lang::solana_program::rent::Rent;
use localmoney_shared::{constants::*, errors::LocalMoneyError, hub::*};

declare_id!("3dF7ebo6DErpveMLxGAg6KTkTanGYLHmVXvqTWkqhpmL");

#[program]
pub mod hub {
    use super::*;

    // Initialize the hub program
    pub fn initialize(ctx: Context<Initialize>, config: HubConfig) -> Result<()> {
        // Validate configuration first
        validate_config(&config)?;
        
        // Debugging logs
        msg!("Initializing hub with params:");
        msg!("Hub address: {}", ctx.accounts.hub.key());
        msg!("Hub bump: {}", ctx.bumps.hub);
        msg!("Admin: {}", ctx.accounts.admin.key());
        
        // Check if the account already exists
        let hub_info = &ctx.accounts.hub;
        let hub_data_len = hub_info.data_len();
        
        msg!("Hub data length: {}", hub_data_len);
        msg!("Hub owner: {}", hub_info.owner);
        
        // If account doesn't exist yet (data length is 0), create it
        if hub_data_len == 0 {
            msg!("Creating new hub account");
            
            // Calculate the space needed
            let space = 8 + std::mem::size_of::<Hub>();
            
            // Calculate the rent required
            let rent = Rent::get()?;
            let lamports = rent.minimum_balance(space);
            
            // Create account with system program
            msg!("Creating account with {} lamports and {} space", lamports, space);
            let hub_seeds = &[b"hub" as &[u8], &[ctx.bumps.hub]];
            let hub_signer = &[&hub_seeds[..]];
            
            create_account(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    CreateAccount {
                        from: ctx.accounts.admin.to_account_info(),
                        to: ctx.accounts.hub.to_account_info(),
                    },
                    hub_signer,
                ),
                lamports,
                space as u64,
                ctx.program_id,
            )?;
            
            msg!("Account created successfully");
        } else {
            // If account exists, verify ownership
            if hub_info.owner != ctx.program_id {
                msg!("Hub account owned by wrong program: {}", hub_info.owner);
                return Err(LocalMoneyError::Unauthorized.into());
            }
            msg!("Hub account already exists and is owned by program");
        }
        
        // Create a Hub struct and initialize it
        let mut hub = Hub {
            admin: ctx.accounts.admin.key(),
            config,
            bump: ctx.bumps.hub
        };
        
        // Serialize the struct to the account data
        let hub_data = &mut hub_info.try_borrow_mut_data()?;
        let dst: &mut [u8] = &mut hub_data[..];
        let mut cursor = std::io::Cursor::new(dst);
        hub.try_serialize(&mut cursor)?;
        
        msg!("Hub initialized with admin: {}", hub.admin);
        Ok(())
    }

    // Update the hub configuration
    pub fn update_config(ctx: Context<UpdateConfig>, config: HubConfig) -> Result<()> {
        // Validate configuration
        validate_config(&config)?;

        // Update the configuration in the hub account
        let hub = &mut ctx.accounts.hub;
        hub.config = config;

        msg!("Hub configuration updated");
        Ok(())
    }

    // Update the admin of the hub
    pub fn update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
        let hub = &mut ctx.accounts.hub;
        let old_admin = hub.admin;
        hub.admin = new_admin;

        msg!("Admin updated from {} to {}", old_admin, new_admin);
        Ok(())
    }
}

// Validate hub configuration
fn validate_config(config: &HubConfig) -> Result<()> {
    // Check platform fee (sum of fees must be <= MAX_PLATFORM_FEE)
    let total_platform_fee =
        config.chain_fee_pct as u8 + config.burn_fee_pct as u8 + config.warchest_fee_pct as u8;

    if total_platform_fee > MAX_PLATFORM_FEE {
        return Err(LocalMoneyError::InvalidPlatformFee.into());
    }

    // Check trade timers
    if config.trade_expiration_timer == 0
        || config.trade_expiration_timer > MAX_TRADE_EXPIRATION_TIMER
    {
        return Err(LocalMoneyError::InvalidParameter.into());
    }

    if config.trade_dispute_timer == 0 || config.trade_dispute_timer > MAX_TRADE_DISPUTE_TIMER {
        return Err(LocalMoneyError::InvalidParameter.into());
    }

    Ok(())
}

// Context for initializing the hub
#[derive(Accounts)]
#[instruction(config: HubConfig)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: We're checking this account in the instruction handler
    #[account(
        mut, 
        seeds = [b"hub"],
        bump
    )]
    pub hub: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// Context for updating the hub config
#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        constraint = hub.admin == admin.key() @ LocalMoneyError::Unauthorized
    )]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"hub"],
        bump = hub.bump
    )]
    pub hub: Account<'info, Hub>,
}

// Context for updating the admin
#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        constraint = hub.admin == admin.key() @ LocalMoneyError::Unauthorized
    )]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"hub"],
        bump = hub.bump
    )]
    pub hub: Account<'info, Hub>,
}
