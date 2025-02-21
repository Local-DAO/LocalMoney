import { Program, AnchorProvider, Idl, BN } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Offer, OfferStatus } from '../types';

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
    creator: Keypair,
    tokenMint: PublicKey,
    amount: BN,
    pricePerToken: BN,
    minAmount: BN,
    maxAmount: BN
  ): Promise<PublicKey> {
    const [offerPDA] = await PublicKey.findProgramAddress(
      [Buffer.from("offer"), creator.publicKey.toBuffer()],
      this.program.programId
    );

    await this.program.methods
      .createOffer(amount, pricePerToken, minAmount, maxAmount)
      .accounts({
        offer: offerPDA,
        creator: creator.publicKey,
        tokenMint,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([creator])
      .rpc();

    return offerPDA;
  }

  async updateOffer(
    offerPDA: PublicKey,
    creator: Keypair,
    pricePerToken?: BN,
    minAmount?: BN,
    maxAmount?: BN
  ): Promise<void> {
    await this.program.methods
      .updateOffer(pricePerToken, minAmount, maxAmount)
      .accounts({
        offer: offerPDA,
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();
  }

  async pauseOffer(
    offerPDA: PublicKey,
    creator: Keypair
  ): Promise<void> {
    await this.program.methods
      .pauseOffer()
      .accounts({
        offer: offerPDA,
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();
  }

  async resumeOffer(
    offerPDA: PublicKey,
    creator: Keypair
  ): Promise<void> {
    await this.program.methods
      .resumeOffer()
      .accounts({
        offer: offerPDA,
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();
  }

  async closeOffer(
    offerPDA: PublicKey,
    creator: Keypair
  ): Promise<void> {
    await this.program.methods
      .closeOffer()
      .accounts({
        offer: offerPDA,
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();
  }

  async takeOffer(
    offerPDA: PublicKey,
    creator: Keypair,
    tokenMint: PublicKey,
    sellerTokenAccount: PublicKey,
    escrowAccount: PublicKey,
    tradePDA: PublicKey,
    buyer: Keypair,
    buyerTokenAccount: PublicKey,
    tradeProgram: PublicKey,
    amount: BN
  ): Promise<void> {
    await this.program.methods
      .takeOffer(amount)
      .accounts({
        offer: offerPDA,
        creator: creator.publicKey,
        tokenMint,
        sellerTokenAccount,
        escrowAccount,
        trade: tradePDA,
        buyer: buyer.publicKey,
        buyerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        tradeProgram,
      })
      .signers([creator, buyer])
      .rpc();
  }

  async getOffer(offerPDA: PublicKey): Promise<Offer> {
    const account = await this.program.account.offer.fetch(offerPDA);
    return {
      creator: account.creator,
      tokenMint: account.tokenMint,
      amount: account.amount,
      pricePerToken: account.pricePerToken,
      minAmount: account.minAmount,
      maxAmount: account.maxAmount,
      status: this.convertOfferStatus(account.status),
      createdAt: account.createdAt.toNumber(),
      updatedAt: account.updatedAt.toNumber(),
    };
  }

  async findOfferAddress(creator: PublicKey): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from("offer"), creator.toBuffer()],
      this.program.programId
    );
  }

  private convertOfferStatus(status: any): OfferStatus {
    if ('active' in status) return OfferStatus.Active;
    if ('paused' in status) return OfferStatus.Paused;
    if ('closed' in status) return OfferStatus.Closed;
    throw new Error('Unknown offer status');
  }
} 