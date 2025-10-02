import type { CosmosConfig, HubInfo } from '../config'

export const MANTRA_CONFIG: CosmosConfig = {
  chainId: 'mantra-dukong-1',
  chainName: 'MANTRA Dukong',
  lcdUrl: 'https://api.dukong.mantrachain.io',
  rpcUrl: 'https://rpc.dukong.mantrachain.io:443',
  addressPrefix: 'mantra',
  coinDenom: 'OM',
  coinMinimalDenom: 'uom',
  coinDecimals: 6,
}

export const MANTRA_HUB_INFO: HubInfo = {
  hubAddress: 'mantra1h68udcx556jl0zhdjtpjk5mtefc96h52q6s83gyd9sz96v99mexq9d235z',
  hubConfig: {
    hub_owner: 'mantra10tysdwkjuqecgg9npery40dvc8ak9urhf6dj6u',
    offer_addr: 'mantra1qgrmrs5sfxdda76davn7s5gm5c8wjl39ttyvujdx6kqza59wxu3sht4m4j',
    trade_addr: 'mantra1d4982rnthytlueku4pjzwttuuxt7thzdnswva5vw0aesl2a4y8kqm3zkgt',
    price_addr: 'mantra1324s2qzeuvs0yut2t79fcx4shqzk29pk6ql4jn4azsp96qe9993qfhxlaq',
    profile_addr: 'mantra1scddmj44mtu5h67t30cshym3dmlpaza3w0za605a35qlmc4gsz8qfn5h6e',
    price_provider_addr: 'mantra10tysdwkjuqecgg9npery40dvc8ak9urhf6dj6u',
    local_market_addr: 'mantra10tysdwkjuqecgg9npery40dvc8ak9urhf6dj6u',
    local_denom: { native: 'uom' },
    chain_fee_collector_addr: 'mantra10tysdwkjuqecgg9npery40dvc8ak9urhf6dj6u',
    warchest_addr: 'mantra10tysdwkjuqecgg9npery40dvc8ak9urhf6dj6u',
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