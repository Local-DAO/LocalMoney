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
    maker: Keypair,
    tokenMint: PublicKey,
    makerTokenAccount: PublicKey,
    escrowAccount: Keypair,
    amount: BN,
    price: BN
  ): Promise<PublicKey> {
    const [tradePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from("trade"),
        maker.publicKey.toBuffer(),
        tokenMint.toBuffer(),
      ],
      this.program.programId
    );

    await this.program.methods
      .createTrade(amount, price)
      .accounts({
        trade: tradePDA,
        maker: maker.publicKey,
        tokenMint,
        makerTokenAccount,
        escrowAccount: escrowAccount.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([maker, escrowAccount])
      .rpc();

    return tradePDA;
  }

  async acceptTrade(
    tradePDA: PublicKey,
    taker: Keypair
  ): Promise<void> {
    await this.program.methods
      .acceptTrade()
      .accounts({
        trade: tradePDA,
        taker: taker.publicKey,
      })
      .signers([taker])
      .rpc();
  }

  async completeTrade(
    tradePDA: PublicKey,
    maker: Keypair,
    taker: Keypair,
    escrowAccount: PublicKey,
    takerTokenAccount: PublicKey,
    priceOracle: PublicKey,
    priceProgram: PublicKey,
    takerProfile: PublicKey,
    makerProfile: PublicKey,
    profileProgram: PublicKey
  ): Promise<void> {
    await this.program.methods
      .completeTrade()
      .accounts({
        trade: tradePDA,
        maker: maker.publicKey,
        taker: taker.publicKey,
        escrowAccount,
        takerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        priceOracle,
        priceProgram,
        takerProfile,
        makerProfile,
        profileProgram,
      })
      .signers([maker, taker])
      .rpc();
  }

  async cancelTrade(
    tradePDA: PublicKey,
    maker: Keypair,
    escrowAccount: PublicKey,
    makerTokenAccount: PublicKey
  ): Promise<void> {
    await this.program.methods
      .cancelTrade()
      .accounts({
        trade: tradePDA,
        maker: maker.publicKey,
        escrowAccount,
        makerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([maker])
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
      maker: account.maker,
      taker: account.taker,
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
    maker: PublicKey,
    tokenMint: PublicKey
  ): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from("trade"),
        maker.toBuffer(),
        tokenMint.toBuffer(),
      ],
      this.program.programId
    );
  }

  async depositEscrow(
    tradePDA: PublicKey,
    depositor: Keypair,
    depositorTokenAccount: PublicKey,
    escrowAccount: PublicKey,
    amount: BN
  ): Promise<void> {
    await this.program.methods
      .depositEscrow(amount)
      .accounts({
        trade: tradePDA,
        escrowAccount: escrowAccount,
        depositor: depositor.publicKey,
        depositorTokenAccount: depositorTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([depositor])
      .rpc();
  }

  async getTradesByUser(userPublicKey: PublicKey): Promise<Trade[]> {
    // Fetch all trades
    const allTrades = await this.program.account.trade.all();
    
    // Filter trades where the user is either the maker or taker
    return allTrades
      .filter(account => {
        const trade = account.account;
        return (
          trade.maker.equals(userPublicKey) || 
          (trade.taker && trade.taker.equals(userPublicKey))
        );
      })
      .map(account => {
        const trade = account.account;
        return {
          publicKey: account.publicKey,
          maker: trade.maker,
          taker: trade.taker,
          amount: trade.amount,
          price: trade.price,
          tokenMint: trade.tokenMint,
          escrowAccount: trade.escrowAccount,
          status: this.convertTradeStatus(trade.status),
          createdAt: trade.createdAt.toNumber(),
          updatedAt: trade.updatedAt.toNumber(),
          bump: trade.bump,
        };
      });
  }

  private convertTradeStatus(status: any): TradeStatus {
    if ('created' in status) return TradeStatus.Created;
    if ('open' in status) return TradeStatus.Open;
    if ('inProgress' in status) return TradeStatus.InProgress;
    if ('completed' in status) return TradeStatus.Completed;
    if ('cancelled' in status) return TradeStatus.Cancelled;
    if ('disputed' in status) return TradeStatus.Disputed;
    throw new Error('Unknown trade status');
  }
} 