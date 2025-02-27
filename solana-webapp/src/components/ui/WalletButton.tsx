'use client';

import { FC, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWalletStore } from '@/store/useWalletStore';
import { getSOLBalance } from '@/utils/solana';
import { shortenAddress } from '@/utils/solana';

export const WalletButton: FC = () => {
  const { publicKey, connected, connecting, connection } = useWallet();
  const walletStore = useWalletStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (publicKey !== walletStore.publicKey) {
      walletStore.setPublicKey(publicKey);
    }
    
    if (connected !== walletStore.connected) {
      walletStore.setConnected(connected);
      if (connected) {
        walletStore.setConnectedAt(new Date());
      } else {
        walletStore.setConnectedAt(null);
      }
    }

    if (connecting !== walletStore.connecting) {
      walletStore.setConnecting(connecting);
    }
  }, [publicKey, connected, connecting, walletStore]);

  // Fetch balance when connected
  useEffect(() => {
    if (connection && publicKey && connected) {
      const fetchBalance = async () => {
        walletStore.setBalanceLoading(true);
        const balance = await getSOLBalance(connection, publicKey);
        walletStore.setBalance(balance);
        walletStore.setBalanceLoading(false);
      };

      fetchBalance();
      // Refresh balance every 30 seconds
      const interval = setInterval(fetchBalance, 30000);
      return () => clearInterval(interval);
    }
  }, [connection, publicKey, connected, walletStore]);

  if (!isClient) {
    return null; // Prevent hydration errors
  }

  return (
    <WalletMultiButton 
      className="bg-transparent hover:bg-primary hover:bg-opacity-90 text-primary hover:text-white border border-primary rounded-md px-4 py-2 transition-colors duration-200"
      style={{
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontWeight: '600',
      }}
    />
  );
};

export default WalletButton; 