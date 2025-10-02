use cosmwasm_std::{entry_point, Binary, Deps, DepsMut, Env, MessageInfo, Response, to_json_binary};
use cw2::{get_contract_version, set_contract_version};

use crate::state::ADMIN;
use crate::{commands, queries};
use localmoney_protocol::errors::ContractError;
use localmoney_protocol::guards::assert_migration_parameters;
use localmoney_protocol::hub::{
    Admin, ExecuteMsg, InstantiateMsg, MigrateMsg, QueryMsg,
};

const CONTRACT_NAME: &str = env!("CARGO_PKG_NAME");
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    let admin = Admin {
        addr: msg.admin_addr.clone(),
    };
    ADMIN.save(deps.storage, &admin)?;

    Ok(Response::new()
        .add_attribute("action", "instantiate_hub")
        .add_attribute("admin_addr", msg.admin_addr.to_string()))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::UpdateConfig(config) => commands::update_config(deps, info, config),
        ExecuteMsg::UpdateAdmin { admin_addr } => commands::update_admin(deps, info, admin_addr),
    }
}


#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> Result<Binary, ContractError> {
    match msg {
        QueryMsg::Config {} => Ok(to_json_binary(&queries::query_config(deps)?)?),
        QueryMsg::Admin {} => Ok(to_json_binary(&queries::query_admin(deps)?)?),
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(deps: DepsMut, _env: Env, _msg: MigrateMsg) -> Result<Response, ContractError> {
    let previous_contract_version = get_contract_version(deps.storage).unwrap();

    assert_migration_parameters(
        previous_contract_version.clone(),
        CONTRACT_NAME.to_string(),
        CONTRACT_VERSION,
    )
    .unwrap();

    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION).unwrap();
    // If the structure of the data in storage changes, we must treat it here

    Ok(Response::default()
        .add_attribute("previous_version", previous_contract_version.version)
        .add_attribute("new_version", CONTRACT_VERSION)
        .add_attribute("name", CONTRACT_NAME))
}
