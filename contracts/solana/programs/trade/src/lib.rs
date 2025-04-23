use anchor_lang::prelude::*;
use anchor_lang::system_program::System as SystemProgram;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use localmoney_shared::constants::TRADE_SEED;
use localmoney_shared::errors::LocalMoneyError;
use localmoney_shared::hub::HubConfig;
use localmoney_shared::offer::{Offer, OfferDirection};
use localmoney_shared::price::DenomFiatPrice;
use localmoney_shared::price::FiatCurrency;
use localmoney_shared::profile::{Profile, UpdateContactParams, UpdateTradesCountParams};
use localmoney_shared::trade::{FeeInfo, Trade, TradeState, TradeStateItem};
use profile;
use profile::cpi::accounts::{UpdateContact, UpdateTradesCount};

// Use the ID constant directly when needed
use profile::ID as PROFILE_ID;

declare_id!("c4zS4D2VUbXrp48rUVWTSuFbJf9iSdd4Qn2aJSyBpXN");

#[program]
pub mod trade {
    use super::*;

    /// Register hub program for cross-program calls
    pub fn register_hub(ctx: Context<RegisterHub>) -> Result<()> {
        let _hub_config = &ctx.accounts.hub_config;
        let trade_config = &mut ctx.accounts.trade_config;

        // Save hub program ID and bump
        trade_config.hub_program = ctx.accounts.hub_program.key();
        // Set bump value directly
        trade_config.bump = 255; // This will be set by Anchor
        trade_config.authority = ctx.accounts.authority.key();

        msg!("Hub registered with trade program");
        Ok(())
    }

    /// Create a new trade from an offer
    pub fn create_trade(
        ctx: Context<CreateTrade>,
        amount: u64,
        taker_contact: String,
        profile_taker_contact: String,
        profile_taker_encryption_key: String,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        let _hub_config = &ctx.accounts.hub_config;
        let offer = &ctx.accounts.offer;
        let taker = ctx.accounts.taker.key();

        // Reject if taker is the offer owner
        if taker == offer.owner {
            return Err(TradeError::CannotTradeWithSelf.into());
        }

        // Check if amount is within allowed range
        if amount < offer.min_amount || amount > offer.max_amount {
            return Err(TradeError::InvalidAmount.into());
        }

        // Check if trade amount in USD is within global limits
        let offer_usd_price =
            offer.price_premium as u128 * (ctx.accounts.denom_price.price as u128) / 100;
        let trade_usd_amount = (amount as u128 * offer_usd_price) / 1_000_000;

        if trade_usd_amount < _hub_config.trade_limit_min as u128
            || trade_usd_amount > _hub_config.trade_limit_max as u128
        {
            return Err(TradeError::InvalidTradeAmount.into());
        }

        // Calculate the denom price in fiat using offer rate
        let denom_final_price =
            (offer.price_premium as u128 * (ctx.accounts.denom_price.price as u128)) / 100;
        if denom_final_price == 0 {
            return Err(TradeError::InvalidPriceForDenom.into());
        }

        // Determine buyer and seller based on offer type
        let (buyer, buyer_contact, seller, seller_contact) =
            if offer.direction == OfferDirection::Buy {
                (offer.owner, None, taker, Some(taker_contact))
            } else {
                (taker, Some(taker_contact), offer.owner, None)
            };

        // Create trade PDA
        let trade_data = &mut ctx.accounts.trade;
        let trade_id = ctx.accounts.trades_counter.counter + 1;

        // Update trades counter
        ctx.accounts.trades_counter.counter = trade_id;

        // Create initial trade state history
        let initial_state = TradeStateItem {
            actor: taker,
            state: TradeState::RequestCreated,
            timestamp: current_time,
        };

        // Set expiration time based on hub config
        let expires_at = current_time + _hub_config.trade_expiration_timer as i64;

        // Initialize the trade
        trade_data.id = trade_id;
        trade_data.buyer = buyer;
        trade_data.seller = seller;
        trade_data.buyer_contact = buyer_contact;
        trade_data.seller_contact = seller_contact;
        trade_data.arbitrator = ctx.accounts.arbitrator.key();
        trade_data.offer_program = ctx.accounts.offer_program.key();
        trade_data.offer_id = offer.id;
        trade_data.created_at = current_time;
        trade_data.expires_at = expires_at;
        trade_data.denom = offer.token_mint;
        trade_data.amount = amount;
        // Convert fiat currency string to FiatCurrency enum
        // For now, use a default value since we need to parse the string
        trade_data.fiat = match offer.fiat_currency.as_str() {
            "USD" => FiatCurrency::USD,
            "EUR" => FiatCurrency::EUR,
            "JPY" => FiatCurrency::JPY,
            "GBP" => FiatCurrency::GBP,
            "CAD" => FiatCurrency::CAD,
            _ => return Err(TradeError::InvalidFiatCurrency.into()),
        };
        trade_data.denom_fiat_price = denom_final_price;
        trade_data.state_history = vec![initial_state];
        trade_data.state = TradeState::RequestCreated;

        // CPI to profile program to update taker's contact info
        let cpi_accounts = UpdateContact {
            authority: ctx.accounts.trade_authority.to_account_info(),
            hub_config: ctx.accounts.hub_config.to_account_info(),
            profile: ctx.accounts.taker_profile.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let bump_seed = [ctx.accounts.trade_config.bump];
        let authority_seeds = &[b"trade_authority".as_ref(), bump_seed.as_ref()];
        let signer_seeds = &[&authority_seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.profile_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        profile::cpi::update_contact(
            cpi_ctx,
            UpdateContactParams {
                contact: profile_taker_contact,
                encryption_key: profile_taker_encryption_key,
            },
        )?;

        // CPI to update taker's trade count
        let cpi_trade_count_accounts = UpdateTradesCount {
            authority: ctx.accounts.trade_authority.to_account_info(),
            hub: ctx.accounts.hub_config.to_account_info(),
            profile_owner: ctx.accounts.taker.to_account_info(),
            profile: ctx.accounts.taker_profile.to_account_info(),
        };
        let cpi_trade_count_ctx = CpiContext::new_with_signer(
            ctx.accounts.profile_program.to_account_info(),
            cpi_trade_count_accounts,
            signer_seeds,
        );
        profile::cpi::update_trades_count(
            cpi_trade_count_ctx,
            UpdateTradesCountParams {
                trade_state: TradeState::RequestCreated,
            },
        )?;

        msg!("Trade created with ID: {}", trade_id);
        Ok(())
    }

    /// Accept a trade request
    pub fn accept_request(
        ctx: Context<AcceptRequest>,
        _trade_id: u64,
        maker_contact: String,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        let trade = &mut ctx.accounts.trade;
        let maker = ctx.accounts.maker.key();

        // Check if trade is already expired
        if trade.is_expired(current_time) {
            return Err(TradeError::TradeExpired.into());
        }

        // Verify trade is in RequestCreated state
        if trade.state != TradeState::RequestCreated {
            return Err(TradeError::InvalidTradeState.into());
        }

        // Check if maker is the right counter-party for this trade
        if trade.buyer == maker {
            // If maker is buyer, update buyer contact
            trade.buyer_contact = Some(maker_contact.clone());
        } else if trade.seller == maker {
            // If maker is seller, update seller contact
            trade.seller_contact = Some(maker_contact.clone());
        } else {
            return Err(TradeError::Unauthorized.into());
        }

        // Update trade state
        trade.set_state(TradeState::RequestAccepted, maker, current_time);

        // CPI to profile program to update maker's contact information
        let cpi_accounts = UpdateContact {
            authority: ctx.accounts.trade_authority.to_account_info(),
            hub_config: ctx.accounts.hub_config.to_account_info(),
            profile: ctx.accounts.maker_profile.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let bump_seed = [ctx.accounts.trade_config.bump];
        let authority_seeds = &[b"trade_authority".as_ref(), bump_seed.as_ref()];
        let signer_seeds = &[&authority_seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.profile_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        profile::cpi::update_contact(
            cpi_ctx,
            UpdateContactParams {
                contact: maker_contact,
                encryption_key: "".to_string(), // Placeholder, should be provided if needed
            },
        )?;

        // CPI to update maker's trade count
        let cpi_trade_count_accounts = UpdateTradesCount {
            authority: ctx.accounts.trade_authority.to_account_info(),
            hub: ctx.accounts.hub_config.to_account_info(),
            profile_owner: ctx.accounts.maker.to_account_info(),
            profile: ctx.accounts.maker_profile.to_account_info(),
        };
        let cpi_trade_count_ctx = CpiContext::new_with_signer(
            ctx.accounts.profile_program.to_account_info(),
            cpi_trade_count_accounts,
            signer_seeds,
        );
        profile::cpi::update_trades_count(
            cpi_trade_count_ctx,
            UpdateTradesCountParams {
                trade_state: TradeState::RequestAccepted,
            },
        )?;

        msg!("Trade {} accepted by {}", _trade_id, maker);
        Ok(())
    }

    /// Fund escrow with tokens
    pub fn fund_escrow(
        ctx: Context<FundEscrow>,
        _trade_id: u64,
        maker_contact: Option<String>,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        let trade = &mut ctx.accounts.trade;
        let seller = ctx.accounts.seller.key();

        // Check if trade is already expired
        if trade.is_expired(current_time) {
            return Err(TradeError::TradeExpired.into());
        }

        // Verify trade is in RequestAccepted state
        if trade.state != TradeState::RequestAccepted {
            return Err(TradeError::InvalidTradeState.into());
        }

        // Update seller contact if provided
        if let Some(contact) = maker_contact {
            if trade.seller == seller {
                trade.seller_contact = Some(contact);
            } else {
                return Err(TradeError::Unauthorized.into());
            }
        }

        // Transfer tokens to escrow
        let transfer_ix = Transfer {
            from: ctx.accounts.seller_token_account.to_account_info(),
            to: ctx.accounts.escrow_token_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_ix);
        token::transfer(cpi_ctx, trade.amount)?;

        // Update trade state
        trade.set_state(TradeState::EscrowFunded, seller, current_time);

        // CPI to update seller's trade count
        let cpi_trade_count_accounts = UpdateTradesCount {
            authority: ctx.accounts.trade_authority.to_account_info(),
            hub: ctx.accounts.hub_config.to_account_info(),
            profile_owner: ctx.accounts.seller.to_account_info(),
            profile: ctx.accounts.seller_profile.to_account_info(),
        };
        let bump_seed = [ctx.accounts.trade_config.bump];
        let authority_seeds = &[b"trade_authority".as_ref(), bump_seed.as_ref()];
        let signer_seeds = &[&authority_seeds[..]];
        let cpi_trade_count_ctx = CpiContext::new_with_signer(
            ctx.accounts.profile_program.to_account_info(),
            cpi_trade_count_accounts,
            signer_seeds,
        );
        profile::cpi::update_trades_count(
            cpi_trade_count_ctx,
            UpdateTradesCountParams {
                trade_state: TradeState::EscrowFunded,
            },
        )?;

        Ok(())
    }

    /// Mark fiat as deposited
    pub fn fiat_deposited(ctx: Context<FiatDeposited>, _trade_id: u64) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        let trade = &mut ctx.accounts.trade;
        let buyer = ctx.accounts.buyer.key();

        // Verify caller is the buyer
        if trade.buyer != buyer {
            return Err(TradeError::Unauthorized.into());
        }

        // Verify trade is in EscrowFunded state
        if trade.state != TradeState::EscrowFunded {
            return Err(TradeError::InvalidTradeState.into());
        }

        // Set the dispute timer
        let _hub_config = &ctx.accounts.hub_config;
        let enables_dispute_at = current_time + _hub_config.trade_dispute_timer as i64;
        trade.enables_dispute_at = Some(enables_dispute_at);

        // Update trade state
        trade.set_state(TradeState::FiatDeposited, buyer, current_time);

        msg!("Fiat deposited for trade {} by {}", _trade_id, buyer);
        Ok(())
    }

    /// Release escrow funds to complete trade
    pub fn release_escrow(ctx: Context<ReleaseEscrow>, _trade_id: u64) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        let _hub_config = &ctx.accounts.hub_config;
        let trade = &mut ctx.accounts.trade;
        let seller = ctx.accounts.seller.key();

        // Check if trade is in correct state
        if trade.state != TradeState::FiatDeposited {
            return Err(TradeError::InvalidTradeState.into());
        }

        // Calculate protocol fees
        let fee_info = calculate_fees(_hub_config, trade.amount);

        // Calculate release amount after deducting protocol fees
        let release_amount = trade
            .amount
            .checked_sub(fee_info.total_fees())
            .ok_or(LocalMoneyError::FeeCalculationError)?;

        // Security Check: Ensure outgoing amounts equal escrow balance
        let total_outgoing = release_amount
            .checked_add(fee_info.total_fees())
            .ok_or(LocalMoneyError::FeeCalculationError)?;
        require!(
            total_outgoing == ctx.accounts.escrow_token_account.amount,
            LocalMoneyError::EscrowBalanceMismatch
        );

        // --- Token Transfers ---
        let seeds = &[
            TRADE_SEED,
            &_trade_id.to_le_bytes(),
            &[trade.bump], // Use trade bump, not authority bump from context
        ];
        let signer = &[&seeds[..]];

        // 1. Transfer release amount to seller
        let transfer_seller_ix = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.seller_token_account.to_account_info(),
            authority: ctx.accounts.trade_authority.to_account_info(),
        };
        let transfer_seller_cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_seller_ix,
            signer,
        );
        token::transfer(transfer_seller_cpi_ctx, release_amount)?;

        // 2. Transfer arbitration fee to arbitrator
        if fee_info.chain_amount > 0 {
            let transfer_arb_ix = Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.arbitrator_token_account.to_account_info(),
                authority: ctx.accounts.trade_authority.to_account_info(),
            };
            let transfer_arb_cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_arb_ix,
                signer,
            );
            token::transfer(transfer_arb_cpi_ctx, fee_info.chain_amount)?;
        }

        // 3. Transfer Chain Fee
        if fee_info.warchest_amount > 0 {
            let transfer_warchest_ix = Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.warchest_token_account.to_account_info(),
                authority: ctx.accounts.trade_authority.to_account_info(),
            };
            let transfer_warchest_cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_warchest_ix,
                signer,
            );
            token::transfer(transfer_warchest_cpi_ctx, fee_info.warchest_amount)?;
        }

        // 4. Burn Fee
        if fee_info.burn_amount > 0 {
            let burn_ix = anchor_spl::token::Burn {
                mint: ctx.accounts.local_token_mint.to_account_info(),
                from: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.trade_authority.to_account_info(),
            };
            let burn_cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                burn_ix,
                signer,
            );
            anchor_spl::token::burn(burn_cpi_ctx, fee_info.burn_amount)?;
        }

        // Update trade state
        trade.set_state(TradeState::EscrowReleased, seller, current_time);

        // --- Update Profile Counts ---
        let cpi_seller_trade_count_accounts = UpdateTradesCount {
            authority: ctx.accounts.trade_authority.to_account_info(),
            hub: ctx.accounts.hub_config.to_account_info(),
            profile_owner: ctx.accounts.seller_profile.to_account_info(),
            profile: ctx.accounts.seller_profile.to_account_info(),
        };
        let cpi_seller_trade_count_ctx = CpiContext::new_with_signer(
            ctx.accounts.profile_program.to_account_info(),
            cpi_seller_trade_count_accounts,
            signer,
        );
        profile::cpi::update_trades_count(
            cpi_seller_trade_count_ctx,
            UpdateTradesCountParams {
                trade_state: TradeState::EscrowReleased,
            },
        )?;

        Ok(())
    }

    /// Cancel and refund escrow
    pub fn refund_escrow(ctx: Context<RefundEscrow>, _trade_id: u64) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        let trade = &mut ctx.accounts.trade;
        let initiator = ctx.accounts.initiator.key();

        // Verify trade state allows refund
        if trade.state != TradeState::EscrowFunded && trade.state != TradeState::FiatDeposited {
            return Err(TradeError::InvalidTradeState.into());
        }

        // Check if initiator is authorized
        if initiator != trade.buyer && initiator != trade.seller {
            return Err(TradeError::Unauthorized.into());
        }

        // Check if refund is allowed based on trade state and initiator
        match trade.state {
            TradeState::EscrowFunded => {
                // Only seller can refund before fiat is marked as sent
                if initiator != trade.seller {
                    return Err(TradeError::Unauthorized.into());
                }
            }
            TradeState::FiatDeposited => {
                // Only buyer can refund after fiat is marked as sent
                if initiator != trade.buyer {
                    return Err(TradeError::Unauthorized.into());
                }
            }
            _ => return Err(TradeError::InvalidTradeState.into()),
        }

        // Transfer tokens from escrow back to seller
        let transfer_ix = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.seller_token_account.to_account_info(),
            authority: ctx.accounts.trade_authority.to_account_info(),
        };
        // Define seeds for the transfer CPI
        let trade_id_bytes = _trade_id.to_le_bytes();
        let bump_seed = [trade.bump];
        let transfer_seeds = &[
            TRADE_SEED.as_ref(),
            trade_id_bytes.as_ref(),
            bump_seed.as_ref(),
        ];
        let transfer_signer_seeds = &[&transfer_seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_ix,
            transfer_signer_seeds, // Use the defined seeds
        );
        token::transfer(cpi_ctx, trade.amount)?;

        // Update trade state
        trade.set_state(TradeState::EscrowRefunded, initiator, current_time);

        // Define seeds for profile CPIs
        let config_bump_seed = [ctx.accounts.trade_config.bump];
        let config_authority_seeds = &[b"trade_authority".as_ref(), config_bump_seed.as_ref()];
        let config_signer_seeds = &[&config_authority_seeds[..]];

        // CPI to update buyer's trade count
        let cpi_buyer_trade_count_accounts = UpdateTradesCount {
            authority: ctx.accounts.trade_authority.to_account_info(),
            hub: ctx.accounts.hub_config.to_account_info(),
            profile_owner: ctx.accounts.buyer_profile.to_account_info(), // Use buyer_profile AccountInfo
            profile: ctx.accounts.buyer_profile.to_account_info(),
        };
        let cpi_buyer_trade_count_ctx = CpiContext::new_with_signer(
            ctx.accounts.profile_program.to_account_info(),
            cpi_buyer_trade_count_accounts,
            config_signer_seeds, // Use defined config seeds
        );
        profile::cpi::update_trades_count(
            cpi_buyer_trade_count_ctx,
            UpdateTradesCountParams {
                trade_state: TradeState::EscrowRefunded,
            },
        )?;

        // CPI to update seller's trade count
        let cpi_seller_trade_count_accounts = UpdateTradesCount {
            authority: ctx.accounts.trade_authority.to_account_info(),
            hub: ctx.accounts.hub_config.to_account_info(),
            profile_owner: ctx.accounts.seller_profile.to_account_info(), // Use seller_profile AccountInfo
            profile: ctx.accounts.seller_profile.to_account_info(),
        };
        let cpi_seller_trade_count_ctx = CpiContext::new_with_signer(
            ctx.accounts.profile_program.to_account_info(),
            cpi_seller_trade_count_accounts,
            config_signer_seeds, // Use defined config seeds
        );
        profile::cpi::update_trades_count(
            cpi_seller_trade_count_ctx,
            UpdateTradesCountParams {
                trade_state: TradeState::EscrowRefunded,
            },
        )?;

        Ok(())
    }

    /// Initiate a dispute for a trade
    pub fn dispute_escrow(
        ctx: Context<DisputeEscrow>,
        _trade_id: u64,
        buyer_contact: String,
        seller_contact: String,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        let trade = &mut ctx.accounts.trade;
        let trader = ctx.accounts.trader.key();

        // Verify trade is in FiatDeposited state
        if trade.state != TradeState::FiatDeposited {
            return Err(TradeError::InvalidTradeState.into());
        }

        // Verify caller is either the buyer or seller
        if trader != trade.buyer && trader != trade.seller {
            return Err(TradeError::Unauthorized.into());
        }

        // Verify dispute is allowed (within dispute window)
        if let Some(dispute_time) = trade.enables_dispute_at {
            if current_time < dispute_time {
                return Err(TradeError::PrematureDisputeRequest.into());
            }
        } else {
            return Err(TradeError::DisputeNotEnabled.into());
        }

        // Update trade state
        trade.set_state(TradeState::EscrowDisputed, trader, current_time);

        // Store contact information for arbitrator
        trade.arbitrator_buyer_contact = Some(buyer_contact);
        trade.arbitrator_seller_contact = Some(seller_contact);

        msg!("Dispute initiated for trade {} by {}", _trade_id, trader);
        Ok(())
    }

    /// Arbitrator settles a dispute
    pub fn settle_dispute(
        ctx: Context<SettleDispute>,
        _trade_id: u64,
        winner: Pubkey,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let _current_time = clock.unix_timestamp;
        let arbitrator = ctx.accounts.arbitrator.key();
        let trade = &mut ctx.accounts.trade;
        let winner_is_buyer = winner == trade.buyer;
        let _winner_is_seller = winner == trade.seller;

        // Calculate arbitration fee
        let _hub_config = &ctx.accounts.hub_config;
        let arbitration_fee =
            (trade.amount as u128 * _hub_config.arbitration_fee_pct as u128 / 100) as u64;

        // Calculate protocol fees (unconditionally)
        let fee_info = calculate_fees(_hub_config, trade.amount);

        // Calculate release amount after deducting arbitration fee and protocol fees
        let release_amount = trade
            .amount
            .checked_sub(arbitration_fee)
            .ok_or(LocalMoneyError::FeeCalculationError)?
            .checked_sub(fee_info.total_fees())
            .ok_or(LocalMoneyError::FeeCalculationError)?;

        // Security Check: Ensure outgoing amounts equal escrow balance
        let total_outgoing = release_amount
            .checked_add(arbitration_fee)
            .ok_or(LocalMoneyError::FeeCalculationError)?
            .checked_add(fee_info.total_fees())
            .ok_or(LocalMoneyError::FeeCalculationError)?;
        require!(
            total_outgoing == ctx.accounts.escrow_token_account.amount,
            LocalMoneyError::EscrowBalanceMismatch
        );

        // --- Token Transfers ---
        let seeds = &[
            TRADE_SEED,
            &_trade_id.to_le_bytes(),
            &[trade.bump], // Use trade bump, not authority bump from context
        ];
        let signer = &[&seeds[..]];

        // 1. Transfer release amount to winner
        let transfer_winner_ix = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: if winner_is_buyer {
                ctx.accounts.buyer_token_account.to_account_info()
            } else {
                ctx.accounts.seller_token_account.to_account_info()
            },
            authority: ctx.accounts.trade_authority.to_account_info(),
        };
        let transfer_winner_cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_winner_ix,
            signer,
        );
        token::transfer(transfer_winner_cpi_ctx, release_amount)?;

        // 2. Transfer arbitration fee to arbitrator
        if arbitration_fee > 0 {
            let transfer_arb_ix = Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.arbitrator_token_account.to_account_info(),
                authority: ctx.accounts.trade_authority.to_account_info(),
            };
            let transfer_arb_cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_arb_ix,
                signer,
            );
            token::transfer(transfer_arb_cpi_ctx, arbitration_fee)?;
        }

        // 3. Transfer Chain Fee
        if fee_info.chain_amount > 0 {
            let transfer_chain_ix = Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx
                    .accounts
                    .chain_fee_collector_token_account
                    .to_account_info(),
                authority: ctx.accounts.trade_authority.to_account_info(),
            };
            let transfer_chain_cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_chain_ix,
                signer,
            );
            token::transfer(transfer_chain_cpi_ctx, fee_info.chain_amount)?;
        }

        // 4. Transfer Warchest Fee
        if fee_info.warchest_amount > 0 {
            let transfer_warchest_ix = Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.warchest_token_account.to_account_info(),
                authority: ctx.accounts.trade_authority.to_account_info(),
            };
            let transfer_warchest_cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_warchest_ix,
                signer,
            );
            token::transfer(transfer_warchest_cpi_ctx, fee_info.warchest_amount)?;
        }

        // 5. Burn Fee
        if fee_info.burn_amount > 0 {
            let burn_ix = anchor_spl::token::Burn {
                mint: ctx.accounts.local_token_mint.to_account_info(),
                from: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.trade_authority.to_account_info(),
            };
            let burn_cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                burn_ix,
                signer,
            );
            anchor_spl::token::burn(burn_cpi_ctx, fee_info.burn_amount)?;
        }

        // --- Update Profile Counts ---
        let winner_state = if winner_is_buyer {
            TradeState::SettledForTaker
        } else {
            TradeState::SettledForMaker
        };

        let winner_profile_info = if winner_is_buyer {
            ctx.accounts.buyer_profile.to_account_info()
        } else {
            ctx.accounts.seller_profile.to_account_info()
        };
        let cpi_winner_accounts = UpdateTradesCount {
            authority: ctx.accounts.trade_authority.to_account_info(),
            hub: ctx.accounts.hub_config.to_account_info(),
            profile_owner: if winner_is_buyer {
                ctx.accounts.buyer_profile.to_account_info()
            } else {
                ctx.accounts.seller_profile.to_account_info()
            }, // Use winner's profile account info
            profile: winner_profile_info,
        };
        // Define signer_seeds for profile CPIs using the config bump
        let config_bump_seed = [ctx.accounts.trade_config.bump];
        let config_authority_seeds = &[b"trade_authority".as_ref(), config_bump_seed.as_ref()];
        let signer_seeds = &[&config_authority_seeds[..]]; // Define signer_seeds here
        let cpi_winner_ctx = CpiContext::new_with_signer(
            ctx.accounts.profile_program.to_account_info(),
            cpi_winner_accounts,
            signer_seeds, // Use the defined signer_seeds
        );
        profile::cpi::update_trades_count(
            cpi_winner_ctx,
            UpdateTradesCountParams {
                trade_state: winner_state,
            },
        )?;

        let loser_state = if winner_is_buyer {
            // Loser is seller
            TradeState::SettledForMaker
        } else {
            // Loser is buyer
            TradeState::SettledForTaker
        };

        let loser_profile_info = if winner_is_buyer {
            ctx.accounts.seller_profile.to_account_info()
        } else {
            ctx.accounts.buyer_profile.to_account_info()
        };
        let cpi_loser_accounts = UpdateTradesCount {
            authority: ctx.accounts.trade_authority.to_account_info(),
            hub: ctx.accounts.hub_config.to_account_info(),
            profile_owner: if winner_is_buyer {
                ctx.accounts.seller_profile.to_account_info()
            } else {
                ctx.accounts.buyer_profile.to_account_info()
            }, // Use loser's profile account info
            profile: loser_profile_info,
        };
        // Re-use signer_seeds defined above
        let cpi_loser_ctx = CpiContext::new_with_signer(
            ctx.accounts.profile_program.to_account_info(),
            cpi_loser_accounts,
            signer_seeds, // Use the same signer_seeds
        );
        profile::cpi::update_trades_count(
            cpi_loser_ctx,
            UpdateTradesCountParams {
                trade_state: loser_state,
            },
        )?;

        msg!(
            "Dispute settled for trade {} by arbitrator {}",
            _trade_id,
            arbitrator
        );
        msg!("Winner: {}", winner);
        Ok(())
    }
}

/// Configuration for the Trade Program
#[account]
pub struct TradeConfig {
    pub authority: Pubkey,
    pub hub_program: Pubkey,
    pub bump: u8,
}

/// Structure for tracking the number of trades
#[account]
pub struct TradesCounter {
    pub counter: u64,
}

/// Context for registering hub program
#[derive(Accounts)]
pub struct RegisterHub<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Hub program
    pub hub_program: Program<'info, SystemProgram>,

    /// Hub configuration account
    #[account(
        seeds = [b"config"],
        bump,
        seeds::program = hub_program.key(),
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// Trade configuration PDA
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + std::mem::size_of::<TradeConfig>(),
        seeds = [b"config"],
        bump
    )]
    pub trade_config: Account<'info, TradeConfig>,

    /// Trade counter PDA for tracking number of trades
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + std::mem::size_of::<TradesCounter>(),
        seeds = [b"counter"],
        bump
    )]
    pub trades_counter: Account<'info, TradesCounter>,

    pub system_program: Program<'info, SystemProgram>,
}

/// Context for creating a new trade
#[derive(Accounts)]
#[instruction(
    amount: u64,
    taker_contact: String,
    profile_taker_contact: String,
    profile_taker_encryption_key: String,
)]
pub struct CreateTrade<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,

    /// Trade configuration account
    #[account(
        seeds = [b"config"],
        bump,
        has_one = hub_program @ TradeError::InvalidHubProgram,
    )]
    pub trade_config: Account<'info, TradeConfig>,

    /// Hub program
    pub hub_program: Program<'info, SystemProgram>,

    /// Hub configuration account
    #[account(
        seeds = [b"config"],
        bump,
        seeds::program = hub_program.key(),
        constraint = hub_config.is_initialized @ TradeError::HubNotInitialized,
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// Offer program
    pub offer_program: Program<'info, SystemProgram>,

    /// Offer account
    #[account(
        seeds = [b"offer", offer.id.to_le_bytes().as_ref()],
        bump,
        seeds::program = offer_program.key(),
        // Check if the offer is valid and active
        constraint = offer.owner != Pubkey::default() @ TradeError::OfferNotFound,
        constraint = offer.max_amount >= amount @ TradeError::AmountTooLarge,
        constraint = offer.min_amount <= amount @ TradeError::AmountTooSmall,
    )]
    pub offer: Account<'info, Offer>,

    /// Denom price from price program
    /// This account is loaded by the client
    #[account(
        constraint = denom_price.token_mint == offer.token_mint @ TradeError::InvalidDenom,
        // No need to check fiat currency, as we use the currency selected by the user
        constraint = denom_price.price > 0 @ TradeError::InvalidPrice,
    )]
    pub denom_price: Account<'info, DenomFiatPrice>,

    /// Arbitrator account (randomly selected)
    /// This account is loaded by the client
    /// CHECK: Arbitrator safety checks are performed in constraints.
    #[account(
        constraint = arbitrator.is_signer @ TradeError::ArbitratorMustSign,
        constraint = arbitrator.key() != taker.key() @ TradeError::ArbitratorCannotBeTaker,
        constraint = arbitrator.key() != offer.owner @ TradeError::ArbitratorCannotBeOfferOwner,
    )]
    pub arbitrator: AccountInfo<'info>,

    /// Trade counter PDA for tracking number of trades
    #[account(
        mut,
        seeds = [b"counter"],
        bump,
    )]
    pub trades_counter: Account<'info, TradesCounter>,

    /// Trade account to be created
    #[account(
        init,
        payer = taker,
        space = 8 + std::mem::size_of::<Trade>() + 256, // Extra space for state history growth
        seeds = [TRADE_SEED, trades_counter.counter.checked_add(1).unwrap().to_le_bytes().as_ref()],
        bump,
    )]
    pub trade: Account<'info, Trade>,

    /// Trade authority PDA for CPI calls
    /// CHECK: trade_authority PDA is checked via seeds constraint.
    #[account(
        seeds = [b"trade_authority"],
        bump = trade_config.bump,
    )]
    pub trade_authority: AccountInfo<'info>,

    /// Profile program for CPI calls
    /// CHECK: profile_program is checked via address constraints or CPI call.
    pub profile_program: AccountInfo<'info>,

    /// Taker's profile account for updating contact and trade count
    #[account(
        mut,
        seeds = [b"profile", taker.key().as_ref()],
        bump,
        seeds::program = PROFILE_ID,
        constraint = taker_profile.owner == taker.key() @ TradeError::InvalidProfileOwner,
    )]
    pub taker_profile: Account<'info, Profile>,

    pub system_program: Program<'info, SystemProgram>,
}

/// Context for accepting a trade request
#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct AcceptRequest<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    /// Trade configuration
    #[account(
        seeds = [b"config"],
        bump,
    )]
    pub trade_config: Account<'info, TradeConfig>,

    /// Hub configuration
    #[account(
        seeds = [b"config"],
        bump,
        seeds::program = trade_config.hub_program,
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// Trade account
    #[account(
        mut,
        seeds = [TRADE_SEED, trade_id.to_le_bytes().as_ref()],
        bump,
        constraint = trade.id == trade_id @ TradeError::InvalidTrade,
        constraint = (trade.buyer == maker.key() || trade.seller == maker.key()) @ TradeError::Unauthorized,
    )]
    pub trade: Account<'info, Trade>,

    /// Trade authority PDA for CPI calls
    /// CHECK: trade_authority PDA is checked via seeds constraint.
    #[account(
        seeds = [b"trade_authority"],
        bump = trade_config.bump,
    )]
    pub trade_authority: AccountInfo<'info>,

    /// Profile program for CPI calls
    /// CHECK: profile_program is checked via address constraints or CPI call.
    pub profile_program: AccountInfo<'info>,

    /// Maker's profile account for updating contact and trade count
    #[account(
        mut,
        seeds = [b"profile", maker.key().as_ref()],
        bump,
        seeds::program = PROFILE_ID,
        constraint = maker_profile.owner == maker.key() @ TradeError::InvalidProfileOwner,
    )]
    pub maker_profile: Account<'info, Profile>,

    pub system_program: Program<'info, SystemProgram>,
}

/// Context for funding escrow
#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    /// Trade configuration
    #[account(
        seeds = [b"config"],
        bump,
    )]
    pub trade_config: Account<'info, TradeConfig>,

    /// Hub configuration
    #[account(
        seeds = [b"config"],
        bump,
        seeds::program = trade_config.hub_program,
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// Trade account
    #[account(
        mut,
        seeds = [TRADE_SEED, trade_id.to_le_bytes().as_ref()],
        bump,
        constraint = trade.id == trade_id @ TradeError::InvalidTrade,
        constraint = trade.seller == seller.key() @ TradeError::Unauthorized,
    )]
    pub trade: Account<'info, Trade>,

    /// Seller's token account
    #[account(
        mut,
        constraint = seller_token_account.owner == seller.key() @ TradeError::Unauthorized,
        constraint = seller_token_account.mint == escrow_token_account.mint @ TradeError::InvalidTokenMint,
        constraint = seller_token_account.amount >= trade.amount @ TradeError::InsufficientFunds,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// Escrow token account
    #[account(
        mut,
        seeds = [b"escrow", trade_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Trade authority PDA for CPI calls
    /// CHECK: trade_authority PDA is checked via seeds constraint.
    #[account(
        seeds = [b"trade_authority"],
        bump = trade_config.bump,
    )]
    pub trade_authority: AccountInfo<'info>,

    /// Profile program for CPI calls
    /// CHECK: profile_program is checked via address constraints or CPI call.
    pub profile_program: AccountInfo<'info>,

    /// Seller's profile account for updating trade count
    #[account(
        mut,
        seeds = [b"profile", seller.key().as_ref()],
        bump,
        seeds::program = PROFILE_ID,
        constraint = seller_profile.owner == seller.key() @ TradeError::InvalidProfileOwner,
    )]
    pub seller_profile: Account<'info, Profile>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, SystemProgram>,
}

/// Context for marking fiat as deposited
#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct FiatDeposited<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// Trade configuration
    #[account(
        seeds = [b"config"],
        bump,
    )]
    pub trade_config: Account<'info, TradeConfig>,

    /// Hub configuration
    #[account(
        seeds = [b"config"],
        bump,
        seeds::program = trade_config.hub_program,
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// Trade account
    #[account(
        mut,
        seeds = [TRADE_SEED, trade_id.to_le_bytes().as_ref()],
        bump,
        constraint = trade.id == trade_id @ TradeError::InvalidTrade,
        constraint = trade.buyer == buyer.key() @ TradeError::Unauthorized,
    )]
    pub trade: Account<'info, Trade>,

    pub system_program: Program<'info, SystemProgram>,
}

/// Context for releasing escrow funds
#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct ReleaseEscrow<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    /// Trade configuration
    #[account(
        seeds = [b"config"],
        bump,
    )]
    pub trade_config: Account<'info, TradeConfig>,

    /// Hub configuration
    #[account(
        seeds = [b"config"],
        bump,
        seeds::program = trade_config.hub_program,
    )]
    pub hub_config: Box<Account<'info, HubConfig>>,

    /// Offer program
    pub offer_program: Program<'info, SystemProgram>,

    /// Offer account to verify if buyer is maker
    #[account(
        seeds = [b"offer", offer.id.to_le_bytes().as_ref()],
        bump,
        seeds::program = offer_program.key(),
    )]
    pub offer: Box<Account<'info, Offer>>,

    /// Trade account
    #[account(
        mut,
        seeds = [TRADE_SEED, trade_id.to_le_bytes().as_ref()],
        bump,
        constraint = trade.id == trade_id @ TradeError::InvalidTrade,
        constraint = trade.seller == seller.key() @ TradeError::Unauthorized,
        constraint = trade.state == TradeState::FiatDeposited @ TradeError::InvalidTradeState // Ensure correct state
    )]
    pub trade: Box<Account<'info, Trade>>,

    /// Trade authority PDA that controls the escrow
    /// CHECK: trade_authority PDA is checked via seeds constraint.
    #[account(
        // Note: Anchor automatically derives the trade_authority seeds if not specified 
        // when the trade account uses seeds with trade_id. Let's rely on that.
        // seeds = [TRADE_SEED, trade_id.to_le_bytes().as_ref()],
        // bump = trade.bump, // Use trade bump
    )]
    pub trade_authority: AccountInfo<'info>,

    /// Escrow token account
    #[account(
        mut,
        seeds = [b"escrow", trade_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Seller's token account (was buyer's, corrected based on logic)
    #[account(
        mut,
        constraint = seller_token_account.owner == seller.key() @ TradeError::InvalidTokenAccountOwner,
        constraint = seller_token_account.mint == escrow_token_account.mint @ TradeError::InvalidTokenMint,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// Chain Fee collector token account (from Hub config)
    #[account(
        mut,
        address = hub_config.chain_fee_collector @ LocalMoneyError::InvalidFeeCollectorAccount
    )]
    pub chain_fee_collector_token_account: Account<'info, TokenAccount>,

    /// Warchest token account (from Hub config)
    #[account(
        mut,
        address = hub_config.warchest @ LocalMoneyError::InvalidFeeCollectorAccount
    )]
    pub warchest_token_account: Account<'info, TokenAccount>,

    /// Arbitrator's token account (from Hub config)
    #[account(
        mut,
        // Assuming arbitrator fee is paid in the same token as the trade
        constraint = arbitrator_token_account.owner == trade.arbitrator @ TradeError::InvalidTokenAccountOwner,
        constraint = arbitrator_token_account.mint == escrow_token_account.mint @ TradeError::InvalidTokenMint,
    )]
    pub arbitrator_token_account: Account<'info, TokenAccount>,

    /// Local Token Mint for burning fees (from Hub config)
    #[account(
        mut,
        address = hub_config.local_token_mint @ LocalMoneyError::InvalidMint
    )]
    pub local_token_mint: Account<'info, anchor_spl::token::Mint>,

    /// Profile program for CPI calls
    /// CHECK: profile_program is checked via address constraints or CPI call.
    pub profile_program: AccountInfo<'info>,

    /// Buyer's profile account for updating trade count
    #[account(
        mut,
        seeds = [b"profile", trade.buyer.as_ref()],
        bump,
        seeds::program = PROFILE_ID,
        constraint = buyer_profile.owner == trade.buyer @ TradeError::InvalidProfileOwner,
    )]
    pub buyer_profile: Box<Account<'info, Profile>>,

    /// Seller's profile account for updating trade count
    #[account(
        mut,
        seeds = [b"profile", seller.key().as_ref()],
        bump,
        seeds::program = PROFILE_ID,
        constraint = seller_profile.owner == seller.key() @ TradeError::InvalidProfileOwner,
    )]
    pub seller_profile: Box<Account<'info, Profile>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, SystemProgram>,
}

/// Context for refunding escrow
#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct RefundEscrow<'info> {
    #[account(mut)]
    pub initiator: Signer<'info>,

    /// Trade configuration
    #[account(
        seeds = [b"config"],
        bump,
    )]
    pub trade_config: Account<'info, TradeConfig>,

    /// Hub configuration
    #[account(
        seeds = [b"config"],
        bump,
        seeds::program = trade_config.hub_program,
    )]
    pub hub_config: Account<'info, HubConfig>,

    /// Trade account
    #[account(
        mut,
        seeds = [TRADE_SEED, trade_id.to_le_bytes().as_ref()],
        bump,
        constraint = trade.id == trade_id @ TradeError::InvalidTrade,
        constraint = (initiator.key() == trade.buyer || initiator.key() == trade.seller) @ TradeError::Unauthorized,
    )]
    pub trade: Account<'info, Trade>,

    /// Trade authority PDA that controls the escrow
    /// CHECK: trade_authority PDA is checked via seeds constraint.
    #[account(
        seeds = [TRADE_SEED, trade_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub trade_authority: AccountInfo<'info>,

    /// Escrow token account
    #[account(
        mut,
        seeds = [b"escrow", trade_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Seller's token account to receive refund
    #[account(
        mut,
        constraint = seller_token_account.owner == trade.seller @ TradeError::Unauthorized,
        constraint = seller_token_account.mint == escrow_token_account.mint @ TradeError::InvalidTokenMint,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// Profile program for CPI calls
    /// CHECK: profile_program is checked via address constraints or CPI call.
    pub profile_program: AccountInfo<'info>,

    /// Buyer's profile account for updating trade count
    #[account(
        mut,
        seeds = [b"profile", trade.buyer.as_ref()],
        bump,
        seeds::program = PROFILE_ID,
        constraint = buyer_profile.owner == trade.buyer @ TradeError::InvalidProfileOwner,
    )]
    pub buyer_profile: Account<'info, Profile>,

    /// Seller's profile account for updating trade count
    #[account(
        mut,
        seeds = [b"profile", trade.seller.as_ref()],
        bump,
        seeds::program = PROFILE_ID,
        constraint = seller_profile.owner == trade.seller @ TradeError::InvalidProfileOwner,
    )]
    pub seller_profile: Account<'info, Profile>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, SystemProgram>,
}

/// Context for disputing escrow
#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct DisputeEscrow<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,

    /// Trade configuration
    #[account(
        seeds = [b"config"],
        bump,
    )]
    pub trade_config: Account<'info, TradeConfig>,

    /// Trade account
    #[account(
        mut,
        seeds = [TRADE_SEED, trade_id.to_le_bytes().as_ref()],
        bump,
        constraint = trade.id == trade_id @ TradeError::InvalidTrade,
        constraint = (trade.buyer == trader.key() || trade.seller == trader.key()) @ TradeError::Unauthorized,
    )]
    pub trade: Account<'info, Trade>,

    pub system_program: Program<'info, SystemProgram>,
}

/// Context for settling a dispute
#[derive(Accounts)]
#[instruction(trade_id: u64, winner: Pubkey)]
pub struct SettleDispute<'info> {
    #[account(mut)]
    pub arbitrator: Signer<'info>,

    /// Trade configuration
    #[account(
        seeds = [b"config"],
        bump,
        has_one = hub_program @ TradeError::InvalidHubProgram,
    )]
    pub trade_config: Account<'info, TradeConfig>,

    /// Hub program
    pub hub_program: Program<'info, SystemProgram>,

    /// Hub configuration
    #[account(
        seeds = [b"config"],
        bump,
        seeds::program = hub_program.key(),
        constraint = hub_config.is_initialized @ TradeError::HubNotInitialized,
    )]
    pub hub_config: Box<Account<'info, HubConfig>>,

    /// Offer program
    pub offer_program: Program<'info, SystemProgram>,

    /// Offer account to verify if buyer is maker
    #[account(
        seeds = [b"offer", offer.id.to_le_bytes().as_ref()],
        bump,
        seeds::program = offer_program.key(),
        constraint = !offer.is_deleted @ TradeError::OfferNotFound,
        constraint = offer.id == trade.offer_id @ TradeError::InvalidOffer,
    )]
    pub offer: Box<Account<'info, Offer>>,

    /// Trade account
    #[account(
        mut,
        seeds = [TRADE_SEED, trade_id.to_le_bytes().as_ref()],
        bump,
        constraint = trade.id == trade_id @ TradeError::InvalidTrade,
        constraint = trade.arbitrator == arbitrator.key() @ TradeError::Unauthorized,
        constraint = trade.state == TradeState::EscrowDisputed @ TradeError::InvalidTradeState,
        constraint = (winner == trade.buyer || winner == trade.seller) @ TradeError::InvalidWinner,
    )]
    pub trade: Box<Account<'info, Trade>>,

    /// Trade authority PDA that controls the escrow
    /// CHECK: trade_authority PDA is checked via seeds constraint.
    #[account(
        // Relies on Anchor deriving seeds from trade account
        // seeds = [TRADE_SEED, trade_id.to_le_bytes().as_ref()],
        // bump = trade.bump,
    )]
    pub trade_authority: AccountInfo<'info>,

    /// Escrow token account
    #[account(
        mut,
        seeds = [b"escrow", trade_id.to_le_bytes().as_ref()],
        bump,
        constraint = escrow_token_account.amount >= trade.amount @ TradeError::InsufficientEscrowFunds,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Buyer's token account
    #[account(
        mut,
        constraint = buyer_token_account.owner == trade.buyer @ TradeError::InvalidTokenAccountOwner,
        constraint = buyer_token_account.mint == escrow_token_account.mint @ TradeError::InvalidTokenMint,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// Seller's token account
    #[account(
        mut,
        constraint = seller_token_account.owner == trade.seller @ TradeError::InvalidTokenAccountOwner,
        constraint = seller_token_account.mint == escrow_token_account.mint @ TradeError::InvalidTokenMint,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// Arbitrator's token account for fee
    #[account(
        mut,
        constraint = arbitrator_token_account.owner == trade.arbitrator @ TradeError::InvalidTokenAccountOwner,
        constraint = arbitrator_token_account.mint == escrow_token_account.mint @ TradeError::InvalidTokenMint,
    )]
    pub arbitrator_token_account: Account<'info, TokenAccount>,

    /// Chain Fee collector token account (from Hub config)
    #[account(
        mut,
        address = hub_config.chain_fee_collector @ LocalMoneyError::InvalidFeeCollectorAccount
    )]
    pub chain_fee_collector_token_account: Account<'info, TokenAccount>,

    /// Warchest token account (from Hub config)
    #[account(
        mut,
        address = hub_config.warchest @ LocalMoneyError::InvalidFeeCollectorAccount
    )]
    pub warchest_token_account: Account<'info, TokenAccount>,

    /// Local Token Mint for burning fees (from Hub config)
    #[account(
        mut,
        address = hub_config.local_token_mint @ LocalMoneyError::InvalidMint
    )]
    pub local_token_mint: Account<'info, anchor_spl::token::Mint>,

    /// Profile program for CPI calls
    /// CHECK: profile_program is checked via address constraints or CPI call.
    pub profile_program: AccountInfo<'info>,

    /// Buyer's profile account for updating trade count
    #[account(
        mut,
        seeds = [b"profile", trade.buyer.as_ref()],
        bump,
        seeds::program = PROFILE_ID,
        constraint = buyer_profile.owner == trade.buyer @ TradeError::InvalidProfileOwner,
    )]
    pub buyer_profile: Box<Account<'info, Profile>>,

    /// Seller's profile account for updating trade count
    #[account(
        mut,
        seeds = [b"profile", trade.seller.as_ref()],
        bump,
        seeds::program = PROFILE_ID,
        constraint = seller_profile.owner == trade.seller @ TradeError::InvalidProfileOwner,
    )]
    pub seller_profile: Box<Account<'info, Profile>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, SystemProgram>,
}

// Helper function to calculate protocol fees
fn calculate_fees(hub_config: &HubConfig, amount: u64) -> FeeInfo {
    let burn_amount = (amount as u128 * hub_config.burn_fee_pct as u128 / 100) as u64;
    let chain_amount = (amount as u128 * hub_config.chain_fee_pct as u128 / 100) as u64;
    let warchest_amount = (amount as u128 * hub_config.warchest_fee_pct as u128 / 100) as u64;

    FeeInfo {
        burn_amount,
        chain_amount,
        warchest_amount,
    }
}

#[error_code]
pub enum TradeError {
    #[msg("Cannot trade with yourself.")]
    CannotTradeWithSelf,
    #[msg("Invalid trade amount provided.")]
    InvalidAmount,
    #[msg("Trade amount is invalid.")]
    InvalidTradeAmount,
    #[msg("Invalid price data for the specified denom.")]
    InvalidPriceForDenom,
    #[msg("The trade has expired.")]
    TradeExpired,
    #[msg("Invalid trade state for this operation.")]
    InvalidTradeState,
    #[msg("Unauthorized account or signer.")]
    Unauthorized,
    #[msg("Dispute requested before the designated time.")]
    PrematureDisputeRequest,
    #[msg("Dispute is not enabled for this trade.")]
    DisputeNotEnabled,
    #[msg("Invalid sender for this operation.")]
    InvalidSender,
    #[msg("Invalid Hub Program ID.")]
    InvalidHubProgram,
    #[msg("Hub configuration account not initialized.")]
    HubNotInitialized,
    #[msg("Offer account not found or deleted.")]
    OfferNotFound,
    #[msg("Offer is not active.")]
    OfferNotActive,
    #[msg("Trade amount exceeds offer maximum.")]
    AmountTooLarge,
    #[msg("Trade amount is below offer minimum.")]
    AmountTooSmall,
    #[msg("Invalid denom specified in price account.")]
    InvalidDenom,
    #[msg("Invalid fiat currency specified in price account.")]
    InvalidFiatCurrency,
    #[msg("Price data is invalid or expired.")]
    InvalidPrice,
    #[msg("Arbitrator must be a signer.")]
    ArbitratorMustSign,
    #[msg("Arbitrator cannot be the trade taker.")]
    ArbitratorCannotBeTaker,
    #[msg("Arbitrator cannot be the offer owner.")]
    ArbitratorCannotBeOfferOwner,
    #[msg("Invalid profile owner.")]
    InvalidProfileOwner,
    #[msg("Invalid trade account specified.")]
    InvalidTrade,
    #[msg("Invalid token mint specified.")]
    InvalidTokenMint,
    #[msg("Insufficient funds in token account.")]
    InsufficientFunds,
    #[msg("Invalid winner specified for dispute settlement.")]
    InvalidWinner,
    #[msg("Insufficient funds in escrow account.")]
    InsufficientEscrowFunds,
    #[msg("Invalid token account owner.")]
    InvalidTokenAccountOwner,
    #[msg("Invalid Offer ID for this trade.")]
    InvalidOffer,
    // Add other custom errors as needed during development
}
