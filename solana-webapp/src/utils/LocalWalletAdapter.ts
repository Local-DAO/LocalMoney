import {
  BaseMessageSignerWalletAdapter,
  WalletConnectionError,
  WalletDisconnectionError,
  WalletName,
  WalletNotConnectedError,
  WalletReadyState,
  WalletSignTransactionError
} from '@solana/wallet-adapter-base';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { useLocalWalletStore, LocalWallet } from './localWallets';

export interface LocalWalletAdapterConfig {
  localWallet: LocalWallet;
}

export const LocalWalletName = 'Local Wallet' as WalletName;

export class LocalWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = LocalWalletName;
  url = 'https://localmoney.io';
  icon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40NzcgMiAyIDYuNDc3IDIgMTJDMiAxNy41MjMgNi40NzcgMjIgMTIgMjJDMTcuNTIzIDIyIDIyIDE3LjUyMyAyMiAxMkMyMiA2LjQ3NyAxNy41MjMgMiAxMiAyWk0xMiA0QzE2LjQxOCA0IDIwIDcuNTgyIDIwIDEyQzIwIDE2LjQxOCAxNi40MTggMjAgMTIgMjBDNy41ODIgMjAgNCAxNi40MTggNCAxMkM0IDcuNTgyIDcuNTgyIDQgMTIgNFpNMTIgNkM4LjY4NiA2IDYgOC42ODYgNiAxMkM2IDE1LjMxNCA4LjY4NiAxOCAxMiAxOEMxNS4zMTQgMTggMTggMTUuMzE0IDE4IDEyQzE4IDguNjg2IDE1LjMxNCA2IDEyIDZaIiBmaWxsPSIjNDI4NUY0Ii8+Cjwvc3ZnPgo=';
  readonly supportedTransactionVersions = null;

  private _connecting: boolean;
  private _connected: boolean;
  private _publicKey: PublicKey | null;
  private _localWallet: LocalWallet;

  constructor(config: LocalWalletAdapterConfig) {
    super();
    this._connecting = false;
    this._connected = false;
    this._publicKey = null;
    this._localWallet = config.localWallet;
  }

  get publicKey(): PublicKey | null {
    return this._publicKey;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get connected(): boolean {
    return this._connected;
  }

  get readyState(): WalletReadyState {
    return WalletReadyState.Installed;
  }

  async connect(): Promise<void> {
    try {
      if (this.connected || this.connecting) return;
      this._connecting = true;

      if (!this._localWallet) {
        throw new WalletConnectionError('Local wallet not available');
      }

      this._publicKey = this._localWallet.keypair.publicKey;
      this._connected = true;

      this.emit('connect', this._publicKey);
    } catch (error: any) {
      this.emit('error', error);
      throw error;
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (!this.connected) return;

      this._publicKey = null;
      this._connected = false;

      this.emit('disconnect');
    } catch (error: any) {
      this.emit('error', new WalletDisconnectionError(error?.message, error));
      throw error;
    }
  }

  async signTransaction(transaction: Transaction): Promise<Transaction> {
    try {
      if (!this.connected) {
        throw new WalletNotConnectedError();
      }

      if (!this._localWallet) {
        throw new WalletSignTransactionError('Local wallet not available');
      }

      transaction.feePayer = this.publicKey || undefined;
      
      // Get a recent blockhash if not already set
      if (!transaction.recentBlockhash) {
        try {
          const connection = new Connection(
            process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://localhost:8899',
            'confirmed'
          );
          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
        } catch (error) {
          throw new WalletSignTransactionError('Failed to get recent blockhash');
        }
      }

      transaction.sign(this._localWallet.keypair);
      return transaction;
    } catch (error: any) {
      this.emit('error', new WalletSignTransactionError(error?.message, error));
      throw error;
    }
  }

  async signAllTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    return await Promise.all(transactions.map((transaction) => this.signTransaction(transaction)));
  }

  async signMessage(): Promise<Uint8Array> {
    throw new Error('Method not implemented.');
  }
} 