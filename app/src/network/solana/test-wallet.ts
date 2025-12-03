/**
 * Test Wallet Provider for Solana
 *
 * This module provides a mock wallet implementation for testing purposes.
 * It uses local keypairs instead of Phantom wallet, enabling automated testing.
 */

import { Keypair, Transaction, VersionedTransaction, PublicKey, Connection } from '@solana/web3.js'
import bs58 from 'bs58'
import type { SolanaWalletAdapter } from './types'

/**
 * Test wallet that uses a local keypair for signing
 */
export class TestSolanaWallet implements SolanaWalletAdapter {
  private keypair: Keypair
  private _publicKey: PublicKey | null = null
  private _connected: boolean = false

  constructor(keypairOrSecretKey?: Keypair | Uint8Array | string) {
    if (!keypairOrSecretKey) {
      // Generate a new random keypair
      this.keypair = Keypair.generate()
    } else if (keypairOrSecretKey instanceof Keypair) {
      this.keypair = keypairOrSecretKey
    } else if (typeof keypairOrSecretKey === 'string') {
      // Assume it's a base58 encoded secret key
      const secretKey = bs58.decode(keypairOrSecretKey)
      this.keypair = Keypair.fromSecretKey(secretKey)
    } else {
      // Uint8Array
      this.keypair = Keypair.fromSecretKey(keypairOrSecretKey)
    }
  }

  get publicKey(): PublicKey | null {
    return this._publicKey
  }

  get connected(): boolean {
    return this._connected
  }

  async connect(): Promise<void> {
    this._publicKey = this.keypair.publicKey
    this._connected = true
  }

  async disconnect(): Promise<void> {
    this._publicKey = null
    this._connected = false
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if (!this._connected) {
      throw new Error('Wallet not connected')
    }

    if (transaction instanceof Transaction) {
      transaction.sign(this.keypair)
    } else {
      // VersionedTransaction
      transaction.sign([this.keypair])
    }

    return transaction
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
    if (!this._connected) {
      throw new Error('Wallet not connected')
    }

    return transactions.map(tx => {
      if (tx instanceof Transaction) {
        tx.sign(this.keypair)
      } else {
        tx.sign([this.keypair])
      }
      return tx
    })
  }

  /**
   * Get the secret key as base58 string (for export/import)
   */
  getSecretKeyBase58(): string {
    return bs58.encode(this.keypair.secretKey)
  }

  /**
   * Get the full keypair (for direct use in tests)
   */
  getKeypair(): Keypair {
    return this.keypair
  }
}

/**
 * Predefined test wallets for the localnet environment
 */
export const TEST_WALLETS = {
  // Maker wallet
  maker: {
    address: '7gG7tH3bY7B3Anc6RmDQHoWgkNUhzXDBaTc55ikqkXxR',
    // Note: In a real implementation, this would be loaded from the test-wallets directory
    // For security, we don't hardcode secret keys in source files
  },
  // Taker wallet
  taker: {
    address: 'Fcu81FSmGnwXerKQjCHxRwYYX2F8ftdyt1EVBEJeiqev',
  },
}

/**
 * Create a test wallet from a JSON keyfile path
 */
export async function createTestWalletFromFile(filePath: string): Promise<TestSolanaWallet> {
  // This would typically use fs to read the file, but in browser environment
  // we need to pass the secret key directly
  throw new Error('File-based wallet loading must be done server-side. Pass the secret key directly.')
}

/**
 * Inject test wallet into window for browser testing
 * This simulates the Phantom wallet provider
 */
export function injectTestWalletProvider(wallet: TestSolanaWallet): void {
  if (typeof window === 'undefined') return

  const mockPhantom = {
    solana: {
      isPhantom: true,
      publicKey: wallet.publicKey,
      isConnected: wallet.connected,
      connect: async () => {
        await wallet.connect()
        return { publicKey: wallet.publicKey }
      },
      disconnect: async () => {
        await wallet.disconnect()
      },
      signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => {
        return wallet.signTransaction(tx)
      },
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]) => {
        return wallet.signAllTransactions(txs)
      },
      on: (_event: string, _callback: Function) => {},
      off: (_event: string, _callback: Function) => {},
    },
  }

  ;(window as any).phantom = mockPhantom
}
