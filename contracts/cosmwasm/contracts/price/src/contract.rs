#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{
    to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult, Uint128, Uint256,
};
use cw2::{get_contract_version, set_contract_version};
use cw20::Denom;
use localmoney_protocol::currencies::FiatCurrency;
use localmoney_protocol::denom_utils::denom_to_string;
use localmoney_protocol::errors::ContractError;
use localmoney_protocol::errors::ContractError::HubAlreadyRegistered;
use localmoney_protocol::guards::{assert_migration_parameters, assert_ownership};
use localmoney_protocol::hub_utils::{get_hub_admin, get_hub_config, register_hub_internal};
use localmoney_protocol::price::{
    CurrencyPrice, DenomFiatPrice, ExecuteMsg, PriceRoute, QueryMsg, DENOM_PRICE_ROUTE, FIAT_PRICE,
};
use localmoney_protocol::profile::{InstantiateMsg, MigrateMsg};

// version info for migration info
pub const CONTRACT_NAME: &str = env!("CARGO_PKG_NAME");
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    _msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION).unwrap();
    let res = Response::new().add_attribute("action", "instantiate_price");
    Ok(res)
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::RegisterHub {} => register_hub(deps, info),
        ExecuteMsg::UpdatePrices(prices) => update_prices(deps, env, info, prices),
        ExecuteMsg::RegisterPriceRouteForDenom { denom, route } => {
            register_price_route_for_denom(deps, info, denom, route)
        }
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Price { fiat, denom } => {
            to_json_binary(&query_fiat_price_for_denom(deps, fiat, denom)?)
        }
        QueryMsg::GetFiatPrice { currency } => to_json_binary(&query_fiat_price(deps, &currency)?),
    }
}

fn register_hub(deps: DepsMut, info: MessageInfo) -> Result<Response, ContractError> {
    register_hub_internal(info.sender, deps.storage, HubAlreadyRegistered {})
}

pub fn update_prices(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    prices: Vec<CurrencyPrice>,
) -> Result<Response, ContractError> {
    let hub_cfg = get_hub_config(deps.as_ref());
    assert_ownership(info.sender, hub_cfg.price_provider_addr)?;
    let mut attrs: Vec<(&str, String)> = vec![("action", "update_prices".to_string())];
    prices.iter().for_each(|price| {
        // Load existing object or default
        let path = FIAT_PRICE.key(price.currency.to_string().as_str());
        let mut currency_price = path
            .load(deps.storage)
            .unwrap_or(CurrencyPrice::new(price.currency.clone()));

        // Update price
        currency_price.usd_price = price.usd_price;
        currency_price.updated_at = env.block.time.seconds();
        path.save(deps.storage, &currency_price).unwrap();
        attrs.push(("currency", price.currency.to_string()));
        attrs.push(("usd_price", price.usd_price.to_string()));
    });
    let res = Response::new().add_attributes(attrs);
    Ok(res)
}

pub fn register_price_route_for_denom(
    deps: DepsMut,
    info: MessageInfo,
    denom: Denom,
    route: Vec<PriceRoute>,
) -> Result<Response, ContractError> {
    let admin = get_hub_admin(deps.as_ref()).addr;
    assert_ownership(info.sender, admin)?;

    let denom_str = denom_to_string(&denom.clone());
    DENOM_PRICE_ROUTE
        .save(deps.storage, denom_str.as_str(), &route)
        .unwrap();

    let mut attrs = vec![
        ("action".to_string(), "register_price".to_string()),
        ("denom".to_string(), denom_str),
    ];
    route
        .iter()
        .for_each(|step| attrs.push(("route_step".to_string(), step.to_string())));
    let res = Response::default().add_attributes(attrs);
    Ok(res)
}

pub fn query_fiat_price_for_denom(
    deps: Deps,
    fiat: FiatCurrency,
    denom: Denom,
) -> StdResult<DenomFiatPrice> {
    // TODO: Workaround while we don't implement IBC Queries.
    // We can only support stablecoins for now, assuming they're pegged.
    let fiat_price = query_fiat_price(deps, &fiat)?;
    Ok(DenomFiatPrice {
        denom,
        fiat,
        price: Uint256::from_uint128(fiat_price.usd_price),
    })
    // // Get the denom string to query the price route
    // let denom_str = denom_to_string(&denom);
    // let price_route = DENOM_PRICE_ROUTE.load(deps.storage, &denom_str);
    // let price_route = match price_route {
    //     Ok(route) => {
    //         if route.is_empty() {
    //             return Err(StdError::generic_err(format!("No price route configured for {}", denom_str)));
    //         }
    //         route.get(0).unwrap().clone()
    //     }
    //     Err(_e) => return Err(StdError::generic_err(format!("No price route for {}", denom_str))),
    // };

    // // Query the price of denom in USDC
    // let one = "1000000";
    // let denom_price_result: SimulationResponseData = deps
    //     .querier
    //     .query_wasm_smart(
    //         &price_route.pool.clone(),
    //         &SwapSimulation {
    //             simulation: Simulation {
    //                 offer_asset: OfferAsset {
    //                     info: AssetInfo {
    //                         native_token: NativeToken {
    //                             denom: denom_to_string(&price_route.offer_asset),
    //                         },
    //                     },
    //                     amount: one.to_string(),
    //                 },
    //             },
    //         },
    //     )
    //     .unwrap();
    // let denom_usdc_price = Uint256::from(denom_price_result.return_amount.u128());
    // // If fiat is USD, we don't need to query the price
    // let fiat_price = match fiat {
    //     FiatCurrency::USD => CurrencyPrice {
    //         currency: FiatCurrency::USD,
    //         usd_price: Uint128::new(100u128),
    //         updated_at: 0,
    //     },
    //     _ => FIAT_PRICE.load(deps.storage, fiat.to_string().as_str())?,
    // };

    // // Calculate the price of the denom in fiat
    // let fiat_usd = Uint256::from(fiat_price.usd_price);
    // let decimal_places = 1_000_000u128;
    // let denom_fiat_price = fiat_usd
    //     .mul(&denom_usdc_price)
    //     .div(Uint256::from(decimal_places));
    // Ok(DenomFiatPrice {
    //     denom,
    //     fiat,
    //     price: denom_fiat_price,
    // })
}

pub fn query_fiat_price(deps: Deps, currency: &FiatCurrency) -> StdResult<CurrencyPrice> {
    // For USD, return a fixed rate
    if *currency == FiatCurrency::USD {
        return Ok(CurrencyPrice {
            currency: FiatCurrency::USD,
            usd_price: Uint128::new(100u128), // 100 cents = 1 USD
            updated_at: 0,
        });
    }

    // For other currencies, load from storage
    FIAT_PRICE.load(deps.storage, currency.to_string().as_str())
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
