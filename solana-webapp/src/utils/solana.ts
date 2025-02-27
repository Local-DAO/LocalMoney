import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';

/**
 * Get SOL balance for a public key
 */
export const getSOLBalance = async (connection: Connection, publicKey: PublicKey): Promise<number> => {
  try {
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Failed to get balance:', error);
    toast.error('Failed to fetch balance');
    return 0;
  }
};

/**
 * Format SOL amount
 */
export const formatSOL = (amount: number): string => {
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} SOL`;
};

/**
 * Shorten a public key for display
 */
export const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

/**
 * Format a date for display
 */
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Check if Phantom is installed
 */
export const isPhantomInstalled = (): boolean => {
  const phantom = (window as any).phantom;
  return phantom?.solana?.isPhantom || false;
};

/**
 * Get Solana explorer URL for address or transaction
 */
export const getExplorerUrl = (address: string, isTransaction = false): string => {
  const networkParam = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  const network = networkParam === 'mainnet-beta' ? '' : networkParam;
  const path = isTransaction ? 'tx' : 'address';
  
  return `https://explorer.solana.com/${path}/${address}${network ? `?cluster=${network}` : ''}`;
}; 