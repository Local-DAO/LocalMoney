'use client';

import { useMemo } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { Keypair, Transaction, VersionedTransaction, Connection, PublicKey, SendOptions } from '@solana/web3.js';
import { BaseSignerWalletAdapter, WalletName, WalletAccountError, WalletReadyState } from '@solana/wallet-adapter-base';
import '../styles/wallet-adapter.css';
import bs58 from 'bs58';

const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet') as WalletAdapterNetwork;
const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network);

class LocalWalletAdapter extends BaseSignerWalletAdapter {
  readonly name = 'Local Wallet' as WalletName<'Local Wallet'>;
  readonly url = '';
  readonly icon = '💼';
  readonly supportedTransactionVersions = new Set(['legacy', 0] as const);
  
  private _keypair: Keypair;
  private _connecting: boolean;

  constructor(privateKey: Uint8Array) {
    super();
    this._keypair = Keypair.fromSecretKey(privateKey);
    this._connecting = false;
  }

  get publicKey(): PublicKey | null {
    return this._keypair.publicKey;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get readyState(): WalletReadyState {
    return WalletReadyState.Installed;
  }

  async connect(): Promise<void> {
    try {
      this._connecting = true;
      this.emit('connect', this._keypair.publicKey);
    } catch (error: unknown) {
      this.emit('error', new WalletAccountError());
      throw error;
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    this.emit('disconnect');
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    try {
      if (!(transaction instanceof Transaction) && !(transaction instanceof VersionedTransaction)) {
        throw new Error('Invalid transaction format');
      }
      
      if (transaction instanceof Transaction) {
        transaction.partialSign(this._keypair);
      } else {
        transaction.sign([this._keypair]);
      }
      return transaction;
    } catch (error: unknown) {
      this.emit('error', new WalletAccountError());
      throw error;
    }
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options: SendOptions = {}
  ): Promise<string> {
    try {
      const signedTransaction = await this.signTransaction(transaction);
      return await connection.sendRawTransaction(
        signedTransaction.serialize(),
        options
      );
    } catch (error: unknown) {
      this.emit('error', new WalletAccountError());
      throw error;
    }
  }
}

// Initialize local wallets if enabled
const getLocalWallets = () => {
  if (process.env.NEXT_PUBLIC_ENABLE_LOCAL_WALLETS !== 'true') return [];
  
  const localWallets = [];
  
  if (process.env.NEXT_PUBLIC_LOCAL_WALLET_1_PRIVATE_KEY) {
    const bs58decodedKey = bs58.decode(process.env.NEXT_PUBLIC_LOCAL_WALLET_1_PRIVATE_KEY);
    localWallets.push(new LocalWalletAdapter(bs58decodedKey));
  }

  if (process.env.NEXT_PUBLIC_LOCAL_WALLET_2_PRIVATE_KEY) {
    const bs58decodedKey = bs58.decode(process.env.NEXT_PUBLIC_LOCAL_WALLET_2_PRIVATE_KEY);
    localWallets.push(new LocalWalletAdapter(bs58decodedKey));
  }

  return localWallets;
};

export function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      ...getLocalWallets(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
} 