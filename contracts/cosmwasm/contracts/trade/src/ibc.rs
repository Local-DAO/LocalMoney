use cosmwasm_std::{
    entry_point, from_binary, to_binary, Binary, DepsMut, Env, IbcBasicResponse, IbcChannel,
    IbcChannelCloseMsg, IbcChannelConnectMsg, IbcChannelOpenMsg, IbcChannelOpenResponse, IbcOrder,
    IbcPacketAckMsg, IbcPacketReceiveMsg, IbcPacketTimeoutMsg, IbcReceiveResponse, MessageInfo,
    StdResult,
};
use cw_storage_plus::Map;
use localmoney_protocol::{errors::ContractError, guards::assert_auth, trade::NewTrade};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// (channel_id) -> count. Reset on channel closure.
pub const CONNECTION_COUNTS: Map<String, u32> = Map::new("connection_counts");
/// (channel_id) -> timeout_count. Reset on channel closure.
pub const TIMEOUT_COUNTS: Map<String, u32> = Map::new("timeout_count");

use crate::contract::{_create_trade, cancel_request};

const IBC_VERSION: &str = "ics";
#[entry_point]
pub fn ibc_channel_open(
    _deps: DepsMut,
    _env: Env,
    msg: IbcChannelOpenMsg,
) -> Result<IbcChannelOpenResponse, ContractError> {
    validate_order_and_version(msg.channel(), msg.counterparty_version())?;
    Ok(None)
}

#[entry_point]
pub fn ibc_channel_connect(
    deps: DepsMut,
    _env: Env,
    msg: IbcChannelConnectMsg,
) -> Result<IbcBasicResponse, ContractError> {
    validate_order_and_version(msg.channel(), msg.counterparty_version())?;

    // Initialize the count for this channel to zero.
    let channel = msg.channel().endpoint.channel_id.clone();
    CONNECTION_COUNTS.save(deps.storage, channel.clone(), &0)?;

    Ok(IbcBasicResponse::new()
        .add_attribute("method", "ibc_channel_connect")
        .add_attribute("channel_id", channel))
}

#[entry_point]
pub fn ibc_channel_close(
    deps: DepsMut,
    _env: Env,
    msg: IbcChannelCloseMsg,
) -> Result<IbcBasicResponse, ContractError> {
    let channel = msg.channel().endpoint.channel_id.clone();
    // Reset the state for the channel.
    CONNECTION_COUNTS.remove(deps.storage, channel.clone());
    Ok(IbcBasicResponse::new()
        .add_attribute("method", "ibc_channel_close")
        .add_attribute("channel", channel))
}

#[entry_point]
pub fn ibc_packet_receive(
    deps: DepsMut,
    env: Env,
    msg: IbcPacketReceiveMsg,
) -> Result<IbcReceiveResponse, ContractError> {
    // Regardless of if our processing of this packet works we need to
    // commit an ACK to the chain. As such, we wrap all handling logic
    // in a seprate function and on error write out an error ack.
    match do_ibc_packet_receive(deps, env, msg) {
        Ok(response) => Ok(response),
        Err(error) => Ok(IbcReceiveResponse::new()
            .add_attribute("method", "ibc_packet_receive")
            .add_attribute("error", error.to_string())
            .set_ack(make_ack_fail(error.to_string()))),
    }
}

pub fn do_ibc_packet_receive(
    deps: DepsMut,
    env: Env,
    msg: IbcPacketReceiveMsg,
) -> Result<IbcReceiveResponse, ContractError> {
    // The channel this packet is being relayed along on this chain.
    let channel = msg.packet.dest.channel_id;
    let msg: IbcExecuteMsg = from_binary(&msg.packet.data)?;

    match msg {
        IbcExecuteMsg::Create {
            source_address: _,
            source_chain,
            new_trade,
        } => execute_create_trade(deps, env, channel, new_trade, source_chain),
        IbcExecuteMsg::CancelRequest {
            source_address,
            source_chain,
            trade_id,
        } => execute_cancel_trade(deps, env, channel, source_address, source_chain, trade_id),
    }
}

#[entry_point]
pub fn ibc_packet_ack(
    _deps: DepsMut,
    _env: Env,
    _ack: IbcPacketAckMsg,
) -> Result<IbcBasicResponse, ContractError> {
    // Nothing to do here. We don't keep any state about the other
    // chain, just deliver messages so nothing to update.
    //
    // If we did care about how the other chain received our message
    // we could deserialize the data field into an `Ack` and inspect
    // it.
    Ok(IbcBasicResponse::new().add_attribute("method", "ibc_packet_ack"))
}

#[entry_point]
pub fn ibc_packet_timeout(
    deps: DepsMut,
    _env: Env,
    msg: IbcPacketTimeoutMsg,
) -> Result<IbcBasicResponse, ContractError> {
    TIMEOUT_COUNTS.update(
        deps.storage,
        // timed out packets are sent by us, so lookup based on packet
        // source, not destination.
        msg.packet.src.channel_id,
        |count| -> StdResult<_> { Ok(count.unwrap_or_default() + 1) },
    )?;
    // As with ack above, nothing to do here. If we cared about
    // keeping track of state between the two chains then we'd want to
    // respond to this likely as it means that the packet in question
    // isn't going anywhere.
    Ok(IbcBasicResponse::new().add_attribute("method", "ibc_packet_timeout"))
}

pub fn validate_order_and_version(
    channel: &IbcChannel,
    counterparty_version: Option<&str>,
) -> Result<(), ContractError> {
    // We expect an unordered channel here. Ordered channels have the
    // property that if a message is lost the entire channel will stop
    // working until you start it again.
    if channel.order != IbcOrder::Unordered {
        return Err(ContractError::OrderedChannel {});
    }

    if channel.version != IBC_VERSION {
        return Err(ContractError::InvalidVersion {
            actual: channel.version.to_string(),
            expected: IBC_VERSION.to_string(),
        });
    }

    // Make sure that we're talking with a counterparty who speaks the
    // same "protocol" as us.
    //
    // For a connection between chain A and chain B being established
    // by chain A, chain B knows counterparty information during
    // `OpenTry` and chain A knows counterparty information during
    // `OpenAck`. We verify it when we have it but when we don't it's
    // alright.
    if let Some(counterparty_version) = counterparty_version {
        if counterparty_version != IBC_VERSION {
            return Err(ContractError::InvalidVersion {
                actual: counterparty_version.to_string(),
                expected: IBC_VERSION.to_string(),
            });
        }
    }

    Ok(())
}

/// IBC ACK. See:
/// https://github.com/cosmos/cosmos-sdk/blob/f999b1ff05a4db4a338a855713864497bedd4396/proto/ibc/core/channel/v1/channel.proto#L141-L147
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub enum Ack {
    Result(Binary),
    Error(String),
}

pub fn make_ack_success() -> Binary {
    let res = Ack::Result(b"1".into());
    to_binary(&res).unwrap()
}

pub fn make_ack_fail(err: String) -> Binary {
    let res = Ack::Error(err);
    to_binary(&res).unwrap()
}

/// IBC Messages
///
//TODO: Use cw_serde
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub enum IbcExecuteMsg {
    Create {
        source_address: String,
        source_chain: String,
        new_trade: NewTrade,
    },
    CancelRequest {
        source_address: String,
        source_chain: String,
        trade_id: u64,
    },
}

fn execute_create_trade(
    deps: DepsMut,
    env: Env,
    channel: String,
    new_trade: NewTrade,
    source_chain: String,
) -> Result<IbcReceiveResponse, ContractError> {
    let sub_msgs = _create_trade(deps, env, new_trade, source_chain)?;
    let mut ibc_res = IbcReceiveResponse::new().set_ack(make_ack_success());
    for msg in sub_msgs {
        ibc_res = ibc_res.add_message(msg.msg);
    }
    ibc_res = ibc_res.add_attribute("channel", channel);
    Ok(ibc_res)
}

fn execute_cancel_trade(
    deps: DepsMut,
    env: Env,
    channel: String,
    source_address: String,
    _source_chain: String,
    trade_id: u64,
) -> Result<IbcReceiveResponse, ContractError> {
    match cancel_request(deps, env, source_address, trade_id) {
        Ok(response) => {
            let mut ibc_res = IbcReceiveResponse::new()
                .set_ack(make_ack_success())
                .add_attribute("method", "execute_cancel_trade")
                .add_attribute("channel", channel);

            for msg in response.messages {
                ibc_res = ibc_res.add_message(msg.msg);
            }

            for event in response.events {
                ibc_res = ibc_res.add_event(event);
            }

            Ok(ibc_res)
        }
        Err(error) => Ok(IbcReceiveResponse::new()
            .add_attribute("method", "execute_cancel_trade")
            .add_attribute("error", error.to_string())
            .set_ack(make_ack_fail(error.to_string()))),
    }
}
