import { Program, AnchorProvider, Idl, BN } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
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
    // Get the PDA with consistent seed derivation
    const [offerPDA] = await this.findOfferAddress(
      maker.publicKey,
      tokenMint,
      offerType,
      minAmount,
      maxAmount
    );

    await this.program.methods
      .createOffer(pricePerToken, minAmount, maxAmount, { [offerType === OfferType.Buy ? 'buy' : 'sell']: {} })
      .accounts({
        offer: offerPDA,
        maker: maker.publicKey,
        tokenMint: tokenMint,
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
    // Convert offer type to u8 (0 for Buy, 1 for Sell) - matches Rust to_u8()
    const offerTypeByte = Buffer.alloc(1);
    offerTypeByte.writeUInt8(offerType === OfferType.Buy ? 0 : 1, 0);
    
    // Convert amounts to little-endian bytes to match to_le_bytes() in Rust
    const minAmountBuffer = Buffer.alloc(8);
    minAmountBuffer.writeBigUInt64LE(BigInt(minAmount.toString()), 0);
    
    const maxAmountBuffer = Buffer.alloc(8);
    maxAmountBuffer.writeBigUInt64LE(BigInt(maxAmount.toString()), 0);
    
    return await PublicKey.findProgramAddress(
      [
        Buffer.from("offer"), 
        maker.toBuffer(),
        tokenMint.toBuffer(),
        offerTypeByte,
        minAmountBuffer,
        maxAmountBuffer
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