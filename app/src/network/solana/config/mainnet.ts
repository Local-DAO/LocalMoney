/**
 * Solana Mainnet Configuration
 */

import type { SolanaConfig, SolanaHubInfo } from '../types'
import { SOLANA_TOKEN_ADDRESSES } from '../types'

/**
 * Solana Mainnet network configuration
 */
export const SOLANA_MAINNET_CONFIG: SolanaConfig = {
  network: 'mainnet-beta',
  chainName: 'Solana',
  chainShortName: 'Solana',
  rpcEndpoint: import.meta.env.VITE_SOLANA_RPC_MAINNET || 'https://api.mainnet-beta.solana.com',
  wsEndpoint: import.meta.env.VITE_SOLANA_WS_MAINNET || 'wss://api.mainnet-beta.solana.com',
  blockExplorerUrl: 'https://explorer.solana.com',
  blockExplorerName: 'Solana Explorer',
}

/**
 * Solana Mainnet program IDs and hub configuration
 * NOTE: These are placeholder addresses and must be updated after mainnet deployment
 */
export const SOLANA_MAINNET_HUB_INFO: SolanaHubInfo = {
  // Placeholder program IDs - must be updated after mainnet deployment
  hubProgramId: import.meta.env.VITE_SOLANA_MAINNET_HUB_PROGRAM_ID || '11111111111111111111111111111111',
  profileProgramId: import.meta.env.VITE_SOLANA_MAINNET_PROFILE_PROGRAM_ID || '11111111111111111111111111111111',
  offerProgramId: import.meta.env.VITE_SOLANA_MAINNET_OFFER_PROGRAM_ID || '11111111111111111111111111111111',
  tradeProgramId: import.meta.env.VITE_SOLANA_MAINNET_TRADE_PROGRAM_ID || '11111111111111111111111111111111',
  escrowProgramId: import.meta.env.VITE_SOLANA_MAINNET_ESCROW_PROGRAM_ID || '11111111111111111111111111111111',
  arbitratorProgramId: import.meta.env.VITE_SOLANA_MAINNET_ARBITRATOR_PROGRAM_ID || '11111111111111111111111111111111',
  priceOracleProgramId: import.meta.env.VITE_SOLANA_MAINNET_PRICE_ORACLE_PROGRAM_ID || '11111111111111111111111111111111',
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
    local_denom: { native: SOLANA_TOKEN_ADDRESSES.MAINNET.USDC },
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
    trade_limit_max: 100000000000, // Maximum 100,000 USDC
  },
}
