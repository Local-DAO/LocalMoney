use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw");

#[program]
pub mod price_oracle {
    use super::*;

    /// Initialize the price provider registry
    ///
    /// This must be called once to set up the price oracle system.
    /// It creates the global registry that tracks all authorized price providers.
    ///
    /// # Arguments
    ///
    /// * `ctx` - InitializeRegistry context
    /// * `params` - Configuration parameters (staleness limit)
    ///
    /// # Access Control
    ///
    /// Can only be called once to initialize the registry PDA.
    /// The caller becomes the registry admin.
    pub fn initialize_registry(
        ctx: Context<InitializeRegistry>,
        params: InitializeRegistryParams,
    ) -> Result<()> {
        instructions::initialize_registry::handler(ctx, params)
    }

    /// Register a new price provider
    ///
    /// Admin-only operation to authorize new price providers who can
    /// submit price updates for fiat currencies.
    ///
    /// # Arguments
    ///
    /// * `ctx` - RegisterProvider context
    /// * `provider_pubkey` - Public key of the provider to register
    ///
    /// # Access Control
    ///
    /// Only the registry admin can register new providers.
    ///
    /// # Effects
    ///
    /// - Creates a PriceProvider account for the provider
    /// - Increments the total provider count in the registry
    /// - Provider is active by default
    pub fn register_provider(
        ctx: Context<RegisterProvider>,
        provider_pubkey: Pubkey,
    ) -> Result<()> {
        instructions::register_provider::handler(ctx, provider_pubkey)
    }

    /// Remove (deactivate) a price provider
    ///
    /// Admin-only operation to revoke a provider's authorization.
    /// This doesn't delete the account, but marks them as inactive.
    ///
    /// # Arguments
    ///
    /// * `ctx` - RemoveProvider context
    ///
    /// # Access Control
    ///
    /// Only the registry admin can remove providers.
    ///
    /// # Effects
    ///
    /// - Marks provider as inactive
    /// - Decrements the active provider count
    /// - Provider can no longer submit price updates
    pub fn remove_provider(ctx: Context<RemoveProvider>) -> Result<()> {
        instructions::remove_provider::handler(ctx)
    }

    /// Initialize a price feed for a fiat currency
    ///
    /// Creates a new Price account for a specific fiat currency.
    /// Each currency has its own price feed that can be updated by
    /// authorized providers.
    ///
    /// # Arguments
    ///
    /// * `ctx` - InitializePrice context
    /// * `fiat_currency` - ISO 4217 currency code (e.g., "USD", "EUR")
    /// * `params` - Initial price configuration
    ///
    /// # Access Control
    ///
    /// Only the registry admin can initialize new price feeds.
    ///
    /// # Validation
    ///
    /// - Fiat currency code must be 3 uppercase ASCII letters
    /// - Initial price must be within min/max bounds
    /// - Min price must be less than max price
    ///
    /// # Price Format
    ///
    /// Prices are stored as u64 values scaled by decimals.
    /// Example: With 6 decimals, price of 1.50 USD = 1_500_000
    pub fn initialize_price(
        ctx: Context<InitializePrice>,
        fiat_currency: [u8; 3],
        params: InitializePriceParams,
    ) -> Result<()> {
        instructions::initialize_price::handler(ctx, fiat_currency, params)
    }

    /// Update a price feed
    ///
    /// Authorized providers can submit new price values for fiat currencies.
    /// The price is validated against configured min/max bounds before updating.
    ///
    /// # Arguments
    ///
    /// * `ctx` - UpdatePrice context
    /// * `params` - New price value
    ///
    /// # Access Control
    ///
    /// Only active, authorized price providers can update prices.
    /// The provider must sign the transaction with their registered key.
    ///
    /// # Validation
    ///
    /// - Provider must be active
    /// - Provider signature must match registered pubkey
    /// - Price value must be within min/max bounds
    /// - Price value must be greater than zero
    ///
    /// # Effects
    ///
    /// - Updates the price value
    /// - Records the provider who submitted the update
    /// - Updates the timestamp
    /// - Increments provider's update count
    ///
    /// # Staleness
    ///
    /// Prices become stale after the configured staleness period
    /// (default: 1 hour). Other programs should check staleness
    /// before using price data.
    pub fn update_price(
        ctx: Context<UpdatePrice>,
        params: UpdatePriceParams,
    ) -> Result<()> {
        instructions::update_price::handler(ctx, params)
    }
}
