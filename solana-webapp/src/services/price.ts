import { Connection, PublicKey } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';
import { PriceStatus, PythConnection, getPythProgramKeyForCluster } from '@pythnetwork/client';
import { config } from '@/config/env';
import { PriceError } from '@/utils/errors';

interface PriceData {
  price: number;
  timestamp: number;
  confidence?: number;
}

interface PriceFeedResponse {
  symbol: string;
  price: number;
  timestamp: number;
}

interface PriceOracle {
  symbol: string;
  feedAddress: PublicKey;
}

const PRICE_ORACLES: { [key: string]: PriceOracle } = {
  'SOL/USD': {
    symbol: 'SOL/USD',
    feedAddress: new PublicKey('H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG'),
  },
  'USDC/USD': {
    symbol: 'USDC/USD',
    feedAddress: new PublicKey('Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD'),
  },
  // Add more price feeds as needed
};

export class PriceService {
  private static instance: PriceService | null = null;
  private cache: Map<string, PriceData> = new Map();
  private readonly CACHE_DURATION = 60 * 1000; // 1 minute
  private connection: Connection;
  private pythConnection: PythConnection | null = null;
  private pythProgramId: PublicKey;
  private initialized = false;

  private constructor(
    private readonly apiKey: string = config.priceFeed.apiKey,
    connection?: Connection
  ) {
    // Only initialize basic properties in constructor
    this.connection = connection || new Connection(config.solana.rpcUrl);
    this.pythProgramId = getPythProgramKeyForCluster(config.solana.network);
  }

  public static getInstance(apiKey?: string, connection?: Connection): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService(apiKey, connection);
    }
    return PriceService.instance;
  }

  private async ensureInitialized() {
    if (this.initialized) return;

    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        throw new Error('PriceService can only be initialized in browser environment');
      }

      this.pythConnection = new PythConnection(this.connection, this.pythProgramId);
      await this.pythConnection.start();
      this.initialized = true;
    } catch (error) {
      throw new PriceError('Failed to initialize Pyth connection', error as Error);
    }
  }

  async getPriceOracle(): Promise<PublicKey> {
    await this.ensureInitialized();
    return this.pythProgramId;
  }

  async getPriceProgram(): Promise<PublicKey> {
    await this.ensureInitialized();
    return this.pythProgramId;
  }

  private getPythFeedAddress(symbol: string, currency: string): PublicKey | null {
    const key = `${symbol}/${currency}`;
    const oracle = PRICE_ORACLES[key];
    return oracle ? oracle.feedAddress : null;
  }

  async getTokenPrice(symbol: string, currency: string): Promise<number> {
    await this.ensureInitialized();
    
    const cacheKey = `${symbol}-${currency}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.price;
    }

    try {
      let price: number;
      let confidence: number | undefined;

      const feedAddress = this.getPythFeedAddress(symbol, currency);
      if (feedAddress && this.pythConnection) {
        // Use Pyth oracle for supported pairs
        const priceData = await this.pythConnection.getLatestPriceFeeds([feedAddress]);
        if (!priceData || priceData.length === 0) {
          throw new Error('Price feed not available');
        }

        const feed = priceData[0];
        if (feed.getStatus() !== PriceStatus.TRADING) {
          throw new Error('Price feed not trading');
        }

        price = feed.getPrice();
        confidence = feed.getConfidence();

        // Apply confidence check
        if (confidence > price * 0.01) { // If confidence interval is > 1% of price
          throw new Error('Price confidence too low');
        }
      } else {
        // Fallback to API for other pairs
        const response = await fetch(
          `${config.priceFeed.url}/price?symbol=${symbol}&currency=${currency}`,
          {
            headers: {
              'X-API-Key': this.apiKey,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: PriceFeedResponse = await response.json();
        price = data.price;
      }

      const priceData: PriceData = {
        price,
        confidence,
        timestamp: Date.now(),
      };

      this.cache.set(cacheKey, priceData);
      return price;
    } catch (error) {
      throw new PriceError(
        `Failed to fetch price for ${symbol}/${currency}`,
        error as Error
      );
    }
  }

  async calculateOfferPrice(
    amount: number,
    tokenSymbol: string,
    fiatCurrency: string
  ): Promise<BN> {
    try {
      const tokenPrice = await this.getTokenPrice(tokenSymbol, fiatCurrency);
      const totalPrice = amount * tokenPrice;
      
      // Convert to the smallest unit (e.g., cents for USD)
      const priceInSmallestUnit = Math.round(totalPrice * 100);
      return new BN(priceInSmallestUnit);
    } catch (error) {
      throw new PriceError(
        `Failed to calculate offer price for ${amount} ${tokenSymbol}`,
        error as Error
      );
    }
  }

  async validatePrice(
    price: BN,
    amount: number,
    tokenSymbol: string,
    fiatCurrency: string,
    tolerance: number = 0.05 // 5% tolerance by default
  ): Promise<boolean> {
    try {
      const currentPrice = await this.calculateOfferPrice(
        amount,
        tokenSymbol,
        fiatCurrency
      );

      const priceDiff = price.sub(currentPrice).abs();
      const maxDiff = currentPrice.muln(Math.floor(tolerance * 100)).divn(100);

      return priceDiff.lte(maxDiff);
    } catch (error) {
      throw new PriceError(
        `Failed to validate price for ${amount} ${tokenSymbol}`,
        error as Error
      );
    }
  }

  async cleanup() {
    if (this.pythConnection) {
      try {
        await this.pythConnection.stop();
        this.pythConnection = null;
        this.initialized = false;
      } catch (error) {
        console.error('Failed to stop Pyth connection:', error);
      }
    }
    this.cache.clear();
  }
} 