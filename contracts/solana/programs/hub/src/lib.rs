use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH");

#[program]
pub mod hub {
    use super::*;

    /// Initialize the Hub configuration
    ///
    /// This sets up the central configuration for the entire LocalMoney protocol,
    /// including program addresses, fee structure, trading limits, and circuit breakers.
    ///
    /// # Arguments
    ///
    /// * `ctx` - Initialize context with hub_config PDA and admin
    /// * `params` - Initial configuration parameters
    ///
    /// # Access Control
    ///
    /// Can only be called once to initialize the Hub config PDA.
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    /// Update the Hub configuration
    ///
    /// Allows the admin to update any configuration parameters. All parameters
    /// are optional - only provided values will be updated.
    ///
    /// # Arguments
    ///
    /// * `ctx` - UpdateConfig context with hub_config PDA and admin signer
    /// * `params` - Updated configuration parameters (all optional)
    ///
    /// # Access Control
    ///
    /// Only the current admin can call this instruction.
    pub fn update_config(ctx: Context<UpdateConfig>, params: UpdateConfigParams) -> Result<()> {
        instructions::update_config::handler(ctx, params)
    }

    /// Transfer admin authority
    ///
    /// Transfers the admin role to a new address. This is a one-step transfer
    /// without requiring acceptance from the new admin.
    ///
    /// # Arguments
    ///
    /// * `ctx` - TransferAdmin context with hub_config PDA, current admin, and new admin
    ///
    /// # Access Control
    ///
    /// Only the current admin can call this instruction.
    ///
    /// # Security
    ///
    /// The new admin address is validated to ensure it's not the zero address.
    pub fn transfer_admin(ctx: Context<TransferAdmin>) -> Result<()> {
        instructions::transfer_admin::handler(ctx)
    }

    /// Set circuit breaker flags
    ///
    /// Allows the admin to pause specific protocol operations or the entire protocol.
    /// This is used for emergency situations or maintenance.
    ///
    /// # Arguments
    ///
    /// * `ctx` - SetCircuitBreaker context with hub_config PDA and admin
    /// * `params` - Circuit breaker flags (all optional)
    ///
    /// # Access Control
    ///
    /// Only the current admin can call this instruction.
    ///
    /// # Circuit Breaker Types
    ///
    /// * `global_pause` - Pauses all protocol operations
    /// * `pause_new_offers` - Prevents creation of new offers
    /// * `pause_new_trades` - Prevents creation of new trades
    /// * `pause_escrow_funding` - Prevents funding of escrows
    /// * `pause_escrow_release` - Prevents release of escrowed funds
    pub fn set_circuit_breaker(
        ctx: Context<SetCircuitBreaker>,
        params: CircuitBreakerParams,
    ) -> Result<()> {
        instructions::set_circuit_breaker::handler(ctx, params)
    }
}
