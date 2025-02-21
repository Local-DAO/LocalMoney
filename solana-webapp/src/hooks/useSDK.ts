import { useEffect, useState } from 'react';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { initializeSDK } from '@/services/provider';

export function useSDK() {
  const wallet = useAnchorWallet();
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!wallet) {
      setInitialized(false);
      setError(null);
      return;
    }

    try {
      initializeSDK();
      setInitialized(true);
      setError(null);
    } catch (err) {
      console.error('Failed to initialize SDK:', err);
      setInitialized(false);
      setError(err instanceof Error ? err : new Error('Failed to initialize SDK'));
    }
  }, [wallet]);

  return { initialized, error };
} 