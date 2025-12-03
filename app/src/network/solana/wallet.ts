/**
 * Phantom Solana Wallet Adapter
 *
 * Provides a wrapper around Phantom's Solana wallet interface that implements
 * the SDK's WalletAdapter interface for transaction signing.
 */

import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import type { PhantomSolanaProvider, SolanaWalletAdapter } from './types'
import { WalletNotInstalled, WalletNotConnected } from '../chain-error'

/**
 * Event types for wallet state changes
 */
export type WalletEventType = 'connect' | 'disconnect' | 'accountChanged'
export type WalletEventHandler = (publicKey: PublicKey | null) => void

/**
 * Phantom Solana Wallet Adapter
 *
 * Wraps the Phantom Solana provider to implement the WalletAdapter interface
 * required by the LocalMoney SDK.
 */
export class PhantomSolanaAdapter implements SolanaWalletAdapter {
  private _provider: PhantomSolanaProvider | null = null
  private _publicKey: PublicKey | null = null
  private _connected = false
  private _eventHandlers: Map<WalletEventType, Set<WalletEventHandler>> = new Map()

  constructor() {
    // Initialize event handler sets
    this._eventHandlers.set('connect', new Set())
    this._eventHandlers.set('disconnect', new Set())
    this._eventHandlers.set('accountChanged', new Set())
  }

  /**
   * Get the Phantom Solana provider from window
   */
  private getProvider(): PhantomSolanaProvider {
    if (this._provider) return this._provider

    if (!PhantomSolanaAdapter.isPhantomInstalled()) {
      throw new WalletNotInstalled('Phantom wallet is not installed. Please install it from phantom.app')
    }

    this._provider = window.phantom!.solana!
    return this._provider
  }

  /**
   * Check if Phantom wallet is installed
   */
  static isPhantomInstalled(): boolean {
    return typeof window !== 'undefined' && !!window.phantom?.solana?.isPhantom
  }

  /**
   * Get Phantom provider if available (static method)
   */
  static getPhantomProvider(): PhantomSolanaProvider | null {
    if (!PhantomSolanaAdapter.isPhantomInstalled()) {
      return null
    }
    return window.phantom!.solana!
  }

  /**
   * Current public key (null if not connected)
   */
  get publicKey(): PublicKey | null {
    return this._publicKey
  }

  /**
   * Whether wallet is connected
   */
  get connected(): boolean {
    return this._connected
  }

  /**
   * Connect to Phantom wallet
   *
   * @param onlyIfTrusted - If true, only connects if the app is already trusted
   * @param maxRetries - Maximum number of retry attempts for service worker issues
   */
  async connect(options?: { onlyIfTrusted?: boolean }, maxRetries = 3): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Clear cached provider on retry to get fresh connection
        if (attempt > 0) {
          this._provider = null
          // Wait before retry to allow service worker to reconnect
          await this.delay(500 * attempt)
        }

        const provider = this.getProvider()

        // Set up event listeners before connecting
        this.setupEventListeners(provider)

        const response = await provider.connect(options)
        this._publicKey = response.publicKey
        this._connected = true

        // Notify listeners
        this.emitEvent('connect', this._publicKey)
        return // Success, exit retry loop
      } catch (error) {
        lastError = error as Error
        const errorMsg = lastError?.message || String(error)

        // Check if this is a service worker disconnection error (retryable)
        const isServiceWorkerError =
          errorMsg.includes('disconnected port') ||
          errorMsg.includes('service worker') ||
          errorMsg.includes('postMessage')

        if (!isServiceWorkerError || attempt === maxRetries - 1) {
          // Non-retryable error or last attempt
          this._connected = false
          this._publicKey = null
          throw error
        }

        console.warn(`[Phantom] Connection attempt ${attempt + 1} failed, retrying...`, errorMsg)
      }
    }

    // If we get here, all retries failed
    this._connected = false
    this._publicKey = null
    throw lastError || new Error('Failed to connect to Phantom wallet')
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Try to connect silently (only if already trusted)
   */
  async connectSilently(): Promise<boolean> {
    try {
      await this.connect({ onlyIfTrusted: true })
      return true
    } catch {
      return false
    }
  }

  /**
   * Disconnect from Phantom wallet
   */
  async disconnect(): Promise<void> {
    try {
      if (this._provider) {
        await this._provider.disconnect()
      }
    } finally {
      this._publicKey = null
      this._connected = false
      this.emitEvent('disconnect', null)
    }
  }

  /**
   * Sign a single transaction
   *
   * @param transaction - Transaction to sign
   * @returns Signed transaction
   */
  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if (!this._connected || !this._provider) {
      throw new WalletNotConnected('Wallet is not connected')
    }

    return this._provider.signTransaction(transaction)
  }

  /**
   * Sign multiple transactions
   *
   * @param transactions - Array of transactions to sign
   * @returns Array of signed transactions
   */
  async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
    if (!this._connected || !this._provider) {
      throw new WalletNotConnected('Wallet is not connected')
    }

    return this._provider.signAllTransactions(transactions)
  }

  /**
   * Sign a message (for verification purposes)
   *
   * @param message - Message to sign
   * @returns Signature
   */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this._connected || !this._provider) {
      throw new WalletNotConnected('Wallet is not connected')
    }

    const result = await this._provider.signMessage(message)
    return result.signature
  }

  /**
   * Add event listener
   */
  on(event: WalletEventType, handler: WalletEventHandler): void {
    this._eventHandlers.get(event)?.add(handler)
  }

  /**
   * Remove event listener
   */
  off(event: WalletEventType, handler: WalletEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler)
  }

  /**
   * Set up Phantom event listeners
   */
  private setupEventListeners(provider: PhantomSolanaProvider): void {
    // Handle account change
    provider.on('accountChanged', (publicKey: PublicKey | null) => {
      if (publicKey) {
        this._publicKey = publicKey
        this.emitEvent('accountChanged', publicKey)
      } else {
        // Account disconnected
        this._publicKey = null
        this._connected = false
        this.emitEvent('disconnect', null)
      }
    })

    // Handle disconnect
    provider.on('disconnect', () => {
      this._publicKey = null
      this._connected = false
      this.emitEvent('disconnect', null)
    })
  }

  /**
   * Emit an event to all registered handlers
   */
  private emitEvent(event: WalletEventType, publicKey: PublicKey | null): void {
    const handlers = this._eventHandlers.get(event)
    if (handlers) {
      handlers.forEach((handler) => handler(publicKey))
    }
  }

  /**
   * Get wallet address as string
   */
  getAddress(): string | null {
    return this._publicKey?.toBase58() ?? null
  }
}

/**
 * Create a new Phantom Solana adapter instance
 */
export function createPhantomSolanaAdapter(): PhantomSolanaAdapter {
  return new PhantomSolanaAdapter()
}

/**
 * Utility to detect if we're in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Wait for Phantom to be available (with timeout)
 *
 * @param timeout - Maximum time to wait in milliseconds
 * @returns True if Phantom is available, false if timeout
 */
export async function waitForPhantom(timeout = 3000): Promise<boolean> {
  if (!isBrowser()) return false

  const startTime = Date.now()

  return new Promise((resolve) => {
    const checkPhantom = () => {
      if (PhantomSolanaAdapter.isPhantomInstalled()) {
        resolve(true)
        return
      }

      if (Date.now() - startTime >= timeout) {
        resolve(false)
        return
      }

      setTimeout(checkPhantom, 100)
    }

    checkPhantom()
  })
}
