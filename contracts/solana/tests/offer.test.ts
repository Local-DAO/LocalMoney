import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
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
  const tokenMintKeypair = Keypair.generate();
  
  // Token accounts and mint
  let tokenMint: PublicKey;
  let creatorTokenAccount: PublicKey;
  let takerTokenAccount: PublicKey;
  let escrowTokenAccount: PublicKey;

  // Program IDs
  const TRADE_PROGRAM_ID = new PublicKey("ENJvkqkwjEKd2CPd9NgcwEywx6ia3tCrvHE1ReZGac8t");

  before(async () => {
    // Airdrop SOL to participants
    await airdropSol(provider.connection, creator.publicKey, 100);
    await delay(1000);
    await airdropSol(provider.connection, taker.publicKey, 100);
    await delay(1000);

    // Initialize token mint
    tokenMint = await createTokenMint(
      provider.connection,
      creator,
      creator.publicKey,
      null,
      6
    );
    await delay(500);

    creatorTokenAccount = await createTokenAccount(
      provider.connection,
      creator,
      tokenMint,
      creator.publicKey
    );
    await delay(500);

    takerTokenAccount = await createTokenAccount(
      provider.connection,
      taker,
      tokenMint,
      taker.publicKey
    );
    await delay(500);

    escrowTokenAccount = await createTokenAccount(
      provider.connection,
      creator,
      tokenMint,
      program.programId
    );
    await delay(500);

    // Mint some tokens to creator
    await mintTokens(
      provider.connection,
      creator,
      tokenMint,
      creatorTokenAccount,
      creator,
      1000_000_000 // 1000 tokens with 6 decimals
    );
    await delay(500);
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
        tokenMint: tokenMint,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator, offer])
      .rpc();

    const account = await program.account.offer.fetch(offer.publicKey);
    expect(account.creator.toString()).to.equal(creator.publicKey.toString());
    expect(account.tokenMint.toString()).to.equal(tokenMint.toString());
    expect(account.amount.toNumber()).to.equal(1000_000);
    expect(account.pricePerToken.toNumber()).to.equal(100_000);
    expect(account.minAmount.toNumber()).to.equal(100_000);
    expect(account.maxAmount.toNumber()).to.equal(1000_000);
    expect(account.status).to.deep.equal({ active: {} });
  });

  it("Fails to create offer with invalid amounts", async () => {
    const amount = new anchor.BN(1000_000);
    const pricePerToken = new anchor.BN(100_000);
    const minAmount = new anchor.BN(2000_000); // Min > Max
    const maxAmount = new anchor.BN(1000_000);
    const newOffer = Keypair.generate();

    try {
      await program.methods
        .createOffer(amount, pricePerToken, minAmount, maxAmount)
        .accounts({
          offer: newOffer.publicKey,
          creator: creator.publicKey,
          tokenMint: tokenMint,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator, newOffer])
        .rpc();
      expect.fail("Expected error");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("InvalidAmounts");
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
        tokenMint: tokenMint,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator, newOffer])
      .rpc();

    // Take the offer
    const takeAmount = new anchor.BN(500_000); // 0.5 token
    const trade = Keypair.generate();

    // Initialize trade account with proper space
    const TRADE_ACCOUNT_SIZE = 8 + // discriminator
      32 + // seller pubkey
      32 + // buyer pubkey (option)
      8 + // amount
      8 + // price
      32 + // token mint
      32 + // escrow account
      1 + // status
      8 + // created_at
      8; // updated_at

    const rent = await provider.connection.getMinimumBalanceForRentExemption(TRADE_ACCOUNT_SIZE);

    try {
      // Create trade account and take offer in one transaction
      await program.methods
        .takeOffer(takeAmount)
        .accounts({
          offer: newOffer.publicKey,
          taker: taker.publicKey,
          trade: trade.publicKey,
          tokenMint: tokenMint,
          sellerTokenAccount: creatorTokenAccount,
          escrowAccount: escrowTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          tradeProgram: TRADE_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([
          SystemProgram.createAccount({
            fromPubkey: provider.wallet.publicKey,
            newAccountPubkey: trade.publicKey,
            lamports: rent,
            space: TRADE_ACCOUNT_SIZE,
            programId: TRADE_PROGRAM_ID,
          }),
          // Initialize trade account with the trade program
          {
            programId: TRADE_PROGRAM_ID,
            keys: [
              { pubkey: trade.publicKey, isSigner: false, isWritable: true },
              { pubkey: creator.publicKey, isSigner: true, isWritable: true },
              { pubkey: tokenMint, isSigner: false, isWritable: false },
              { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
              { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
              { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([0]), // CreateTrade instruction = 0
          },
        ])
        .signers([taker, trade, creator])
        .rpc();

      // Verify token transfer to escrow
      const escrowBalance = await getTokenBalance(provider.connection, escrowTokenAccount);
      expect(escrowBalance).to.equal(500_000);
    } catch (err) {
      console.error("Error taking offer:", err);
      throw err;
    }
  });

  it("Fails to take offer with invalid amount", async () => {
    const takeAmount = new anchor.BN(50_000); // Below min amount
    const trade = Keypair.generate();
    const newOffer = Keypair.generate();

    // First create a valid offer
    await program.methods
      .createOffer(
        new anchor.BN(1000_000),
        new anchor.BN(100_000),
        new anchor.BN(100_000),
        new anchor.BN(1000_000)
      )
      .accounts({
        offer: newOffer.publicKey,
        creator: creator.publicKey,
        tokenMint: tokenMint,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator, newOffer])
      .rpc();

    // Initialize trade account
    const rent = await provider.connection.getMinimumBalanceForRentExemption(0);
    const createTradeAccountIx = SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: trade.publicKey,
      lamports: rent,
      space: 0,
      programId: TRADE_PROGRAM_ID,
    });

    try {
      // First create the trade account
      await provider.sendAndConfirm(
        new anchor.web3.Transaction().add(createTradeAccountIx),
        [trade]
      );

      // Then try to take the offer with invalid amount
      await program.methods
        .takeOffer(takeAmount)
        .accounts({
          offer: newOffer.publicKey,
          taker: taker.publicKey,
          trade: trade.publicKey,
          tokenMint: tokenMint,
          sellerTokenAccount: creatorTokenAccount,
          escrowAccount: escrowTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          tradeProgram: TRADE_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([taker])
        .rpc();
      expect.fail("Expected error");
    } catch (err: any) {
      if (err.toString().includes("InvalidAmount")) {
        // Test passed - we got the expected error
        return;
      }
      throw err;
    }
  });
}); 