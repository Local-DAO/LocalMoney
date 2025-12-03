use crate::state::OFFERS_COUNT;
use crate::{commands, queries};
use cosmwasm_std::{
    entry_point, to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, 
    StdResult,
};
use cw2::{get_contract_version, set_contract_version};
use localmoney_protocol::errors::ContractError;
use localmoney_protocol::guards::assert_migration_parameters;
use localmoney_protocol::offer::{
    ExecuteMsg, InstantiateMsg, MigrateMsg, OfferModel, OffersCount, QueryMsg,
};

const CONTRACT_NAME: &str = env!("CARGO_PKG_NAME");
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    _msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    // Convert any StdError into ContractError explicitly.
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)
        .map_err(ContractError::Std)?;
    OFFERS_COUNT
        .save(deps.storage, &OffersCount { count: 0 })
        .map_err(ContractError::Std)?;
    Ok(Response::new().add_attribute("action", "instantiate_offer"))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::RegisterHub {} => commands::register_hub(deps, info),
        ExecuteMsg::Create { offer } => commands::create_offer(deps, env, info, offer),
        ExecuteMsg::UpdateOffer { offer_update } => commands::update_offer(deps, env, info, offer_update),
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::State {} => to_json_binary(&queries::query_state(deps)?),
        QueryMsg::Offer { id } => to_json_binary(&queries::load_offer_by_id(deps, id)?),
        QueryMsg::OffersBy {
            offer_type,
            fiat_currency,
            denom,
            order,
            limit,
            last,
        } => to_json_binary(&OfferModel::query_by(
            deps,
            offer_type,
            fiat_currency,
            denom,
            order,
            limit,
            last,
        )?),
        QueryMsg::OffersByOwner { owner, limit, last } => {
            to_json_binary(&OfferModel::query_by_owner(deps, owner, limit, last)?)
        }
        QueryMsg::OffersCountByStates { states } => {
            to_json_binary(&queries::count_offers_by_states(deps, states)?)
        }
        QueryMsg::AllFiatsOffersCount { states } => {
            to_json_binary(&queries::count_all_fiats_offers(deps, states)?)
        }
    }
}


#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(deps: DepsMut, _env: Env, _msg: MigrateMsg) -> Result<Response, ContractError> {
    let previous_contract_version =
        get_contract_version(deps.storage).map_err(ContractError::Std)?;
    assert_migration_parameters(
        previous_contract_version.clone(),
        CONTRACT_NAME.to_string(),
        CONTRACT_VERSION,
    )?;
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)
        .map_err(ContractError::Std)?;
    Ok(Response::new()
        .add_attribute("previous_version", previous_contract_version.version)
        .add_attribute("new_version", CONTRACT_VERSION)
        .add_attribute("name", CONTRACT_NAME))
}
