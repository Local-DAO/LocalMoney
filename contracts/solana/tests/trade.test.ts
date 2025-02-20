import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createInitializeMintInstruction } from "@solana/spl-token";
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

  const TRADE_PROGRAM_ID = new PublicKey("9S8i1BpwEW88Zn7uW28eBdYmw2C6EYwz1BHBoeZFkPCG");
  const SPL_TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const program = new anchor.Program(
    require("../target/idl/trade.json"),
    TRADE_PROGRAM_ID,
    provider
  ) as Program<Trade>;
  
  // Generate keypairs for our test
  const seller = Keypair.generate();
  const buyer = Keypair.generate();
  const tokenMint = Keypair.generate();
  const priceOracle = Keypair.generate();

  // Token accounts
  let sellerTokenAccount: PublicKey;
  let buyerTokenAccount: PublicKey;
  let escrowTokenAccount: PublicKey;
  let tradePDA: PublicKey;
  let tradeBump: number;

  before(async () => {
    // Airdrop SOL to participants
    await airdropSol(provider.connection, seller.publicKey);
    await airdropSol(provider.connection, buyer.publicKey);
    await delay(1000);

    // Find trade PDA
    [tradePDA, tradeBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("trade"),
        seller.publicKey.toBuffer(),
        tokenMint.publicKey.toBuffer(),
      ],
      TRADE_PROGRAM_ID
    );

    // Initialize token mint
    const mintTx = new anchor.web3.Transaction();
    const mintRent = await provider.connection.getMinimumBalanceForRentExemption(82);
    const createMintAccountIx = SystemProgram.createAccount({
      fromPubkey: seller.publicKey,
      newAccountPubkey: tokenMint.publicKey,
      lamports: mintRent,
      space: 82,
      programId: SPL_TOKEN_PROGRAM_ID,
    });
    mintTx.add(createMintAccountIx);

    const initMintIx = createInitializeMintInstruction(
      tokenMint.publicKey,
      6,
      seller.publicKey,
      null,
      SPL_TOKEN_PROGRAM_ID
    );
    mintTx.add(initMintIx);

    await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      mintTx,
      [seller, tokenMint]
    );
    await delay(500);

    // Create associated token accounts
    sellerTokenAccount = await getAssociatedTokenAddress(
      tokenMint.publicKey,
      seller.publicKey,
      false,
      SPL_TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    buyerTokenAccount = await getAssociatedTokenAddress(
      tokenMint.publicKey,
      buyer.publicKey,
      false,
      SPL_TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint.publicKey,
      tradePDA,
      true,
      SPL_TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Create token accounts
    const createSellerATAIx = createAssociatedTokenAccountInstruction(
      seller.publicKey,
      sellerTokenAccount,
      seller.publicKey,
      tokenMint.publicKey,
      SPL_TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createBuyerATAIx = createAssociatedTokenAccountInstruction(
      seller.publicKey,
      buyerTokenAccount,
      buyer.publicKey,
      tokenMint.publicKey,
      SPL_TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createEscrowATAIx = createAssociatedTokenAccountInstruction(
      seller.publicKey,
      escrowTokenAccount,
      tradePDA,
      tokenMint.publicKey,
      SPL_TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Create and send transaction for token account creation
    const tx = new anchor.web3.Transaction()
      .add(createSellerATAIx)
      .add(createBuyerATAIx)
      .add(createEscrowATAIx);

    await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      tx,
      [seller]
    );
    await delay(500);

    // Mint tokens to seller and buyer
    await mintTokens(
      provider.connection,
      seller,
      tokenMint.publicKey,
      sellerTokenAccount,
      seller,
      1000_000_000, // 1000 tokens with 6 decimals
      SPL_TOKEN_PROGRAM_ID
    );

    await mintTokens(
      provider.connection,
      seller,
      tokenMint.publicKey,
      buyerTokenAccount,
      seller,
      1000_000_000, // 1000 tokens with 6 decimals
      SPL_TOKEN_PROGRAM_ID
    );
  });

  it("Creates a trade", async () => {
    const amount = new anchor.BN(1000_000); // 1 token
    const price = new anchor.BN(100_000); // $1.00 with 5 decimals

    // Create a new escrow token account for this trade
    const newEscrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint.publicKey,
      tradePDA,
      true,
      SPL_TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createEscrowATAIx = createAssociatedTokenAccountInstruction(
      seller.publicKey,
      newEscrowTokenAccount,
      tradePDA,
      tokenMint.publicKey,
      SPL_TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await program.methods
      .createTrade(amount, price)
      .accounts({
        trade: tradePDA,
        seller: seller.publicKey,
        tokenMint: tokenMint.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        escrowAccount: newEscrowTokenAccount,
        tokenProgram: SPL_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([createEscrowATAIx])
      .signers([seller])
      .rpc();

    const account = await program.account.trade.fetch(tradePDA);
    expect(account.seller.toString()).to.equal(seller.publicKey.toString());
    expect(account.buyer).to.be.null;
    expect(account.amount.toNumber()).to.equal(1000_000);
    expect(account.price.toNumber()).to.equal(100_000);
    expect(account.tokenMint.toString()).to.equal(tokenMint.publicKey.toString());
    expect(account.escrowAccount.toString()).to.equal(newEscrowTokenAccount.toString());
    expect(account.status).to.deep.equal({ open: {} });

    // Verify tokens were transferred to escrow
    const escrowBalance = await getTokenBalance(provider.connection, newEscrowTokenAccount);
    expect(escrowBalance).to.equal(1000_000);

    // Update escrowTokenAccount for subsequent tests
    escrowTokenAccount = newEscrowTokenAccount;
  });

  it("Accepts a trade", async () => {
    await program.methods
      .acceptTrade()
      .accounts({
        trade: tradePDA,
        buyer: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const account = await program.account.trade.fetch(tradePDA);
    expect(account.buyer?.toString()).to.equal(buyer.publicKey.toString());
    expect(account.status).to.deep.equal({ inProgress: {} });
  });

  it("Completes a trade", async () => {
    await program.methods
      .completeTrade()
      .accounts({
        trade: tradePDA,
        seller: seller.publicKey,
        buyer: buyer.publicKey,
        escrowAccount: escrowTokenAccount,
        buyerTokenAccount: buyerTokenAccount,
        tokenProgram: SPL_TOKEN_PROGRAM_ID,
        priceOracle: priceOracle.publicKey,
        priceProgram: priceOracle.publicKey, // This would be the actual price program in production
        profileProgram: priceOracle.publicKey, // This would be the actual profile program in production
        buyerProfile: buyer.publicKey,
        sellerProfile: seller.publicKey,
      })
      .signers([seller, buyer])
      .rpc();

    const account = await program.account.trade.fetch(tradePDA);
    expect(account.status).to.deep.equal({ completed: {} });

    // Verify tokens were transferred to buyer
    const buyerBalance = await getTokenBalance(provider.connection, buyerTokenAccount);
    expect(buyerBalance).to.equal(1001_000_000); // Original balance + traded amount
  });

  it("Cancels a trade", async () => {
    // Create a new trade to cancel
    const [cancelTradePDA, cancelTradeBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("trade"),
        seller.publicKey.toBuffer(),
        tokenMint.publicKey.toBuffer(),
      ],
      TRADE_PROGRAM_ID
    );

    // Create a new escrow token account for this trade
    const cancelEscrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint.publicKey,
      cancelTradePDA,
      true,
      SPL_TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createEscrowATAIx = createAssociatedTokenAccountInstruction(
      seller.publicKey,
      cancelEscrowTokenAccount,
      cancelTradePDA,
      tokenMint.publicKey,
      SPL_TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const amount = new anchor.BN(1000_000);
    const price = new anchor.BN(100_000);

    await program.methods
      .createTrade(amount, price)
      .accounts({
        trade: cancelTradePDA,
        seller: seller.publicKey,
        tokenMint: tokenMint.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        escrowAccount: cancelEscrowTokenAccount,
        tokenProgram: SPL_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([createEscrowATAIx])
      .signers([seller])
      .rpc();

    // Cancel the trade
    await program.methods
      .cancelTrade()
      .accounts({
        trade: cancelTradePDA,
        seller: seller.publicKey,
        escrowAccount: cancelEscrowTokenAccount,
        sellerTokenAccount: sellerTokenAccount,
        tokenProgram: SPL_TOKEN_PROGRAM_ID,
      })
      .signers([seller])
      .rpc();

    const account = await program.account.trade.fetch(cancelTradePDA);
    expect(account.status).to.deep.equal({ cancelled: {} });

    // Verify tokens were returned to seller
    const sellerBalance = await getTokenBalance(provider.connection, sellerTokenAccount);
    expect(sellerBalance).to.equal(999_000_000); // Original balance - completed trade amount
  });

  it("Disputes a trade", async () => {
    // Create and accept a new trade to dispute
    const [disputeTradePDA, disputeTradeBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("trade"),
        seller.publicKey.toBuffer(),
        tokenMint.publicKey.toBuffer(),
      ],
      TRADE_PROGRAM_ID
    );

    // Create a new escrow token account for this trade
    const disputeEscrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint.publicKey,
      disputeTradePDA,
      true,
      SPL_TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createEscrowATAIx = createAssociatedTokenAccountInstruction(
      seller.publicKey,
      disputeEscrowTokenAccount,
      disputeTradePDA,
      tokenMint.publicKey,
      SPL_TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const amount = new anchor.BN(1000_000);
    const price = new anchor.BN(100_000);

    await program.methods
      .createTrade(amount, price)
      .accounts({
        trade: disputeTradePDA,
        seller: seller.publicKey,
        tokenMint: tokenMint.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        escrowAccount: disputeEscrowTokenAccount,
        tokenProgram: SPL_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([createEscrowATAIx])
      .signers([seller])
      .rpc();

    await program.methods
      .acceptTrade()
      .accounts({
        trade: disputeTradePDA,
        buyer: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    // Dispute the trade as buyer
    await program.methods
      .disputeTrade()
      .accounts({
        trade: disputeTradePDA,
        disputer: buyer.publicKey,
      })
      .signers([buyer])
      .rpc();

    const account = await program.account.trade.fetch(disputeTradePDA);
    expect(account.status).to.deep.equal({ disputed: {} });
  });

  it("Fails to dispute with unauthorized user", async () => {
    const unauthorizedUser = Keypair.generate();
    await airdropSol(provider.connection, unauthorizedUser.publicKey);
    await delay(1000);

    try {
      await program.methods
        .disputeTrade()
        .accounts({
          trade: tradePDA,
          disputer: unauthorizedUser.publicKey,
        })
        .signers([unauthorizedUser])
        .rpc();
      expect.fail("Expected error");
    } catch (err: any) {
      if (err.error && err.error.errorCode) {
        expect(err.error.errorCode.code).to.equal("UnauthorizedDisputer");
      } else {
        throw err;
      }
    }
  });
});