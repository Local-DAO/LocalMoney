import { Program, AnchorProvider, Idl } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { Profile } from '../types';

export class ProfileClient {
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

  async createProfile(
    owner: Keypair,
    username: string
  ): Promise<PublicKey> {
    const [profilePDA] = await PublicKey.findProgramAddress(
      [Buffer.from("profile"), owner.publicKey.toBuffer()],
      this.program.programId
    );

    await this.program.methods
      .createProfile(username)
      .accounts({
        profile: profilePDA,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    return profilePDA;
  }

  async updateProfile(
    profilePDA: PublicKey,
    owner: Keypair,
    username?: string
  ): Promise<void> {
    await this.program.methods
      .updateProfile(username)
      .accounts({
        profile: profilePDA,
        owner: owner.publicKey,
      })
      .signers([owner])
      .rpc();
  }

  async updateReputation(
    profilePDA: PublicKey,
    authority: Keypair,
    owner: PublicKey,
    scoreDelta: number
  ): Promise<void> {
    await this.program.methods
      .updateReputation(scoreDelta)
      .accounts({
        profile: profilePDA,
        authority: authority.publicKey,
        owner,
      })
      .signers([authority])
      .rpc();
  }

  async verifyProfile(
    profilePDA: PublicKey,
    authority: Keypair,
    owner: PublicKey
  ): Promise<void> {
    await this.program.methods
      .verifyProfile()
      .accounts({
        profile: profilePDA,
        authority: authority.publicKey,
        owner,
      })
      .signers([authority])
      .rpc();
  }

  async recordTradeCompletion(
    profilePDA: PublicKey,
    owner: PublicKey,
    tradeProgram: PublicKey
  ): Promise<void> {
    await this.program.methods
      .recordTradeCompletion()
      .accounts({
        profile: profilePDA,
        owner,
        tradeProgram,
      })
      .rpc();
  }

  async recordTradeDispute(
    profilePDA: PublicKey,
    owner: PublicKey,
    tradeProgram: PublicKey
  ): Promise<void> {
    await this.program.methods
      .recordTradeDispute()
      .accounts({
        profile: profilePDA,
        owner,
        tradeProgram,
      })
      .rpc();
  }

  async getProfile(profilePDA: PublicKey): Promise<Profile> {
    const account = await this.program.account.profile.fetch(profilePDA);
    const usernameBytes = account.username.slice(0, account.usernameLen);
    const username = Buffer.from(usernameBytes).toString('utf8');

    return {
      owner: account.owner,
      username,
      reputationScore: account.reputationScore,
      tradesCompleted: account.tradesCompleted,
      tradesDisputed: account.tradesDisputed,
      isVerified: account.isVerified,
      createdAt: account.createdAt.toNumber(),
      updatedAt: account.updatedAt.toNumber(),
    };
  }

  async findProfileAddress(owner: PublicKey): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from("profile"), owner.toBuffer()],
      this.program.programId
    );
  }
} 