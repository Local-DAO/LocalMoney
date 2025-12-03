import type { SolanaConfig, SolanaHubInfo } from '../types'
import type { HubConfig } from '~/types/components.interface'

/**
 * Localnet configuration for local development
 */
export const SOLANA_LOCALNET_CONFIG: SolanaConfig = {
  network: 'localnet',
  chainName: 'Solana Localnet',
  chainShortName: 'SOL',
  rpcEndpoint: 'http://localhost:8899',
  wsEndpoint: 'ws://localhost:8900',
  blockExplorerUrl: 'https://explorer.solana.com',
  blockExplorerName: 'Solana Explorer',
}

/**
 * Localnet Hub Info - Program IDs matching Anchor.toml
 */
export const SOLANA_LOCALNET_HUB_INFO: SolanaHubInfo = {
  hubProgramId: '8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH',
  profileProgramId: '86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5',
  offerProgramId: 'CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo',
  tradeProgramId: '5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE',
  escrowProgramId: 'CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ',
  arbitratorProgramId: 'J5BNGJ128bxHuWemwaoGkDqy8DVSvsA7o5kpdy9eDoNe',
  priceOracleProgramId: 'CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw',
  hubConfig: {
    offer_addr: 'CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo',
    trade_addr: '5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE',
    profile_addr: '86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5',
    price_addr: 'CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw',
    price_provider_addr: 'CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw',
    local_market_addr: '8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH',
    chain_fee_collector_addr: '8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH',
    warchest_addr: '8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH',
    local_denom: { native: '5j3S2Ue2ZRpHTumpQ8ZEFBsjMjQJGqT9dAmpj1wc1LmS' }, // USDC mint
    arbitration_fee_pct: 1,
    burn_fee_pct: 0,
    chain_fee_pct: 0.5,
    warchest_fee_pct: 0.5,
    active_offers_limit: 10,
    active_trades_limit: 10,
  },
}
