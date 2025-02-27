'use client';

import { FC, ReactNode, useEffect, useMemo, useState } from 'react';
import { 
  ConnectionProvider, 
  WalletProvider as SolanaWalletProvider 
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { 
  PhantomWalletAdapter, 
  SolflareWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { isLocalnetMode, useLocalWalletStore } from '@/utils/localWallets';
import { LocalWalletAdapter } from '@/utils/LocalWalletAdapter';
import LocalWalletModal from '@/components/LocalWalletModal';

// Import the wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: FC<WalletProviderProps> = ({ children }) => {
  // Check if we're in localnet mode
  const isLocalnet = isLocalnetMode;
  const { initializeWallets, wallets: localWallets } = useLocalWalletStore();
  const [isCustomModalReady, setIsCustomModalReady] = useState(false);

  // Initialize local wallets if in localnet mode
  useEffect(() => {
    if (isLocalnet) {
      initializeWallets();
      setIsCustomModalReady(true);
    }
  }, [isLocalnet, initializeWallets]);

  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK as WalletAdapterNetwork || WalletAdapterNetwork.Devnet;

  // You can also provide a custom RPC endpoint
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
      return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    }
    return clusterApiUrl(network);
  }, [network]);

  // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking --
  // Only the wallets you configure here will be compiled into your application
  const wallets = useMemo(() => {
    const standardWallets = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter()
    ];
    
    // Add local wallet adapters if in localnet mode
    if (isLocalnet && localWallets.length > 0) {
      const localWalletAdapters = localWallets.map(
        wallet => new LocalWalletAdapter({ localWallet: wallet })
      );
      return [...standardWallets, ...localWalletAdapters];
    }
    
    return standardWallets;
  }, [network, isLocalnet, localWallets]);

  if (isLocalnet && !isCustomModalReady) {
    return <div>Loading wallet provider...</div>;
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={!isLocalnet}>
        <WalletModalProvider>
          {children}
          {isLocalnet && <LocalWalletModal />}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

export default WalletProvider; 