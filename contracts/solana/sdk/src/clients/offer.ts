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
    amount: BN,
    pricePerToken: BN,
    minAmount: BN,
    maxAmount: BN,
    offerType: OfferType
  ): Promise<PublicKey> {
    const [offerPDA] = await PublicKey.findProgramAddress(
      [Buffer.from("offer"), maker.publicKey.toBuffer()],
      this.program.programId
    );

    await this.program.methods
      .createOffer(amount, pricePerToken, minAmount, maxAmount, { [offerType]: {} })
      .accounts({
        offer: offerPDA,
        maker: maker.publicKey,
        tokenMint,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
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
      maker: account.maker,
      tokenMint: account.tokenMint,
      amount: account.amount,
      pricePerToken: account.pricePerToken,
      minAmount: account.minAmount,
      maxAmount: account.maxAmount,
      offerType: this.convertOfferType(account.offerType),
      status: this.convertOfferStatus(account.status),
      createdAt: account.createdAt.toNumber(),
      updatedAt: account.updatedAt.toNumber(),
    };
  }

  async findOfferAddress(maker: PublicKey): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from("offer"), maker.toBuffer()],
      this.program.programId
    );
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