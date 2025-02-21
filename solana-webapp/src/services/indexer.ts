import { Connection, PublicKey } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';
import { Offer, Trade } from '@localmoney/solana-sdk/types';
import { OfferError, TradeError } from '@/utils/errors';

interface IndexedOffer extends Offer {
  address: PublicKey;
}

interface IndexedTrade extends Trade {
  address: PublicKey;
}

export class IndexerService {
  private offerCache: Map<string, IndexedOffer> = new Map();
  private tradeCache: Map<string, IndexedTrade> = new Map();
  private lastScan = 0;
  private readonly SCAN_INTERVAL = 30 * 1000; // 30 seconds

  constructor(
    private connection: Connection,
    private program: Program,
    private programId: PublicKey
  ) {}

  async scanOffers(): Promise<IndexedOffer[]> {
    try {
      const now = Date.now();
      if (now - this.lastScan < this.SCAN_INTERVAL && this.offerCache.size > 0) {
        return Array.from(this.offerCache.values());
      }

      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: 'offer', // Discriminator for offer accounts
            },
          },
        ],
      });

      this.offerCache.clear();
      const offers: IndexedOffer[] = [];

      for (const account of accounts) {
        try {
          const offer = await this.program.account.offer.fetch(account.pubkey);
          const indexedOffer: IndexedOffer = {
            ...offer,
            address: account.pubkey,
          };
          this.offerCache.set(account.pubkey.toBase58(), indexedOffer);
          offers.push(indexedOffer);
        } catch (error) {
          console.error(`Failed to parse offer account ${account.pubkey}:`, error);
        }
      }

      this.lastScan = now;
      return offers;
    } catch (error) {
      throw new OfferError('Failed to scan offers', error as Error);
    }
  }

  async getOffersByOwner(owner: PublicKey): Promise<IndexedOffer[]> {
    const offers = await this.scanOffers();
    return offers.filter((offer) => offer.creator.equals(owner));
  }

  async getActiveOffers(): Promise<IndexedOffer[]> {
    const offers = await this.scanOffers();
    return offers.filter((offer) => offer.status === 'active');
  }

  async scanTrades(walletAddress: PublicKey): Promise<IndexedTrade[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: 'trade', // Discriminator for trade accounts
            },
          },
          {
            memcmp: {
              offset: 8, // After discriminator
              bytes: walletAddress.toBase58(),
            },
          },
        ],
      });

      const trades: IndexedTrade[] = [];

      for (const account of accounts) {
        try {
          const trade = await this.program.account.trade.fetch(account.pubkey);
          const indexedTrade: IndexedTrade = {
            ...trade,
            address: account.pubkey,
          };
          this.tradeCache.set(account.pubkey.toBase58(), indexedTrade);
          trades.push(indexedTrade);
        } catch (error) {
          console.error(`Failed to parse trade account ${account.pubkey}:`, error);
        }
      }

      return trades;
    } catch (error) {
      throw new TradeError('Failed to scan trades', error as Error);
    }
  }

  async getTradesByStatus(
    walletAddress: PublicKey,
    status: string[]
  ): Promise<IndexedTrade[]> {
    const trades = await this.scanTrades(walletAddress);
    return trades.filter((trade) => status.includes(trade.status));
  }

  clearCache() {
    this.offerCache.clear();
    this.tradeCache.clear();
    this.lastScan = 0;
  }
} 