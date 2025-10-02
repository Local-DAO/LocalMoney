use cosmwasm_std::{Deps, StdError, StdResult};

use crate::state::OFFERS_COUNT;
use localmoney_protocol::hub_utils::get_hub_config;
use localmoney_protocol::offer::{
    offers, OfferResponse, OffersCount, OfferState, FiatOffersCount,
};
use localmoney_protocol::currencies::FiatCurrency;
use localmoney_protocol::profile::load_profile;

/// Queries the current state (offers count)
pub fn query_state(deps: Deps) -> StdResult<OffersCount> {
    OFFERS_COUNT.load(deps.storage)
}

/// Loads an offer by its ID with profile information
pub fn load_offer_by_id(deps: Deps, id: u64) -> StdResult<OfferResponse> {
    let hub_config = get_hub_config(deps);
    let offer = offers()
        .may_load(deps.storage, id)?
        .ok_or_else(|| StdError::not_found("Offer"))?;
    
    let profile = load_profile(
        &deps.querier,
        hub_config.profile_addr.to_string(),
        offer.owner.clone(),
    )?;
    
    Ok(OfferResponse { offer, profile })
}

/// Counts offers by their states
pub fn count_offers_by_states(deps: Deps, states: Vec<OfferState>) -> StdResult<OffersCount> {
    let mut count = 0u64;
    
    // Iterate through all offers and count those matching the requested states
    let all_offers = offers()
        .range(deps.storage, None, None, cosmwasm_std::Order::Ascending);
    
    for result in all_offers {
        let (_, offer) = result?;
        if states.contains(&offer.state) {
            count += 1;
        }
    }
    
    Ok(OffersCount { count })
}

/// Counts offers for all fiat currencies by states
pub fn count_all_fiats_offers(deps: Deps, states: Vec<OfferState>) -> StdResult<Vec<FiatOffersCount>> {
    use std::collections::HashMap;
    
    let mut fiat_counts: HashMap<FiatCurrency, u64> = HashMap::new();
    
    // Iterate through all offers and count by fiat currency
    let all_offers = offers()
        .range(deps.storage, None, None, cosmwasm_std::Order::Ascending);
    
    for result in all_offers {
        let (_, offer) = result?;
        if states.contains(&offer.state) {
            *fiat_counts.entry(offer.fiat_currency).or_insert(0) += 1;
        }
    }
    
    // Convert to vector and sort by count (descending)
    let mut result: Vec<FiatOffersCount> = fiat_counts
        .into_iter()
        .map(|(fiat, count)| FiatOffersCount { fiat, count })
        .collect();
    
    result.sort_by(|a, b| b.count.cmp(&a.count));
    
    Ok(result)
}