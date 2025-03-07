import { Keypair } from '@solana/web3.js';
import { create } from 'zustand';
import { toast } from 'react-hot-toast';
import bs58 from 'bs58';

// Types for local wallet
export type LocalWalletType = 'maker' | 'taker';

export interface LocalWallet {
  type: LocalWalletType;
  keypair: Keypair;
  label: string;
}

// Interface for the local wallet store
interface LocalWalletState {
  wallets: LocalWallet[];
  selectedWallet: LocalWallet | null;
  isLocalnetMode: boolean;
  initializeWallets: () => void;
  selectWallet: (type: LocalWalletType) => void;
  getSelectedWallet: () => LocalWallet | null;
}

// Function to create a keypair from a private key
export const createKeypairFromPrivateKey = (privateKeyBase58: string): Keypair => {
  try {
    const decodedKey = bs58.decode(privateKeyBase58);
    return Keypair.fromSecretKey(decodedKey);
  } catch (error) {
    console.error('Failed to create keypair:', error);
    toast.error('Failed to create keypair from private key');
    // Fallback to generating a new keypair if there's an error
    return Keypair.generate();
  }
};

// Zustand store for local wallets
export const useLocalWalletStore = create<LocalWalletState>((set, get) => ({
  wallets: [],
  selectedWallet: null,
  isLocalnetMode: process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'localnet',
  
  // Initialize wallets from environment variables
  initializeWallets: () => {
    try {
      const makerPrivateKey = process.env.NEXT_PUBLIC_MAKER_PRIVATE_KEY;
      const takerPrivateKey = process.env.NEXT_PUBLIC_TAKER_PRIVATE_KEY;
      
      if (!makerPrivateKey || !takerPrivateKey) {
        console.error('Missing private keys in environment variables');
        toast.error('Missing private keys for local wallets');
        return;
      }
      
      const makerKeypair = createKeypairFromPrivateKey(makerPrivateKey);
      const takerKeypair = createKeypairFromPrivateKey(takerPrivateKey);
      
      const wallets: LocalWallet[] = [
        { type: 'maker', keypair: makerKeypair, label: 'Maker Wallet' },
        { type: 'taker', keypair: takerKeypair, label: 'Taker Wallet' }
      ];
      
      set({ wallets, selectedWallet: wallets[0] });
      toast.success('Local wallets initialized');
    } catch (error) {
      console.error('Failed to initialize local wallets:', error);
      toast.error('Failed to initialize local wallets');
    }
  },
  
  // Select a wallet by type
  selectWallet: (type: LocalWalletType) => {
    const { wallets } = get();
    const selectedWallet = wallets.find(wallet => wallet.type === type) || null;
    set({ selectedWallet });
  },
  
  // Get the currently selected wallet
  getSelectedWallet: () => {
    return get().selectedWallet;
  }
}));

// Helper to check if we're in localnet mode
export const isLocalnetMode = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'localnet'; 