import { AnchorProvider, BN, Idl, Program } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Wallet } from '@solana/wallet-adapter-base';
import { SUPPORTED_TOKENS } from '@/config/tokens';
import { OfferClient } from '@localmoney/solana-sdk/clients/offer';
import { TradeClient } from '@localmoney/solana-sdk/clients/trade';
import { Offer, OfferStatus, Trade, TradeStatus } from '@localmoney/solana-sdk/types';
import { TokenService } from './token';
import { PriceService } from './price';
import { IndexerService } from './indexer';
import { handleError, ValidationError } from '@/utils/errors';

interface CreateOfferParams {
  type: 'buy' | 'sell';
  amount: number;
  minAmount: number;
  maxAmount: number;
  fiat: string;
  denom: string;
}

interface CreateTradeParams {
  offerId: string;
  amount: number;
}

interface SDKConfig {
  connection: Connection;
  programId: PublicKey;
  provider: AnchorProvider;
  idl: Idl;
}

class SDKService {
  private static instance: SDKService;
  private offerClient: OfferClient;
  private tradeClient: TradeClient;
  private tokenService: TokenService;
  private priceService: PriceService;
  private indexerService: IndexerService;
  private config: SDKConfig | null = null;

  private constructor() {
    // Initialize clients when config is set
  }

  public static getInstance(): SDKService {
    if (!SDKService.instance) {
      SDKService.instance = new SDKService();
    }
    return SDKService.instance;
  }

  public setConfig(config: SDKConfig) {
    this.config = config;
    this.offerClient = new OfferClient(config.programId, config.provider, config.idl);
    this.tradeClient = new TradeClient(config.programId, config.provider, config.idl);
    this.tokenService = new TokenService(config.connection);
    this.priceService = PriceService.getInstance(undefined, config.connection);
    this.indexerService = new IndexerService(
      config.connection,
      new Program(config.idl, config.programId, config.provider),
      config.programId
    );
  }

  private ensureConfig() {
    if (!this.config) {
      throw new Error('SDK not initialized. Call setConfig first.');
    }
  }

  private getTokenMint(denom: string): PublicKey {
    const token = SUPPORTED_TOKENS.find((t) => t.symbol === denom);
    if (!token?.mintAddress) {
      throw new ValidationError(`Unsupported token: ${denom}`);
    }
    return new PublicKey(token.mintAddress);
  }

  async getOffers(): Promise<Offer[]> {
    this.ensureConfig();
    try {
      return await this.indexerService.getActiveOffers();
    } catch (error) {
      throw handleError(error);
    }
  }

  async getMyOffers(walletAddress: PublicKey): Promise<Offer[]> {
    this.ensureConfig();
    try {
      return await this.indexerService.getOffersByOwner(walletAddress);
    } catch (error) {
      throw handleError(error);
    }
  }

  async createOffer(params: CreateOfferParams): Promise<string | null> {
    this.ensureConfig();
    try {
      const tokenMint = this.getTokenMint(params.denom);
      const amount = new BN(params.amount * Math.pow(10, 9));
      const minAmount = new BN(params.minAmount * Math.pow(10, 9));
      const maxAmount = new BN(params.maxAmount * Math.pow(10, 9));

      // Calculate and validate price
      const pricePerToken = await this.priceService.calculateOfferPrice(
        1, // Calculate price for 1 token
        params.denom,
        params.fiat
      );

      // Check token balance
      const balance = await this.tokenService.getTokenBalance(
        this.config!.provider.publicKey,
        params.denom
      );

      if (balance < params.amount) {
        throw new ValidationError(
          `Insufficient ${params.denom} balance. Required: ${params.amount}, Available: ${balance}`
        );
      }

      const offerPDA = await this.offerClient.createOffer(
        this.config!.provider.wallet as Wallet,
        tokenMint,
        amount,
        pricePerToken,
        minAmount,
        maxAmount
      );

      return offerPDA.toBase58();
    } catch (error) {
      throw handleError(error);
    }
  }

  async cancelOffer(offerId: string): Promise<boolean> {
    this.ensureConfig();
    try {
      const offerPDA = new PublicKey(offerId);
      await this.offerClient.closeOffer(
        offerPDA,
        this.config!.provider.wallet as Wallet
      );
      return true;
    } catch (error) {
      throw handleError(error);
    }
  }

  async getTrades(walletAddress: PublicKey): Promise<Trade[]> {
    this.ensureConfig();
    try {
      return await this.indexerService.scanTrades(walletAddress);
    } catch (error) {
      throw handleError(error);
    }
  }

  async createTrade(params: CreateTradeParams): Promise<string | null> {
    this.ensureConfig();
    try {
      const offerPDA = new PublicKey(params.offerId);
      const offer = await this.offerClient.getOffer(offerPDA);

      // Validate amount is within limits
      if (params.amount < offer.minAmount.toNumber() || params.amount > offer.maxAmount.toNumber()) {
        throw new ValidationError(
          `Amount must be between ${offer.minAmount} and ${offer.maxAmount}`
        );
      }

      // Check token balance for buyer
      const balance = await this.tokenService.getTokenBalance(
        this.config!.provider.publicKey,
        offer.tokenMint.toString()
      );

      if (balance < params.amount) {
        throw new ValidationError(
          `Insufficient token balance. Required: ${params.amount}, Available: ${balance}`
        );
      }

      // Get token accounts
      const buyerTokenAccount = await this.tokenService.getTokenAccount(
        this.config!.provider.publicKey,
        offer.tokenMint.toString()
      );

      const sellerTokenAccount = await this.tokenService.getTokenAccount(
        offer.creator,
        offer.tokenMint.toString()
      );

      // Create escrow account
      const escrowAccount = Keypair.generate();
      const [tradePDA] = await this.tradeClient.findTradeAddress(
        offer.creator,
        offer.tokenMint
      );

      await this.offerClient.takeOffer(
        offerPDA,
        this.config!.provider.wallet as Wallet,
        offer.tokenMint,
        sellerTokenAccount,
        escrowAccount.publicKey,
        tradePDA,
        this.config!.provider.wallet as Wallet,
        buyerTokenAccount,
        this.config!.programId,
        new BN(params.amount * Math.pow(10, 9))
      );

      return tradePDA.toBase58();
    } catch (error) {
      throw handleError(error);
    }
  }

  async completeTrade(tradeId: string): Promise<boolean> {
    this.ensureConfig();
    try {
      const tradePDA = new PublicKey(tradeId);
      const trade = await this.tradeClient.getTrade(tradePDA);

      // Get token accounts
      const buyerTokenAccount = await this.tokenService.getTokenAccount(
        trade.buyer!,
        trade.tokenMint.toString()
      );

      await this.tradeClient.completeTrade(
        tradePDA,
        this.config!.provider.wallet as Wallet,
        this.config!.provider.wallet as Wallet,
        trade.escrowAccount,
        buyerTokenAccount,
        await this.priceService.getPriceOracle(),
        await this.priceService.getPriceProgram(),
        Keypair.generate().publicKey, // TODO: Implement profiles
        Keypair.generate().publicKey,
        Keypair.generate().publicKey
      );
      return true;
    } catch (error) {
      throw handleError(error);
    }
  }

  async cancelTrade(tradeId: string): Promise<boolean> {
    this.ensureConfig();
    try {
      const tradePDA = new PublicKey(tradeId);
      const trade = await this.tradeClient.getTrade(tradePDA);

      // Get seller token account
      const sellerTokenAccount = await this.tokenService.getTokenAccount(
        trade.seller,
        trade.tokenMint.toString()
      );

      await this.tradeClient.cancelTrade(
        tradePDA,
        this.config!.provider.wallet as Wallet,
        trade.escrowAccount,
        sellerTokenAccount
      );
      return true;
    } catch (error) {
      throw handleError(error);
    }
  }

  async disputeTrade(tradeId: string): Promise<boolean> {
    this.ensureConfig();
    try {
      const tradePDA = new PublicKey(tradeId);
      await this.tradeClient.disputeTrade(
        tradePDA,
        this.config!.provider.wallet as Wallet
      );
      return true;
    } catch (error) {
      throw handleError(error);
    }
  }

  async getTokenBalance(walletAddress: PublicKey, denom: string): Promise<number> {
    this.ensureConfig();
    try {
      return await this.tokenService.getTokenBalance(walletAddress, denom);
    } catch (error) {
      throw handleError(error);
    }
  }
}

export const sdkService = SDKService.getInstance(); 