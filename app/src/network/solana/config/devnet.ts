/**
 * Solana Devnet Configuration
 */

import type { SolanaConfig, SolanaHubInfo } from '../types'
import { SOLANA_TOKEN_ADDRESSES } from '../types'

/**
 * Solana Devnet network configuration
 */
export const SOLANA_DEVNET_CONFIG: SolanaConfig = {
  network: 'devnet',
  chainName: 'Solana Devnet',
  chainShortName: 'Solana Devnet',
  rpcEndpoint: import.meta.env.VITE_SOLANA_RPC_DEVNET || 'https://api.devnet.solana.com',
  wsEndpoint: import.meta.env.VITE_SOLANA_WS_DEVNET || 'wss://api.devnet.solana.com',
  blockExplorerUrl: 'https://explorer.solana.com',
  blockExplorerName: 'Solana Explorer',
}

/**
 * Solana Devnet program IDs and hub configuration
 * These match the program IDs from the SDK's DEVNET_PROGRAM_IDS
 */
export const SOLANA_DEVNET_HUB_INFO: SolanaHubInfo = {
  hubProgramId: import.meta.env.VITE_SOLANA_HUB_PROGRAM_ID || '8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH',
  profileProgramId: import.meta.env.VITE_SOLANA_PROFILE_PROGRAM_ID || '86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5',
  offerProgramId: import.meta.env.VITE_SOLANA_OFFER_PROGRAM_ID || 'CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo',
  tradeProgramId: import.meta.env.VITE_SOLANA_TRADE_PROGRAM_ID || '5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE',
  escrowProgramId: import.meta.env.VITE_SOLANA_ESCROW_PROGRAM_ID || 'CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ',
  arbitratorProgramId: import.meta.env.VITE_SOLANA_ARBITRATOR_PROGRAM_ID || 'J5BNGJ128bxHuWemwaoGkDqy8DVSvsA7o5kpdy9eDoNe',
  priceOracleProgramId: import.meta.env.VITE_SOLANA_PRICE_ORACLE_PROGRAM_ID || 'CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw',
  hubConfig: {
    // Program addresses (will be populated from hub config on-chain)
    profile_addr: '',
    offer_addr: '',
    trade_addr: '',
    escrow_addr: '',
    price_addr: '',
    price_oracle_addr: '',
    price_provider_addr: '',
    // Primary token configuration
    local_denom: { native: SOLANA_TOKEN_ADDRESSES.DEVNET.USDC },
    local_market_addr: '',
    chain_fee_collector_addr: '',
    warchest_addr: '',
    // Fee configuration (basis points, 100 = 1%)
    arbitration_fee_pct: 0.01, // 1%
    burn_fee_pct: 0.003, // 0.3%
    chain_fee_pct: 0.003, // 0.3%
    warchest_fee_pct: 0.004, // 0.4%
    // Limits
    active_offers_limit: 100,
    active_trades_limit: 100,
    trade_expiration_timer: 86400, // 24 hours in seconds
    trade_limit_min: 1000000, // Minimum 1 USDC (6 decimals)
    trade_limit_max: 10000000000, // Maximum 10,000 USDC
  },
}

/**
 * Get Solana block explorer URL for a transaction
 */
export function getSolanaExplorerTxUrl(signature: string, network: 'devnet' | 'mainnet-beta' = 'devnet'): string {
  const cluster = network === 'devnet' ? '?cluster=devnet' : ''
  return `https://explorer.solana.com/tx/${signature}${cluster}`
}

/**
 * Get Solana block explorer URL for an account
 */
export function getSolanaExplorerAccountUrl(address: string, network: 'devnet' | 'mainnet-beta' = 'devnet'): string {
  const cluster = network === 'devnet' ? '?cluster=devnet' : ''
  return `https://explorer.solana.com/address/${address}${cluster}`
}
