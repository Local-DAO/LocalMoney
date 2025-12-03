/**
 * Solana-specific type definitions for the LocalMoney frontend
 */

import type { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import type { HubConfig } from '~/types/components.interface'

/**
 * Solana network configuration
 */
export interface SolanaConfig {
  /** Network name (localnet, devnet, mainnet-beta) */
  network: 'localnet' | 'devnet' | 'mainnet-beta'
  /** Display name for the network */
  chainName: string
  /** Short chain name */
  chainShortName: string
  /** RPC endpoint URL */
  rpcEndpoint: string
  /** WebSocket endpoint (optional) */
  wsEndpoint?: string
  /** Block explorer URL */
  blockExplorerUrl: string
  /** Block explorer name */
  blockExplorerName: string
}

/**
 * Solana hub information with program IDs
 */
export interface SolanaHubInfo {
  /** Hub program ID */
  hubProgramId: string
  /** Profile program ID */
  profileProgramId: string
  /** Offer program ID */
  offerProgramId: string
  /** Trade program ID */
  tradeProgramId: string
  /** Escrow program ID */
  escrowProgramId: string
  /** Arbitrator program ID */
  arbitratorProgramId: string
  /** Price Oracle program ID */
  priceOracleProgramId: string
  /** Hub configuration from app's HubConfig interface */
  hubConfig: HubConfig
}

/**
 * Wallet adapter interface compatible with @solana/wallet-adapter and SDK
 */
export interface SolanaWalletAdapter {
  publicKey: PublicKey | null
  connected: boolean
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>
  connect(): Promise<void>
  disconnect(): Promise<void>
}

/**
 * Phantom Solana provider interface (window.phantom.solana)
 */
export interface PhantomSolanaProvider {
  isPhantom?: boolean
  publicKey: PublicKey | null
  isConnected: boolean
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKey }>
  disconnect(): Promise<void>
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>
  on(event: 'connect' | 'disconnect' | 'accountChanged', handler: (publicKey: PublicKey | null) => void): void
  off(event: 'connect' | 'disconnect' | 'accountChanged', handler: (publicKey: PublicKey | null) => void): void
}

/**
 * Supported Solana token configuration
 */
export interface SolanaTokenConfig {
  /** Token mint address */
  mint: string
  /** Token symbol */
  symbol: string
  /** Token decimals */
  decimals: number
  /** Display name */
  name: string
}

/**
 * Solana token addresses for different networks
 */
export const SOLANA_TOKEN_ADDRESSES = {
  DEVNET: {
    USDC: 'DxGBS8nbU9EvQHJ6U5LYqnHTDbNbxoe6vdWbCuaQXnSB', // Test USDC (we control mint authority)
    WSOL: 'So11111111111111111111111111111111111111112', // Wrapped SOL
  },
  MAINNET: {
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
    WSOL: 'So11111111111111111111111111111111111111112', // Wrapped SOL
  },
} as const

// Extend window type for Phantom Solana
declare global {
  interface Window {
    phantom?: {
      solana?: PhantomSolanaProvider
      ethereum?: unknown // EVM mode
    }
  }
}
