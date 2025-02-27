import { create } from 'zustand';
import { PublicKey } from '@solana/web3.js';

interface WalletState {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connectedAt: Date | null;
  balanceLoading: boolean;
  balance: number;
  setPublicKey: (publicKey: PublicKey | null) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setConnectedAt: (connectedAt: Date | null) => void;
  setBalance: (balance: number) => void;
  setBalanceLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  publicKey: null,
  connected: false,
  connecting: false,
  connectedAt: null,
  balanceLoading: false,
  balance: 0,
};

export const useWalletStore = create<WalletState>((set) => ({
  ...initialState,
  setPublicKey: (publicKey: PublicKey | null) => set({ publicKey }),
  setConnected: (connected: boolean) => set({ connected }),
  setConnecting: (connecting: boolean) => set({ connecting }),
  setConnectedAt: (connectedAt: Date | null) => set({ connectedAt }),
  setBalance: (balance: number) => set({ balance }),
  setBalanceLoading: (balanceLoading: boolean) => set({ balanceLoading }),
  reset: () => set(initialState),
})); 