use cosmwasm_std::{Addr, Uint128};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::fmt::{self};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub offer_id: u64,
    pub ust_amount: String,
    pub taker: String,
    pub offers_addr: String,
    pub arbitrator: String,
    pub taker_contact: String,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    FundEscrow {},
    Refund {},
    Release {},
    Dispute {},
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    State {},
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct TradeData {
    pub addr: Addr,
    pub factory_addr: Addr,
    pub buyer: Addr,
    pub seller: Addr,
    pub taker_contact: String,
    pub arbitrator: Addr,
    pub offer_contract: Addr,
    pub offer_id: u64,
    pub expire_height: u64,
    pub ust_amount: Uint128,
    pub state: TradeState,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum TradeState {
    Canceled,
    Closed,
    Created,
    EscrowFunded,
    Disputed,
    SettledForMaker,
    SettledForTaker,
}

impl fmt::Display for TradeState {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}
