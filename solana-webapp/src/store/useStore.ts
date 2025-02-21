import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface Offer {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  fiat: string;
  denom: string;
  owner: string;
  createdAt: Date;
  status: 'active' | 'completed' | 'cancelled';
}

interface Trade {
  id: string;
  offerId: string;
  type: 'buy' | 'sell';
  amount: number;
  fiat: string;
  denom: string;
  counterparty: string;
  createdAt: Date;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'disputed';
}

interface Store {
  offers: Offer[];
  trades: Trade[];
  loading: {
    offers: boolean;
    trades: boolean;
  };
  setOffers: (offers: Offer[]) => void;
  setTrades: (trades: Trade[]) => void;
  setOffersLoading: (loading: boolean) => void;
  setTradesLoading: (loading: boolean) => void;
  addOffer: (offer: Offer) => void;
  updateOffer: (id: string, offer: Partial<Offer>) => void;
  removeOffer: (id: string) => void;
  addTrade: (trade: Trade) => void;
  updateTrade: (id: string, trade: Partial<Trade>) => void;
  removeTrade: (id: string) => void;
}

export const useStore = create<Store>()(
  devtools(
    persist(
      (set) => ({
        offers: [],
        trades: [],
        loading: {
          offers: false,
          trades: false,
        },
        setOffers: (offers) => set({ offers }),
        setTrades: (trades) => set({ trades }),
        setOffersLoading: (loading) =>
          set((state) => ({ loading: { ...state.loading, offers: loading } })),
        setTradesLoading: (loading) =>
          set((state) => ({ loading: { ...state.loading, trades: loading } })),
        addOffer: (offer) => set((state) => ({ offers: [...state.offers, offer] })),
        updateOffer: (id, offer) =>
          set((state) => ({
            offers: state.offers.map((o) => (o.id === id ? { ...o, ...offer } : o)),
          })),
        removeOffer: (id) =>
          set((state) => ({
            offers: state.offers.filter((o) => o.id !== id),
          })),
        addTrade: (trade) => set((state) => ({ trades: [...state.trades, trade] })),
        updateTrade: (id, trade) =>
          set((state) => ({
            trades: state.trades.map((t) => (t.id === id ? { ...t, ...trade } : t)),
          })),
        removeTrade: (id) =>
          set((state) => ({
            trades: state.trades.filter((t) => t.id !== id),
          })),
      }),
      {
        name: 'local-money-store',
      }
    )
  )
); 