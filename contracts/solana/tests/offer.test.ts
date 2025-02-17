import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { Offer } from "../target/types/offer";
import {
  airdropSol,
  delay,
  createTokenMint,
  createTokenAccount,
  mintTokens,
  getTokenBalance,
} from "./utils";

describe("offer", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Offer as Program<Offer>;
  
  // Generate keypairs for our test
  const creator = Keypair.generate();
  const taker = Keypair.generate();
  const offer = Keypair.generate();
  const tokenMint = Keypair.generate();

  // Token accounts
  let creatorTokenAccount: PublicKey;
  let takerTokenAccount: PublicKey;
  let escrowTokenAccount: PublicKey;

  before(async () => {
    // Airdrop SOL to participants
    await airdropSol(provider.connection, creator.publicKey);
    await airdropSol(provider.connection, taker.publicKey);
    await delay(1000);

    // Initialize token mint and accounts
    await createTokenMint(
      provider.connection,
      creator,
      creator.publicKey,
      null,
      6
    );

    creatorTokenAccount = await createTokenAccount(
      provider.connection,
      creator,
      tokenMint.publicKey,
      creator.publicKey
    );

    takerTokenAccount = await createTokenAccount(
      provider.connection,
      taker,
      tokenMint.publicKey,
      taker.publicKey
    );

    escrowTokenAccount = await createTokenAccount(
      provider.connection,
      creator,
      tokenMint.publicKey,
      program.programId
    );

    // Mint some tokens to creator
    await mintTokens(
      provider.connection,
      creator,
      tokenMint.publicKey,
      creatorTokenAccount,
      creator,
      1000_000_000 // 1000 tokens with 6 decimals
    );
  });

  it("Creates an offer", async () => {
    const amount = new anchor.BN(1000_000); // 1 token
    const pricePerToken = new anchor.BN(100_000); // $1.00 with 5 decimals
    const minAmount = new anchor.BN(100_000); // 0.1 token
    const maxAmount = new anchor.BN(1000_000); // 1 token

    await program.methods
      .createOffer(amount, pricePerToken, minAmount, maxAmount)
      .accounts({
        offer: offer.publicKey,
        creator: creator.publicKey,
        tokenMint: tokenMint.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator, offer])
      .rpc();

    const account = await program.account.offer.fetch(offer.publicKey);
    expect(account.creator.toString()).to.equal(creator.publicKey.toString());
    expect(account.tokenMint.toString()).to.equal(tokenMint.publicKey.toString());
    expect(account.amount.toNumber()).to.equal(1000_000);
    expect(account.pricePerToken.toNumber()).to.equal(100_000);
    expect(account.minAmount.toNumber()).to.equal(100_000);
    expect(account.maxAmount.toNumber()).to.equal(1000_000);
    expect(account.status).to.equal({ active: {} });
  });

  it("Fails to create offer with invalid amounts", async () => {
    const amount = new anchor.BN(1000_000);
    const pricePerToken = new anchor.BN(100_000);
    const minAmount = new anchor.BN(2000_000); // Min > Max
    const maxAmount = new anchor.BN(1000_000);

    try {
      await program.methods
        .createOffer(amount, pricePerToken, minAmount, maxAmount)
        .accounts({
          offer: Keypair.generate().publicKey,
          creator: creator.publicKey,
          tokenMint: tokenMint.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
      expect.fail("Expected error");
    } catch (err) {
      const anchorError = err as anchor.AnchorError;
      expect(anchorError.error.errorCode.code).to.equal("InvalidAmounts");
    }
  });

  it("Updates offer price and amounts", async () => {
    const newPrice = new anchor.BN(110_000); // $1.10
    const newMin = new anchor.BN(200_000); // 0.2 token
    const newMax = new anchor.BN(900_000); // 0.9 token

    await program.methods
      .updateOffer(newPrice, newMin, newMax)
      .accounts({
        offer: offer.publicKey,
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();

    const account = await program.account.offer.fetch(offer.publicKey);
    expect(account.pricePerToken.toNumber()).to.equal(110_000);
    expect(account.minAmount.toNumber()).to.equal(200_000);
    expect(account.maxAmount.toNumber()).to.equal(900_000);
  });

  it("Manages offer lifecycle (pause/resume/close)", async () => {
    // Pause offer
    await program.methods
      .pauseOffer()
      .accounts({
        offer: offer.publicKey,
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();

    let account = await program.account.offer.fetch(offer.publicKey);
    expect(account.status).to.deep.equal({ paused: {} });

    // Resume offer
    await program.methods
      .resumeOffer()
      .accounts({
        offer: offer.publicKey,
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();

    account = await program.account.offer.fetch(offer.publicKey);
    expect(account.status).to.deep.equal({ active: {} });

    // Close offer
    await program.methods
      .closeOffer()
      .accounts({
        offer: offer.publicKey,
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();

    account = await program.account.offer.fetch(offer.publicKey);
    expect(account.status).to.deep.equal({ closed: {} });
  });

  it("Takes an offer", async () => {
    // Create a new active offer first
    const newOffer = Keypair.generate();
    const amount = new anchor.BN(1000_000);
    const pricePerToken = new anchor.BN(100_000);
    const minAmount = new anchor.BN(100_000);
    const maxAmount = new anchor.BN(1000_000);

    await program.methods
      .createOffer(amount, pricePerToken, minAmount, maxAmount)
      .accounts({
        offer: newOffer.publicKey,
        creator: creator.publicKey,
        tokenMint: tokenMint.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator, newOffer])
      .rpc();

    // Take the offer
    const takeAmount = new anchor.BN(500_000); // 0.5 token
    const trade = Keypair.generate();

    await program.methods
      .takeOffer(takeAmount)
      .accounts({
        offer: newOffer.publicKey,
        taker: taker.publicKey,
        trade: trade.publicKey,
        tokenMint: tokenMint.publicKey,
        sellerTokenAccount: creatorTokenAccount,
        escrowAccount: escrowTokenAccount,
        tokenProgram: anchor.spl.token.TOKEN_PROGRAM_ID,
        tradeProgram: trade.publicKey, // This would be the actual trade program in production
        systemProgram: SystemProgram.programId,
      })
      .signers([taker, trade])
      .rpc();

    // Verify token transfer to escrow
    const escrowBalance = await getTokenBalance(provider.connection, escrowTokenAccount);
    expect(escrowBalance).to.equal(500_000);
  });

  it("Fails to take offer with invalid amount", async () => {
    const takeAmount = new anchor.BN(50_000); // Below min amount
    const trade = Keypair.generate();

    try {
      await program.methods
        .takeOffer(takeAmount)
        .accounts({
          offer: offer.publicKey,
          taker: taker.publicKey,
          trade: trade.publicKey,
          tokenMint: tokenMint.publicKey,
          sellerTokenAccount: creatorTokenAccount,
          escrowAccount: escrowTokenAccount,
          tokenProgram: anchor.spl.token.TOKEN_PROGRAM_ID,
          tradeProgram: trade.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([taker, trade])
        .rpc();
      expect.fail("Expected error");
    } catch (err) {
      const anchorError = err as anchor.AnchorError;
      expect(anchorError.error.errorCode.code).to.equal("InvalidAmount");
    }
  });
}); 