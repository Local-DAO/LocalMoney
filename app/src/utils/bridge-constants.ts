import type { KujiraConfig, BSCConfig } from '~/types/bridge'

// CosmJS requires full URLs with protocol for WebSocket connections
// Using public Kujira RPC endpoints that support CORS
export const KUJIRA_CONFIG: KujiraConfig = {
  chainId: import.meta.env.VITE_KUJIRA_CHAIN_ID || 'kaiyo-1',
  chainName: import.meta.env.VITE_KUJIRA_CHAIN_NAME || 'Kujira',
  rpc: import.meta.env.VITE_KUJIRA_RPC || 'https://kujira-rpc.polkachu.com',
  rest: import.meta.env.VITE_KUJIRA_LCD || 'https://kujira-api.polkachu.com',
  bech32Prefix: 'kujira',
  coinDenom: 'LOCAL',
  coinMinimalDenom: import.meta.env.VITE_TOKEN_DENOM || 'factory/kujira1swkuyt08z74n5jl7zr6hx0ru5sa2yev5v896p6/local',
  coinDecimals: 6,
}

export const KUJIRA_EXPLORER_URL = import.meta.env.VITE_KUJIRA_EXPLORER || 'https://finder.kujira.network/kaiyo-1'

export const BSC_CONFIG: BSCConfig = {
  chainId: parseInt(import.meta.env.VITE_BSC_CHAIN_ID || '56'),
  chainName: 'BNB Smart Chain',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  rpcUrls: [import.meta.env.VITE_BSC_RPC_URL || 'https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: [import.meta.env.VITE_BSC_EXPLORER || 'https://bscscan.com/'],
}

export const BURN_ADDRESS = import.meta.env.VITE_BURN_ADDRESS || 'kujira1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqnrql8a'
export const BSC_TOKEN_ADDRESS = import.meta.env.VITE_BSC_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000'

// Bridge fee (in basis points, 100 = 1%)
export const BRIDGE_FEE_BPS = 0 // 0% - No fee
export const ESTIMATED_TIME_MINUTES = 1

// Minimum bridge amount (1 LOCAL token)
export const MIN_BRIDGE_AMOUNT = 1
