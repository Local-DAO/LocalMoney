use cosmwasm_std::{DepsMut, Env, MessageInfo, Response, SubMsg};

use crate::state::OFFERS_COUNT;
use localmoney_protocol::errors::ContractError;
use localmoney_protocol::errors::ContractError::HubAlreadyRegistered;
use localmoney_protocol::guards::{
    assert_min_g_max, assert_offer_description_valid, assert_ownership,
};
use localmoney_protocol::hub_utils::{get_hub_config, register_hub_internal};
use localmoney_protocol::offer::{
    Offer, OfferModel, OfferMsg, OfferState, OfferUpdateMsg,
};
use localmoney_protocol::profile::{
    update_profile_active_offers_msg, update_profile_contact_msg,
};

/// Registers the hub contract address
pub fn register_hub(deps: DepsMut, info: MessageInfo) -> Result<Response, ContractError> {
    register_hub_internal::<ContractError, ContractError>(
        info.sender,
        deps.storage,
        HubAlreadyRegistered {},
    )?;
    Ok(Response::new().add_attribute("action", "register_hub"))
}

/// Creates a new offer
pub fn create_offer(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: OfferMsg,
) -> Result<Response, ContractError> {
    // Validate input parameters
    assert_min_g_max(msg.min_amount, msg.max_amount)?;
    assert_offer_description_valid(msg.description.clone())?;

    let hub_config = get_hub_config(deps.as_ref());

    // Load and increment offers count for next sequential ID
    let mut offers_count = OFFERS_COUNT
        .load(deps.storage)
        .map_err(ContractError::Std)?;
    offers_count.count = offers_count.count.checked_add(1).ok_or_else(|| {
        ContractError::InvalidParameter {
            parameter: "offers_count".to_string(),
            message: Some("Overflow when incrementing offer count".to_string()),
        }
    })?;
    let offer_id = offers_count.count;

    // Create the offer
    let offer = OfferModel::create(
        deps.storage,
        Offer {
            id: offer_id,
            owner: info.sender.clone(),
            offer_type: msg.offer_type,
            fiat_currency: msg.fiat_currency.clone(),
            rate: msg.rate,
            denom: msg.denom,
            min_amount: msg.min_amount,
            max_amount: msg.max_amount,
            state: OfferState::Active,
            description: msg.description,
            timestamp: env.block.time.seconds(),
        },
    )
    .offer;

    // Save updated offers count
    OFFERS_COUNT
        .save(deps.storage, &offers_count)
        .map_err(ContractError::Std)?;

    // Prepare sub-messages for profile updates
    let update_profile_contact_msg = update_profile_contact_msg(
        hub_config.profile_addr.to_string(),
        info.sender.clone(),
        msg.owner_contact.clone(),
        msg.owner_encryption_key.clone(),
    );

    let update_profile_offers_msg = update_profile_active_offers_msg(
        hub_config.profile_addr.to_string(),
        info.sender.clone(),
        offer.state,
    );

    Ok(Response::new()
        .add_submessage(update_profile_contact_msg)
        .add_submessage(update_profile_offers_msg)
        .add_attribute("action", "create_offer")
        .add_attribute("type", offer.offer_type.to_string())
        .add_attribute("id", offer.id.to_string())
        .add_attribute("rate", offer.rate.to_string())
        .add_attribute("min_amount", offer.min_amount.to_string())
        .add_attribute("max_amount", offer.max_amount.to_string())
        .add_attribute("owner", offer.owner.to_string()))
}

/// Updates an existing offer
pub fn update_offer(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: OfferUpdateMsg,
) -> Result<Response, ContractError> {
    // Validate input parameters
    assert_min_g_max(msg.min_amount, msg.max_amount)?;
    assert_offer_description_valid(msg.description.clone())?;

    let hub_config = get_hub_config(deps.as_ref());
    let mut offer_model = OfferModel::may_load(deps.storage, msg.id);

    // Check ownership
    assert_ownership(info.sender.clone(), offer_model.offer.owner.clone())?;

    // Prepare sub-messages for profile updates
    let mut sub_msgs: Vec<SubMsg> = Vec::new();
    
    // Update contact info if provided
    if msg.owner_contact.is_some() && msg.owner_encryption_key.is_some() {
        sub_msgs.push(update_profile_contact_msg(
            hub_config.profile_addr.to_string(),
            info.sender.clone(),
            msg.owner_contact.clone().unwrap(),
            msg.owner_encryption_key.clone().unwrap(),
        ));
    }
    
    // Update active offers count if state changed
    if msg.state != offer_model.offer.state {
        sub_msgs.push(update_profile_active_offers_msg(
            hub_config.profile_addr.to_string(),
            info.sender.clone(),
            msg.state.clone(),
        ))
    }

    // Update the offer
    let offer = offer_model.update(msg);

    Ok(Response::new()
        .add_submessages(sub_msgs)
        .add_attribute("action", "update_offer")
        .add_attribute("id", offer.id.to_string())
        .add_attribute("owner", offer.owner.to_string()))
}