'use client';

import { FC, useEffect, useState } from 'react';
import { useLocalWalletStore } from '@/utils/localWallets';
import { useWallet } from '@solana/wallet-adapter-react';
import { truncateAddress } from '@/utils/format';
const LocalWalletSelector: FC = () => {
  const { wallets, selectWallet, getSelectedWallet, isLocalnetMode } = useLocalWalletStore();
  const { connected, publicKey, disconnect } = useWallet();
  const [selectedWallet, setSelectedWallet] = useState(getSelectedWallet());

  // Update the selected wallet when it changes in the store
  useEffect(() => {
    setSelectedWallet(getSelectedWallet());
  }, [getSelectedWallet]);

  // If not in localnet mode, don't render anything
  if (!isLocalnetMode) {
    return null;
  }

  const handleSelectWallet = (type: 'maker' | 'taker') => {
    // If connected to a standard wallet, disconnect first
    if (connected && publicKey) {
      disconnect();
    }
    
    selectWallet(type);
    setSelectedWallet(getSelectedWallet());
    console.log('Selected wallet:', selectedWallet);
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium text-gray-700">Local Wallet:</span>
      <div className="relative">
        <select
          className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          value={selectedWallet?.type || ''}
          onChange={(e) => handleSelectWallet(e.target.value as 'maker' | 'taker')}
        >
          <option value="" disabled>Select wallet</option>
          {wallets.map((wallet) => (
            <option key={wallet.type} value={wallet.type}>
              {wallet.label} ({truncateAddress(wallet.keypair.publicKey.toString())})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default LocalWalletSelector; 