import type { CosmosConfig, HubInfo } from '../config'

export const COSMOSHUB_CONFIG: CosmosConfig = {
  chainId: process.env.CHAIN_ID ?? 'cosmoshub-4',
  chainName: process.env.CHAIN_NAME ?? 'Cosmos Hub',
  lcdUrl: process.env.LCD ?? 'https://cosmos-lcd.polkachu.com',
  rpcUrl: process.env.RPC ?? 'https://cosmos-rpc.polkachu.com',
  addressPrefix: process.env.ADDR_PREFIX ?? 'cosmos',
  coinDenom: 'ATOM',
  coinMinimalDenom: process.env.LOCAL_DENOM ?? 'uatom',
  coinDecimals: 6,
}

export const COSMOSHUB_HUB_INFO: HubInfo = {
  hubAddress: process.env.HUB ?? '',
  hubConfig: {
    hub_owner: process.env.ADMIN_ADDR ?? '',
    offer_addr: process.env.OFFER ?? '',
    trade_addr: process.env.TRADE ?? '',
    price_addr: process.env.PRICE ?? '',
    profile_addr: process.env.PROFILE ?? '',
    price_provider_addr: process.env.PRICE_PROVIDER_ADDR ?? '',
    local_market_addr: process.env.LOCAL_MARKET ?? '',
    local_denom: { native: process.env.LOCAL_DENOM ?? 'uatom' },
    chain_fee_collector_addr: process.env.CHAIN_FEE_COLLECTOR ?? '',
    warchest_addr: process.env.WARCHEST_ADDR ?? '',
    trade_limit_min: '1',
    trade_limit_max: '100',
    active_offers_limit: 3,
    active_trades_limit: 10,
    arbitration_fee_pct: '0.01',
    burn_fee_pct: '0.002',
    chain_fee_pct: '0.003',
    warchest_fee_pct: '0.005',
    trade_expiration_timer: 1200,
    trade_dispute_timer: 3600,
  },
}