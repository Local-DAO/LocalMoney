'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function WalletButton() {
  const { connected } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative inline-block">
        <button className="px-4 py-2 rounded-lg font-medium transition-all duration-200 bg-blue-600 hover:bg-blue-700 text-white">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <WalletMultiButton className={`
        px-4 py-2 rounded-lg font-medium transition-all duration-200
        ${connected 
          ? 'bg-green-600 hover:bg-green-700 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
        }
      `} />
    </div>
  );
} 