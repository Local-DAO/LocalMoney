'use client';

import { FC, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWalletStore } from '@/store/useWalletStore';
import { getSOLBalance } from '@/utils/solana';
import { truncateAddress } from '@/utils/format';
import { useLocalWalletStore } from '@/utils/localWallets';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export const WalletButton: FC = () => {
  const { publicKey, connected, connecting, connection, disconnect } = useWallet();
  const walletStore = useWalletStore();
  const { getSelectedWallet, isLocalnetMode } = useLocalWalletStore();
  const { setVisible } = useWalletModal();
  const [isClient, setIsClient] = useState(false);
  const isLocalnet = isLocalnetMode;
  const selectedLocalWallet = isLocalnet ? getSelectedWallet() : null;

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update wallet store with connected wallet info
  useEffect(() => {
    // If we're in localnet mode and have a selected local wallet, use that
    const effectivePublicKey = isLocalnet && selectedLocalWallet 
      ? selectedLocalWallet.keypair.publicKey 
      : publicKey;
    
    const effectiveConnected = isLocalnet 
      ? !!selectedLocalWallet 
      : connected;

    // Add deep equality check to prevent infinite updates
    const currentPublicKey = walletStore.publicKey;
    const publicKeysEqual = 
      (effectivePublicKey && currentPublicKey && 
       effectivePublicKey.toBase58() === currentPublicKey.toBase58()) || 
      (effectivePublicKey === null && currentPublicKey === null);
      
    if (!publicKeysEqual) {
      walletStore.setPublicKey(effectivePublicKey);
    }
    
    if (effectiveConnected !== walletStore.connected) {
      walletStore.setConnected(effectiveConnected);
      if (effectiveConnected) {
        walletStore.setConnectedAt(new Date());
      } else {
        walletStore.setConnectedAt(null);
      }
    }

    if (connecting !== walletStore.connecting) {
      walletStore.setConnecting(connecting);
    }
  }, [publicKey, connected, connecting, walletStore, isLocalnet, selectedLocalWallet]);

  // Fetch balance when connected
  useEffect(() => {
    if (!connection) return;
    
    const effectivePublicKey = isLocalnet && selectedLocalWallet 
      ? selectedLocalWallet.keypair.publicKey 
      : publicKey;
    
    const effectiveConnected = isLocalnet 
      ? !!selectedLocalWallet 
      : connected;
      
    if (effectivePublicKey && effectiveConnected) {
      const fetchBalance = async () => {
        try {
          walletStore.setBalanceLoading(true);
          const balance = await getSOLBalance(connection, effectivePublicKey);
          walletStore.setBalance(balance);
          walletStore.setBalanceLoading(false);
        } catch (error) {
          console.error('Error fetching balance:', error);
          walletStore.setBalanceLoading(false);
        }
      };

      fetchBalance();
      // Refresh balance every 30 seconds
      const interval = setInterval(fetchBalance, 30000);
      return () => clearInterval(interval);
    } else {
      // Reset balance state when disconnected
      if (walletStore.balance !== 0) {
        walletStore.setBalance(0);
      }
      if (walletStore.balanceLoading) {
        walletStore.setBalanceLoading(false);
      }
    }
  }, [connection, publicKey, connected, walletStore, isLocalnet, selectedLocalWallet]);

  const handleClick = () => {
    if (isLocalnet) {
      setVisible(true);
    }
  };

  if (!isClient) {
    return null; // Prevent hydration errors
  }

  // If we're in localnet mode and have a selected local wallet, show a custom button
  if (isLocalnet && selectedLocalWallet) {
    return (
      <button
        onClick={handleClick}
        className="bg-transparent hover:bg-primary hover:bg-opacity-90 text-primary hover:text-white border border-primary rounded-md px-4 py-2 transition-colors duration-200"
        style={{
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          fontWeight: '600',
        }}
      >
        {truncateAddress(selectedLocalWallet.keypair.publicKey.toString())}
      </button>
    );
  }

  // Otherwise, use the standard WalletMultiButton
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