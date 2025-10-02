use cosmwasm_std::{
    to_json_binary, Addr, CosmosMsg, Decimal, DepsMut, MessageInfo, Response, SubMsg, Uint64, WasmMsg,
};

use crate::state::{ADMIN, CONFIG};
use localmoney_protocol::errors::ContractError;
use localmoney_protocol::errors::ContractError::Unauthorized;
use localmoney_protocol::hub::{Admin, HubConfig};
use localmoney_protocol::offer::ExecuteMsg::RegisterHub as OfferRegisterHub;
use localmoney_protocol::price::ExecuteMsg::RegisterHub as PriceRegisterHub;
use localmoney_protocol::profile::ExecuteMsg::RegisterHub as ProfileRegisterHub;
use localmoney_protocol::trade::ExecuteMsg::RegisterHub as TradeRegisterHub;
use localmoney_protocol::constants::{
    MAX_PLATFORM_FEE, MAX_TRADE_DISPUTE_TIMER, MAX_TRADE_EXPIRATION_TIMER,
};

/// Updates the hub configuration
pub fn update_config(
    deps: DepsMut,
    info: MessageInfo,
    config: HubConfig,
) -> Result<Response, ContractError> {
    // Check authorization
    let admin = ADMIN.load(deps.storage)?;
    if !info.sender.eq(&admin.addr) {
        return Err(Unauthorized {
            owner: admin.addr.clone(),
            caller: info.sender.clone(),
        });
    }

    // Validate configuration parameters
    validate_config(&config)?;
    
    // Save configuration
    save_config(deps.storage, &config)?;

    // Create sub-messages to register hub with all contracts
    let offer_register_hub = SubMsg::new(CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: config.offer_addr.to_string(),
        msg: to_json_binary(&OfferRegisterHub {})?,
        funds: info.funds.clone(),
    }));

    let price_register_hub = SubMsg::new(CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: config.price_addr.to_string(),
        msg: to_json_binary(&PriceRegisterHub {})?,
        funds: info.funds.clone(),
    }));

    let profile_register_hub = SubMsg::new(CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: config.profile_addr.to_string(),
        msg: to_json_binary(&ProfileRegisterHub {})?,
        funds: info.funds.clone(),
    }));

    let trade_register_hub = SubMsg::new(CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: config.trade_addr.to_string(),
        msg: to_json_binary(&TradeRegisterHub {})?,
        funds: info.funds,
    }));

    Ok(Response::new()
        .add_attribute("action", "update_config")
        .add_submessage(offer_register_hub)
        .add_submessage(price_register_hub)
        .add_submessage(profile_register_hub)
        .add_submessage(trade_register_hub))
}

/// Updates the admin address
pub fn update_admin(
    deps: DepsMut,
    info: MessageInfo,
    admin_addr: Addr,
) -> Result<Response, ContractError> {
    // Check authorization
    let admin = ADMIN.load(deps.storage)?;
    if !info.sender.eq(&admin.addr) {
        return Err(Unauthorized {
            owner: admin.addr.clone(),
            caller: info.sender.clone(),
        });
    }

    // Update admin
    let new_admin = Admin {
        addr: admin_addr.clone(),
    };
    ADMIN.save(deps.storage, &new_admin)?;

    Ok(Response::new()
        .add_attribute("action", "update_admin")
        .add_attribute("new_admin", admin_addr.to_string()))
}

/// Validates the hub configuration
fn validate_config(config: &HubConfig) -> Result<(), ContractError> {
    // Validate platform fees - sum of all fees must be <= MAX_PLATFORM_FEE
    let total_fee = config.chain_fee_pct + config.burn_fee_pct + config.warchest_fee_pct;
    
    if total_fee > Decimal::percent(MAX_PLATFORM_FEE) {
        return Err(ContractError::InvalidPlatformFee {
            max_platform_fee: Uint64::new(MAX_PLATFORM_FEE),
        });
    }

    // Validate timers
    if config.trade_expiration_timer > MAX_TRADE_EXPIRATION_TIMER {
        return Err(ContractError::InvalidParameter {
            parameter: "trade_expiration_timer".to_string(),
            message: Some(format!(
                "Must be <= {MAX_TRADE_EXPIRATION_TIMER}"
            )),
        });
    }

    if config.trade_dispute_timer > MAX_TRADE_DISPUTE_TIMER {
        return Err(ContractError::InvalidParameter {
            parameter: "trade_dispute_timer".to_string(),
            message: Some(format!(
                "Must be <= {MAX_TRADE_DISPUTE_TIMER}"
            )),
        });
    }

    Ok(())
}

/// Saves the hub configuration to storage
fn save_config(
    storage: &mut dyn cosmwasm_std::Storage,
    config: &HubConfig,
) -> Result<(), ContractError> {
    CONFIG.save(storage, config)?;
    Ok(())
}