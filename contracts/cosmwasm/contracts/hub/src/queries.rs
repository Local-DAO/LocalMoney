use cosmwasm_std::{Deps, StdResult};

use crate::state::{ADMIN, CONFIG};
use localmoney_protocol::hub::{Admin, HubConfig};

/// Queries the hub configuration
pub fn query_config(deps: Deps) -> StdResult<HubConfig> {
    CONFIG.load(deps.storage)
}

/// Queries the admin address
pub fn query_admin(deps: Deps) -> StdResult<Admin> {
    ADMIN.load(deps.storage)
}