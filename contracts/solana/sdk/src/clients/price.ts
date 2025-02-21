import { Program, AnchorProvider, Idl, BN } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { CurrencyPrice } from '../types';

export class PriceClient {
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

  async initialize(
    state: Keypair,
    admin: Keypair
  ): Promise<void> {
    await this.program.methods
      .initialize()
      .accounts({
        state: state.publicKey,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin, state])
      .rpc();
  }

  async updatePrices(
    oracle: PublicKey,
    priceProvider: Keypair,
    prices: CurrencyPrice[]
  ): Promise<void> {
    await this.program.methods
      .updatePrices(prices)
      .accounts({
        oracle,
        priceProvider: priceProvider.publicKey,
      })
      .signers([priceProvider])
      .rpc();
  }

  async verifyPriceForTrade(
    oracle: PublicKey,
    tradePrice: BN,
    currency: string,
    toleranceBps: number
  ): Promise<void> {
    await this.program.methods
      .verifyPriceForTrade(
        tradePrice,
        currency,
        toleranceBps
      )
      .accounts({
        oracle,
      })
      .rpc();
  }

  async getPriceState(oracle: PublicKey): Promise<{
    isInitialized: boolean;
    admin: PublicKey;
    priceProvider: PublicKey;
    prices: CurrencyPrice[];
  }> {
    const account = await this.program.account.priceState.fetch(oracle);
    return {
      isInitialized: account.isInitialized,
      admin: account.admin,
      priceProvider: account.priceProvider,
      prices: account.prices,
    };
  }
} 