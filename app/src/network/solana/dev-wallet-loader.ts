/**
 * Development Wallet Loader for Solana
 *
 * This module provides utilities for loading test wallets in development mode.
 * It enables automated testing without requiring Phantom wallet to be installed.
 */

import { TestSolanaWallet, injectTestWalletProvider } from './test-wallet'

export type DevWalletName = 'maker' | 'taker'

/**
 * Check if we're in development mode
 */
export function isDevMode(): boolean {
  return import.meta.env.MODE === 'development' || import.meta.env.DEV === true
}

/**
 * Check if dev wallet mode is enabled
 */
export function isDevWalletEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('devWalletEnabled') === 'true'
}

/**
 * Get the currently selected dev wallet name
 */
export function getDevWalletName(): DevWalletName {
  if (typeof window === 'undefined') return 'maker'
  return (localStorage.getItem('devWalletName') as DevWalletName) || 'maker'
}

/**
 * Set dev wallet enabled state
 */
export function setDevWalletEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('devWalletEnabled', String(enabled))
}

/**
 * Set the dev wallet name
 */
export function setDevWalletName(name: DevWalletName): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('devWalletName', name)
}

/**
 * Load a dev wallet from the test-wallets directory
 */
export async function loadDevWallet(walletName: DevWalletName): Promise<TestSolanaWallet> {
  // Load from public/test-wallets/
  const response = await fetch(`/test-wallets/${walletName}.json`)
  if (!response.ok) {
    throw new Error(`Failed to load dev wallet: ${walletName}. Make sure test-wallets/${walletName}.json exists in the public directory.`)
  }
  const keypairArray = await response.json()
  return new TestSolanaWallet(new Uint8Array(keypairArray))
}

/**
 * Dev wallet state - singleton to track the loaded wallet
 */
let currentDevWallet: TestSolanaWallet | null = null
let devWalletReady = false

/**
 * Get the current dev wallet instance
 */
export function getCurrentDevWallet(): TestSolanaWallet | null {
  return currentDevWallet
}

/**
 * Check if dev wallet is ready
 */
export function isDevWalletReady(): boolean {
  return devWalletReady
}

/**
 * Setup dev wallet mode
 *
 * Loads the specified wallet and injects it as a mock Phantom provider.
 * This should be called early in the app lifecycle before any Solana connection attempts.
 */
export async function setupDevWalletMode(walletName: DevWalletName): Promise<TestSolanaWallet> {
  console.log(`[DevWallet] Setting up dev wallet mode with wallet: ${walletName}`)

  // Clear any existing dev wallet
  if (currentDevWallet) {
    await currentDevWallet.disconnect()
    currentDevWallet = null
    devWalletReady = false
  }

  // Load the wallet
  const wallet = await loadDevWallet(walletName)

  // Connect the wallet
  await wallet.connect()

  // Inject the mock Phantom provider
  injectTestWalletProvider(wallet)

  // Store the wallet
  currentDevWallet = wallet
  devWalletReady = true

  // Save to localStorage
  setDevWalletEnabled(true)
  setDevWalletName(walletName)

  console.log(`[DevWallet] Dev wallet ready: ${wallet.publicKey?.toBase58()}`)

  return wallet
}

/**
 * Disable dev wallet mode
 */
export async function disableDevWalletMode(): Promise<void> {
  console.log('[DevWallet] Disabling dev wallet mode')

  if (currentDevWallet) {
    await currentDevWallet.disconnect()
    currentDevWallet = null
  }

  devWalletReady = false
  setDevWalletEnabled(false)

  // Remove the mock provider
  if (typeof window !== 'undefined') {
    delete (window as any).phantom
  }
}

/**
 * Auto-initialize dev wallet if previously enabled
 *
 * Call this on app startup to restore dev wallet state
 */
export async function autoInitDevWallet(): Promise<boolean> {
  if (!isDevMode()) {
    console.log('[DevWallet] Not in dev mode, skipping auto-init')
    return false
  }

  if (!isDevWalletEnabled()) {
    console.log('[DevWallet] Dev wallet not enabled, skipping auto-init')
    return false
  }

  const walletName = getDevWalletName()
  console.log(`[DevWallet] Auto-initializing dev wallet: ${walletName}`)

  try {
    await setupDevWalletMode(walletName)
    return true
  } catch (error) {
    console.error('[DevWallet] Failed to auto-init dev wallet:', error)
    setDevWalletEnabled(false)
    return false
  }
}

/**
 * Get wallet addresses for display
 */
export const DEV_WALLET_ADDRESSES = {
  maker: '7gG7tH3bY7B3Anc6RmDQHoWgkNUhzXDBaTc55ikqkXxR',
  taker: 'Fcu81FSmGnwXerKQjCHxRwYYX2F8ftdyt1EVBEJeiqev',
} as const
