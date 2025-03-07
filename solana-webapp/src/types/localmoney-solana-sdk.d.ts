declare module '@localmoney/solana-sdk' {
  import { BN } from '@project-serum/anchor';
  import { PublicKey, Keypair } from '@solana/web3.js';

  export enum OfferType {
    Buy = 'buy',
    Sell = 'sell'
  }

  export enum OfferStatus {
    Active = 'active',
    Paused = 'paused',
    Closed = 'closed'
  }

  export enum TradeStatus {
    Created = 'created',
    Open = 'open',
    InProgress = 'inProgress',
    Completed = 'completed',
    Cancelled = 'cancelled',
    Disputed = 'disputed'
  }

  export interface Offer {
    maker: PublicKey;
    tokenMint: PublicKey;
    pricePerToken: BN;
    minAmount: BN;
    maxAmount: BN;
    offerType: OfferType;
    status: OfferStatus;
    createdAt: number;
    updatedAt: number;
  }

  export class OfferClient {
    constructor(programId: PublicKey, provider: any, idl: any);
    
    createOffer(
      maker: Keypair,
      tokenMint: PublicKey,
      pricePerToken: BN,
      minAmount: BN,
      maxAmount: BN,
      offerType: OfferType
    ): Promise<PublicKey>;

    updateOffer(
      offerPDA: PublicKey,
      maker: Keypair,
      pricePerToken?: BN,
      minAmount?: BN,
      maxAmount?: BN
    ): Promise<void>;

    pauseOffer(
      offerPDA: PublicKey,
      maker: Keypair
    ): Promise<void>;

    resumeOffer(
      offerPDA: PublicKey,
      maker: Keypair
    ): Promise<void>;

    closeOffer(
      offerPDA: PublicKey,
      maker: Keypair
    ): Promise<void>;

    takeOffer(
      offerPDA: PublicKey,
      maker: PublicKey,
      tokenMint: PublicKey,
      tradePDA: PublicKey,
      taker: Keypair,
      tradeProgram: PublicKey,
      amount: BN
    ): Promise<void>;

    depositEscrow(
      offerPDA: PublicKey,
      tradePDA: PublicKey,
      depositor: Keypair,
      tradeProgram: PublicKey
    ): Promise<void>;

    getOffer(offerPDA: PublicKey): Promise<Offer>;

    findOfferAddress(
      maker: PublicKey,
      tokenMint: PublicKey,
      offerType: OfferType,
      minAmount: BN,
      maxAmount: BN
    ): Promise<[PublicKey, number]>;

    getAllOffers(): Promise<Array<{publicKey: PublicKey, account: Offer}>>;
  }
} 