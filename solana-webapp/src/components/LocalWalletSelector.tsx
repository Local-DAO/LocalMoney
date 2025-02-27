'use client';

import { FC, useEffect } from 'react';
import { shortenAddress } from '@/utils/solana';
import { useLocalWalletStore, LocalWalletType } from '@/utils/localWallets';
import { useWalletStore } from '@/store/useWalletStore';
import toast from 'react-hot-toast';

export const LocalWalletSelector: FC = () => {
  const { wallets, selectedWallet, selectWallet, isLocalnetMode } = useLocalWalletStore();
  const { setPublicKey, setConnected, setConnectedAt } = useWalletStore();
  
  // Update the wallet store when a local wallet is selected
  useEffect(() => {
    if (selectedWallet) {
      setPublicKey(selectedWallet.keypair.publicKey);
      setConnected(true);
      setConnectedAt(new Date());
      toast.success(`Connected as ${selectedWallet.label}`);
    } else {
      setPublicKey(null);
      setConnected(false);
      setConnectedAt(null);
    }
  }, [selectedWallet, setPublicKey, setConnected, setConnectedAt]);
  
  // If not in localnet mode, don't render this component
  if (!isLocalnetMode) {
    return null;
  }
  
  const handleSelectWallet = (type: LocalWalletType) => {
    selectWallet(type);
  };
  
  return (
    <div className="mb-4 bg-secondary p-4 rounded-lg">
      <h2 className="text-lg font-medium text-foreground mb-2">Local Wallet Selector</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {wallets.map((wallet) => (
          <button
            key={wallet.type}
            onClick={() => handleSelectWallet(wallet.type)}
            className={`p-3 rounded-md ${
              selectedWallet?.type === wallet.type
                ? 'bg-primary text-white'
                : 'bg-secondary-dark hover:bg-secondary-light text-gray-200'
            }`}
          >
            <div className="flex flex-col items-start">
              <span className="font-medium">{wallet.label}</span>
              <span className="text-xs opacity-80">
                {shortenAddress(wallet.keypair.publicKey.toString())}
              </span>
            </div>
          </button>
        ))}
      </div>
      
      {selectedWallet && (
        <div className="mt-3 p-2 bg-secondary-light rounded text-xs text-gray-300">
          <p>Public Key: {selectedWallet.keypair.publicKey.toString()}</p>
        </div>
      )}
    </div>
  );
};

export default LocalWalletSelector; 