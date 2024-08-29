import type { CosmosConfig, HubInfo } from '~/network/cosmos/config'

export const NEUTRON_CONFIG: CosmosConfig = {
  chainId: 'neutron-1',
  chainName: 'Neutron',
  lcdUrl: 'https://neutron-lcd.publicnode.com/',
  rpcUrl: 'https://neutron-rpc.publicnode.com/',
  addressPrefix: 'neutron',
  coinDenom: '',
  coinMinimalDenom: '',
  coinDecimals: 6,
}

export const NEUTRON_HUB_INFO: HubInfo = {
  hubAddress: 'neutron1lalrl5k46t62ftkds4nce2ndxnh34muszjdras3v0qjz3m56mlpqrh3r4e',
  hubConfig: {
    offer_addr: 'neutron14gceklcpzxe34zhy7hx82h46j5ywqc0v4rtztt9wzdqlvzcp8fxsn97r87',
    trade_addr: '',
    profile_addr: '',
    price_addr: '',
    price_provider_addr: '',
    local_market_addr: '',
    local_denom: {
      native: 'untrn',
    },
    chain_fee_collector_addr: '',
    warchest_addr: '',
    active_offers_limit: 4,
    active_trades_limit: 20,
    trade_expiration_timer: 86400,
  },
}
