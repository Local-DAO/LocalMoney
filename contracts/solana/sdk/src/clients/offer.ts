import { Program, AnchorProvider, Idl, BN } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Offer, OfferStatus, OfferType } from '../types';

export class OfferClient {
  private program: Program;
  private connection: Connection;

  constructor(
    programId: PublicKey,
    provider: AnchorProvider,
    idl: Idl
  ) {
    this.program = new Program(idl, programId, provider);
    this.connection = provider.connection;
  }

  async createOffer(
    maker: Keypair,
    tokenMint: PublicKey,
    pricePerToken: BN,
    minAmount: BN,
    maxAmount: BN,
    offerType: OfferType
  ): Promise<PublicKey> {
    const [offerPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from("offer"), 
        maker.publicKey.toBuffer(),
        tokenMint.toBuffer(),
        Buffer.from([offerType === OfferType.Buy ? 0 : 1]),
        minAmount.toArrayLike(Buffer, 'le', 8),
        maxAmount.toArrayLike(Buffer, 'le', 8)
      ],
      this.program.programId
    );

    await this.program.methods
      .createOffer(pricePerToken, minAmount, maxAmount, { [offerType]: {} })
      .accounts({
        offer: offerPDA,
        maker: maker.publicKey,
        tokenMint,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY
      })
      .signers([maker])
      .rpc();

    return offerPDA;
  }

  async updateOffer(
    offerPDA: PublicKey,
    maker: Keypair,
    pricePerToken?: BN,
    minAmount?: BN,
    maxAmount?: BN
  ): Promise<void> {
    await this.program.methods
      .updateOffer(pricePerToken, minAmount, maxAmount)
      .accounts({
        offer: offerPDA,
        maker: maker.publicKey,
      })
      .signers([maker])
      .rpc();
  }

  async pauseOffer(
    offerPDA: PublicKey,
    maker: Keypair
  ): Promise<void> {
    await this.program.methods
      .pauseOffer()
      .accounts({
        offer: offerPDA,
        maker: maker.publicKey,
      })
      .signers([maker])
      .rpc();
  }

  async resumeOffer(
    offerPDA: PublicKey,
    maker: Keypair
  ): Promise<void> {
    await this.program.methods
      .resumeOffer()
      .accounts({
        offer: offerPDA,
        maker: maker.publicKey,
      })
      .signers([maker])
      .rpc();
  }

  async closeOffer(
    offerPDA: PublicKey,
    maker: Keypair
  ): Promise<void> {
    await this.program.methods
      .closeOffer()
      .accounts({
        offer: offerPDA,
        maker: maker.publicKey,
      })
      .signers([maker])
      .rpc();
  }

  async takeOffer(
    offerPDA: PublicKey,
    maker: PublicKey,
    tokenMint: PublicKey,
    tradePDA: PublicKey,
    taker: Keypair,
    tradeProgram: PublicKey,
    amount: BN
  ): Promise<void> {
    await this.program.methods
      .takeOffer(amount)
      .accounts({
        offer: offerPDA,
        maker,
        tokenMint,
        trade: tradePDA,
        taker: taker.publicKey,
        tradeProgram,
      })
      .signers([taker])
      .rpc();
  }

  async depositEscrow(
    offerPDA: PublicKey,
    tradePDA: PublicKey,
    depositor: Keypair,
    tradeProgram: PublicKey
  ): Promise<void> {
    await this.program.methods
      .depositEscrow()
      .accounts({
        offer: offerPDA,
        trade: tradePDA,
        depositor: depositor.publicKey,
        tradeProgram,
      })
      .signers([depositor])
      .rpc();
  }

  async getOffer(offerPDA: PublicKey): Promise<Offer> {
    const account = await this.program.account.offer.fetch(offerPDA);
    return {
      maker: account.maker as PublicKey,
      tokenMint: account.tokenMint as PublicKey,
      pricePerToken: account.pricePerToken as BN,
      minAmount: account.minAmount as BN,
      maxAmount: account.maxAmount as BN,
      offerType: this.convertOfferType(account.offerType),
      status: this.convertOfferStatus(account.status),
      createdAt: (account.createdAt as BN).toNumber(),
      updatedAt: (account.updatedAt as BN).toNumber(),
    };
  }

  async findOfferAddress(
    maker: PublicKey, 
    tokenMint: PublicKey, 
    offerType: OfferType, 
    minAmount: BN, 
    maxAmount: BN
  ): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from("offer"), 
        maker.toBuffer(),
        tokenMint.toBuffer(),
        Buffer.from([offerType === OfferType.Buy ? 0 : 1]),
        minAmount.toArrayLike(Buffer, 'le', 8),
        maxAmount.toArrayLike(Buffer, 'le', 8)
      ],
      this.program.programId
    );
  }

  /**
   * Get all offers from the program
   * @returns Promise<Array<{publicKey: PublicKey, account: Offer}>>
   */
  async getAllOffers(): Promise<Array<{publicKey: PublicKey, account: Offer}>> {
    const accounts = await this.program.account.offer.all();
    
    return accounts.map(({ publicKey, account }) => ({
      publicKey,
      account: {
        maker: account.maker as PublicKey,
        tokenMint: account.tokenMint as PublicKey,
        pricePerToken: account.pricePerToken as BN,
        minAmount: account.minAmount as BN,
        maxAmount: account.maxAmount as BN,
        offerType: this.convertOfferType(account.offerType),
        status: this.convertOfferStatus(account.status),
        createdAt: (account.createdAt as BN).toNumber(),
        updatedAt: (account.updatedAt as BN).toNumber(),
      },
    }));
  }

  private convertOfferStatus(status: any): OfferStatus {
    if ('active' in status) return OfferStatus.Active;
    if ('paused' in status) return OfferStatus.Paused;
    if ('closed' in status) return OfferStatus.Closed;
    throw new Error('Unknown offer status');
  }

  private convertOfferType(type: any): OfferType {
    if ('buy' in type) return OfferType.Buy;
    if ('sell' in type) return OfferType.Sell;
    throw new Error('Unknown offer type');
  }
} 