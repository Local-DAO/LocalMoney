import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { Trade } from "../target/types/trade";
import {
  airdropSol,
  delay,
  createTokenMint,
  createTokenAccount,
  mintTokens,
  getTokenBalance,
} from "./utils";

describe("trade", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Trade as Program<Trade>;
  
  // Generate keypairs for our test
  const seller = Keypair.generate();
  const buyer = Keypair.generate();
  const trade = Keypair.generate();
  const tokenMint = Keypair.generate();
  const priceOracle = Keypair.generate();

  // Token accounts
  let sellerTokenAccount: PublicKey;
  let buyerTokenAccount: PublicKey;
  let escrowTokenAccount: PublicKey;

  before(async () => {
    // Airdrop SOL to participants
    await airdropSol(provider.connection, seller.publicKey);
    await airdropSol(provider.connection, buyer.publicKey);
    await delay(1000);

    // Initialize token mint and accounts
    await createTokenMint(
      provider.connection,
      seller,
      seller.publicKey,
      null,
      6
    );

    sellerTokenAccount = await createTokenAccount(
      provider.connection,
      seller,
      tokenMint.publicKey,
      seller.publicKey
    );

    buyerTokenAccount = await createTokenAccount(
      provider.connection,
      buyer,
      tokenMint.publicKey,
      buyer.publicKey
    );

    escrowTokenAccount = await createTokenAccount(
      provider.connection,
      seller,
      tokenMint.publicKey,
      program.programId
    );

    // Mint some tokens to seller and buyer
    await mintTokens(
      provider.connection,
      seller,
      tokenMint.publicKey,
      sellerTokenAccount,
      seller,
      1000_000_000 // 1000 tokens with 6 decimals
    );

    await mintTokens(
      provider.connection,
      seller,
      tokenMint.publicKey,
      buyerTokenAccount,
      seller,
      1000_000_000 // 1000 tokens with 6 decimals
    );
  });

  it("Creates a trade", async () => {
    const amount = new anchor.BN(1000_000); // 1 token
    const price = new anchor.BN(100_000); // $1.00 with 5 decimals

    await program.methods
      .createTrade(amount, price)
      .accounts({
        trade: trade.publicKey,
        seller: seller.publicKey,
        tokenMint: tokenMint.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        escrowAccount: escrowTokenAccount,
        tokenProgram: anchor.spl.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller, trade])
      .rpc();

    const account = await program.account.trade.fetch(trade.publicKey);
    expect(account.seller.toString()).to.equal(seller.publicKey.toString());
    expect(account.buyer).to.be.null;
    expect(account.amount.toNumber()).to.equal(1000_000);
    expect(account.price.toNumber()).to.equal(100_000);
    expect(account.tokenMint.toString()).to.equal(tokenMint.publicKey.toString());
    expect(account.escrowAccount.toString()).to.equal(escrowTokenAccount.toString());
    expect(account.status).to.deep.equal({ open: {} });

    // Verify tokens were transferred to escrow
    const escrowBalance = await getTokenBalance(provider.connection, escrowTokenAccount);
    expect(escrowBalance).to.equal(1000_000);
  });

  it("Accepts a trade", async () => {
    await program.methods
      .acceptTrade()
      .accounts({
        trade: trade.publicKey,
        buyer: buyer.publicKey,
      })
      .signers([buyer])
      .rpc();

    const account = await program.account.trade.fetch(trade.publicKey);
    expect(account.buyer?.toString()).to.equal(buyer.publicKey.toString());
    expect(account.status).to.deep.equal({ inProgress: {} });
  });

  it("Completes a trade", async () => {
    await program.methods
      .completeTrade()
      .accounts({
        trade: trade.publicKey,
        seller: seller.publicKey,
        buyer: buyer.publicKey,
        escrowAccount: escrowTokenAccount,
        buyerTokenAccount: buyerTokenAccount,
        tokenProgram: anchor.spl.token.TOKEN_PROGRAM_ID,
        priceOracle: priceOracle.publicKey,
        priceProgram: priceOracle.publicKey, // This would be the actual price program in production
        profileProgram: priceOracle.publicKey, // This would be the actual profile program in production
        buyerProfile: buyer.publicKey,
        sellerProfile: seller.publicKey,
      })
      .signers([seller, buyer])
      .rpc();

    const account = await program.account.trade.fetch(trade.publicKey);
    expect(account.status).to.deep.equal({ completed: {} });

    // Verify tokens were transferred to buyer
    const buyerBalance = await getTokenBalance(provider.connection, buyerTokenAccount);
    expect(buyerBalance).to.equal(1001_000_000); // Original balance + traded amount
  });

  it("Cancels a trade", async () => {
    // Create a new trade to cancel
    const newTrade = Keypair.generate();
    const amount = new anchor.BN(1000_000);
    const price = new anchor.BN(100_000);

    await program.methods
      .createTrade(amount, price)
      .accounts({
        trade: newTrade.publicKey,
        seller: seller.publicKey,
        tokenMint: tokenMint.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        escrowAccount: escrowTokenAccount,
        tokenProgram: anchor.spl.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller, newTrade])
      .rpc();

    // Cancel the trade
    await program.methods
      .cancelTrade()
      .accounts({
        trade: newTrade.publicKey,
        seller: seller.publicKey,
        escrowAccount: escrowTokenAccount,
        sellerTokenAccount: sellerTokenAccount,
        tokenProgram: anchor.spl.token.TOKEN_PROGRAM_ID,
      })
      .signers([seller])
      .rpc();

    const account = await program.account.trade.fetch(newTrade.publicKey);
    expect(account.status).to.deep.equal({ cancelled: {} });

    // Verify tokens were returned to seller
    const sellerBalance = await getTokenBalance(provider.connection, sellerTokenAccount);
    expect(sellerBalance).to.equal(999_000_000); // Original balance - completed trade amount
  });

  it("Disputes a trade", async () => {
    // Create and accept a new trade to dispute
    const disputedTrade = Keypair.generate();
    const amount = new anchor.BN(1000_000);
    const price = new anchor.BN(100_000);

    await program.methods
      .createTrade(amount, price)
      .accounts({
        trade: disputedTrade.publicKey,
        seller: seller.publicKey,
        tokenMint: tokenMint.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        escrowAccount: escrowTokenAccount,
        tokenProgram: anchor.spl.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller, disputedTrade])
      .rpc();

    await program.methods
      .acceptTrade()
      .accounts({
        trade: disputedTrade.publicKey,
        buyer: buyer.publicKey,
      })
      .signers([buyer])
      .rpc();

    // Dispute the trade as buyer
    await program.methods
      .disputeTrade()
      .accounts({
        trade: disputedTrade.publicKey,
        disputer: buyer.publicKey,
      })
      .signers([buyer])
      .rpc();

    const account = await program.account.trade.fetch(disputedTrade.publicKey);
    expect(account.status).to.deep.equal({ disputed: {} });
  });

  it("Fails to dispute with unauthorized user", async () => {
    const unauthorizedUser = Keypair.generate();
    await airdropSol(provider.connection, unauthorizedUser.publicKey);

    try {
      await program.methods
        .disputeTrade()
        .accounts({
          trade: trade.publicKey,
          disputer: unauthorizedUser.publicKey,
        })
        .signers([unauthorizedUser])
        .rpc();
      expect.fail("Expected error");
    } catch (err) {
      const anchorError = err as anchor.AnchorError;
      expect(anchorError.error.errorCode.code).to.equal("UnauthorizedDisputer");
    }
  });
}); 