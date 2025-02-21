import { Program, AnchorProvider, Idl, BN } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Trade, TradeStatus } from '../types';

export class TradeClient {
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

  async createTrade(
    seller: Keypair,
    tokenMint: PublicKey,
    sellerTokenAccount: PublicKey,
    escrowAccount: Keypair,
    amount: BN,
    price: BN
  ): Promise<PublicKey> {
    const [tradePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from("trade"),
        seller.publicKey.toBuffer(),
        tokenMint.toBuffer(),
      ],
      this.program.programId
    );

    await this.program.methods
      .createTrade(amount, price)
      .accounts({
        trade: tradePDA,
        seller: seller.publicKey,
        tokenMint,
        sellerTokenAccount,
        escrowAccount: escrowAccount.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([seller, escrowAccount])
      .rpc();

    return tradePDA;
  }

  async acceptTrade(
    tradePDA: PublicKey,
    buyer: Keypair
  ): Promise<void> {
    await this.program.methods
      .acceptTrade()
      .accounts({
        trade: tradePDA,
        buyer: buyer.publicKey,
      })
      .signers([buyer])
      .rpc();
  }

  async completeTrade(
    tradePDA: PublicKey,
    seller: Keypair,
    buyer: Keypair,
    escrowAccount: PublicKey,
    buyerTokenAccount: PublicKey,
    priceOracle: PublicKey,
    priceProgram: PublicKey,
    buyerProfile: PublicKey,
    sellerProfile: PublicKey,
    profileProgram: PublicKey
  ): Promise<void> {
    await this.program.methods
      .completeTrade()
      .accounts({
        trade: tradePDA,
        seller: seller.publicKey,
        buyer: buyer.publicKey,
        escrowAccount,
        buyerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        priceOracle,
        priceProgram,
        buyerProfile,
        sellerProfile,
        profileProgram,
      })
      .signers([seller, buyer])
      .rpc();
  }

  async cancelTrade(
    tradePDA: PublicKey,
    seller: Keypair,
    escrowAccount: PublicKey,
    sellerTokenAccount: PublicKey
  ): Promise<void> {
    await this.program.methods
      .cancelTrade()
      .accounts({
        trade: tradePDA,
        seller: seller.publicKey,
        escrowAccount,
        sellerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([seller])
      .rpc();
  }

  async disputeTrade(
    tradePDA: PublicKey,
    disputer: Keypair
  ): Promise<void> {
    await this.program.methods
      .disputeTrade()
      .accounts({
        trade: tradePDA,
        disputer: disputer.publicKey,
      })
      .signers([disputer])
      .rpc();
  }

  async getTrade(tradePDA: PublicKey): Promise<Trade> {
    const account = await this.program.account.trade.fetch(tradePDA);
    return {
      seller: account.seller,
      buyer: account.buyer,
      amount: account.amount,
      price: account.price,
      tokenMint: account.tokenMint,
      escrowAccount: account.escrowAccount,
      status: this.convertTradeStatus(account.status),
      createdAt: account.createdAt.toNumber(),
      updatedAt: account.updatedAt.toNumber(),
      bump: account.bump,
    };
  }

  async findTradeAddress(
    seller: PublicKey,
    tokenMint: PublicKey
  ): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from("trade"),
        seller.toBuffer(),
        tokenMint.toBuffer(),
      ],
      this.program.programId
    );
  }

  private convertTradeStatus(status: any): TradeStatus {
    if ('open' in status) return TradeStatus.Open;
    if ('inProgress' in status) return TradeStatus.InProgress;
    if ('completed' in status) return TradeStatus.Completed;
    if ('cancelled' in status) return TradeStatus.Cancelled;
    if ('disputed' in status) return TradeStatus.Disputed;
    throw new Error('Unknown trade status');
  }
} 