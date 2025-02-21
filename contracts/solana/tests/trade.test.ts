import * as anchor from "@project-serum/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { TradeClient } from "../sdk/src/clients/trade";
import { PriceClient } from "../sdk/src/clients/price";
import { ProfileClient } from "../sdk/src/clients/profile";
import { airdropSol, delay, createTokenMint, createTokenAccount, mintTokens, getTokenBalance } from "../sdk/src/utils";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

describe("trade", () => {
  if (!process.env.TRADE_PROGRAM_ID || !process.env.PRICE_PROGRAM_ID || !process.env.PROFILE_PROGRAM_ID) {
    throw new Error("Required program IDs not found in environment. Make sure TRADE_PROGRAM_ID, PRICE_PROGRAM_ID, and PROFILE_PROGRAM_ID are set.");
  }

  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const TRADE_PROGRAM_ID = new PublicKey(process.env.TRADE_PROGRAM_ID);
  const PRICE_PROGRAM_ID = new PublicKey(process.env.PRICE_PROGRAM_ID);
  const PROFILE_PROGRAM_ID = new PublicKey(process.env.PROFILE_PROGRAM_ID);

  let tradeClient: TradeClient;
  let priceClient: PriceClient;
  let profileClient: ProfileClient;
  
  // Generate base keypairs for our test
  const seller = Keypair.generate();
  const buyer = Keypair.generate();
  const tokenMint = Keypair.generate();
  const priceOracle = Keypair.generate();

  // Additional sellers for different tests
  const cancelTestSeller = Keypair.generate();
  const disputeTestSeller = Keypair.generate();
  
  // Token accounts
  let sellerTokenAccount: PublicKey;
  let buyerTokenAccount: PublicKey;
  let cancelTestSellerTokenAccount: PublicKey;
  let disputeTestSellerTokenAccount: PublicKey;
  let escrowTokenAccount: PublicKey;
  let tradePDA: PublicKey;
  let tradeBump: number;
  let mint: PublicKey;

  // Profile PDAs
  let buyerProfile: PublicKey;
  let sellerProfile: PublicKey;
  let cancelTestSellerProfile: PublicKey;
  let disputeTestSellerProfile: PublicKey;

  before(async () => {
    // Load the IDLs
    const tradeIdl = require("../target/idl/trade.json");
    const priceIdl = require("../target/idl/price.json");
    const profileIdl = require("../target/idl/profile.json");

    // Initialize clients
    tradeClient = new TradeClient(TRADE_PROGRAM_ID, provider, tradeIdl);
    priceClient = new PriceClient(PRICE_PROGRAM_ID, provider, priceIdl);
    profileClient = new ProfileClient(PROFILE_PROGRAM_ID, provider, profileIdl);

    // Fund test accounts
    await airdropSol(provider.connection, seller.publicKey);
    await airdropSol(provider.connection, buyer.publicKey);
    await airdropSol(provider.connection, priceOracle.publicKey);
    await airdropSol(provider.connection, cancelTestSeller.publicKey);
    await airdropSol(provider.connection, disputeTestSeller.publicKey);
    await delay(1000);

    try {
      // Create token mint
      mint = await createTokenMint(
        provider.connection,
        provider.wallet.payer,
        provider.wallet.publicKey,
        null,
        6
      );
      await delay(1000);

      // Create token accounts
      sellerTokenAccount = await createTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        seller.publicKey
      );

      buyerTokenAccount = await createTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        buyer.publicKey
      );

      cancelTestSellerTokenAccount = await createTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        cancelTestSeller.publicKey
      );

      disputeTestSellerTokenAccount = await createTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        disputeTestSeller.publicKey
      );

      await delay(1000);

      // Mint tokens to all accounts
      await mintTokens(
        provider.connection,
        provider.wallet.payer,
        mint,
        sellerTokenAccount,
        provider.wallet.payer,
        1000_000_000 // 1000 tokens with 6 decimals
      );

      await mintTokens(
        provider.connection,
        provider.wallet.payer,
        mint,
        buyerTokenAccount,
        provider.wallet.payer,
        1000_000_000
      );

      await mintTokens(
        provider.connection,
        provider.wallet.payer,
        mint,
        cancelTestSellerTokenAccount,
        provider.wallet.payer,
        1000_000_000
      );

      await mintTokens(
        provider.connection,
        provider.wallet.payer,
        mint,
        disputeTestSellerTokenAccount,
        provider.wallet.payer,
        1000_000_000
      );

      await delay(1000);

      // Initialize price oracle
      await priceClient.initialize(priceOracle, provider.wallet.payer);
      await delay(1000);

      // Update prices in the oracle
      await priceClient.updatePrices(
        priceOracle.publicKey,
        provider.wallet.payer,
        [{
          currency: "USD",
          usdPrice: new anchor.BN(100_000), // $1.00 with 5 decimals
          updatedAt: new anchor.BN(Math.floor(Date.now() / 1000))
        }]
      );
      await delay(1000);

      // Initialize profiles
      buyerProfile = await profileClient.createProfile(buyer, "buyer");
      await delay(1000);

      sellerProfile = await profileClient.createProfile(seller, "seller");
      await delay(1000);

      cancelTestSellerProfile = await profileClient.createProfile(cancelTestSeller, "cancel-test-seller");
      await delay(1000);

      disputeTestSellerProfile = await profileClient.createProfile(disputeTestSeller, "dispute-test-seller");
      await delay(1000);

    } catch (error) {
      console.error("Error setting up test environment:", error);
      throw error;
    }
  });

  it("Creates a trade", async () => {
    const amount = new anchor.BN(1000_000); // 1 token
    const price = new anchor.BN(100_000); // $1.00 with 5 decimals

    // Create a new escrow keypair
    const escrowKeypair = Keypair.generate();

    tradePDA = await tradeClient.createTrade(
      seller,
      mint,
      sellerTokenAccount,
      escrowKeypair,
      amount,
      price
    );

    await delay(1000);

    const trade = await tradeClient.getTrade(tradePDA);
    expect(trade.seller.toString()).to.equal(seller.publicKey.toString());
    expect(trade.buyer).to.be.null;
    expect(trade.amount.toNumber()).to.equal(1000_000);
    expect(trade.price.toNumber()).to.equal(100_000);
    expect(trade.tokenMint.toString()).to.equal(mint.toString());
    expect(trade.escrowAccount.toString()).to.equal(escrowKeypair.publicKey.toString());
    expect(trade.status).to.equal('open');

    // Verify tokens were transferred to escrow
    const escrowBalance = await getTokenBalance(provider.connection, escrowKeypair.publicKey);
    expect(escrowBalance).to.equal(1000_000);

    // Update escrowTokenAccount for subsequent tests
    escrowTokenAccount = escrowKeypair.publicKey;
  });

  it("Accepts a trade", async () => {
    await tradeClient.acceptTrade(tradePDA, buyer);
    await delay(1000);

    const trade = await tradeClient.getTrade(tradePDA);
    expect(trade.buyer?.toString()).to.equal(buyer.publicKey.toString());
    expect(trade.status).to.equal('inProgress');
  });

  it("Completes a trade", async () => {
    await tradeClient.completeTrade(
      tradePDA,
      seller,
      buyer,
      escrowTokenAccount,
      buyerTokenAccount,
      priceOracle.publicKey,
      PRICE_PROGRAM_ID,
      buyerProfile,
      sellerProfile,
      PROFILE_PROGRAM_ID
    );
    await delay(1000);

    const trade = await tradeClient.getTrade(tradePDA);
    expect(trade.status).to.equal('completed');

    // Verify tokens were transferred to buyer
    const buyerBalance = await getTokenBalance(provider.connection, buyerTokenAccount);
    expect(buyerBalance).to.equal(1001_000_000); // Initial 1000 + 1 from trade
  });

  it("Cancels a trade", async () => {
    const amount = new anchor.BN(1000_000); // 1 token
    const price = new anchor.BN(100_000); // $1.00 with 5 decimals

    // Create a new escrow keypair
    const escrowKeypair = Keypair.generate();

    const cancelTradePDA = await tradeClient.createTrade(
      cancelTestSeller,
      mint,
      cancelTestSellerTokenAccount,
      escrowKeypair,
      amount,
      price
    );
    await delay(1000);

    await tradeClient.cancelTrade(
      cancelTradePDA,
      cancelTestSeller,
      escrowKeypair.publicKey,
      cancelTestSellerTokenAccount
    );
    await delay(1000);

    const trade = await tradeClient.getTrade(cancelTradePDA);
    expect(trade.status).to.equal('cancelled');
  });

  it("Disputes a trade", async () => {
    const amount = new anchor.BN(1000_000); // 1 token
    const price = new anchor.BN(100_000); // $1.00 with 5 decimals

    // Create a new escrow keypair
    const escrowKeypair = Keypair.generate();

    const disputeTradePDA = await tradeClient.createTrade(
      disputeTestSeller,
      mint,
      disputeTestSellerTokenAccount,
      escrowKeypair,
      amount,
      price
    );
    await delay(1000);

    await tradeClient.acceptTrade(disputeTradePDA, buyer);
    await delay(1000);

    await tradeClient.disputeTrade(disputeTradePDA, buyer);
    await delay(1000);

    const trade = await tradeClient.getTrade(disputeTradePDA);
    expect(trade.status).to.equal('disputed');
  });

  it("Fails to dispute with unauthorized user", async () => {
    const unauthorizedUser = Keypair.generate();
    await airdropSol(provider.connection, unauthorizedUser.publicKey);
    await delay(1000);

    try {
      await tradeClient.disputeTrade(tradePDA, unauthorizedUser);
      throw new Error("Expected error did not occur");
    } catch (error: any) {
      expect(error.error.errorCode.code).to.equal("UnauthorizedDisputer");
    }
  });
});