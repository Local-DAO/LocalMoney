import * as anchor from "@project-serum/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { OfferClient } from "../sdk/src/clients/offer";
import { airdropSol, delay, createTokenMint, createTokenAccount, mintTokens, getTokenBalance } from "../sdk/src/utils";
import * as dotenv from "dotenv";
import { OfferType } from "../sdk/src/types";

// Load environment variables from .env file
dotenv.config();

describe("offer", () => {
  if (!process.env.OFFER_PROGRAM_ID ) {
    throw new Error("Required program IDs not found in environment. Make sure OFFER_PROGRAM_ID is set.");
  }

  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const OFFER_PROGRAM_ID = new PublicKey(process.env.OFFER_PROGRAM_ID);

  let offerClient: OfferClient;
  
  // Generate keypairs for our test
  const creator = Keypair.generate();
  const taker = Keypair.generate();
  const mintAuthority = Keypair.generate();
  
  // Token accounts and mint
  let tokenMint: PublicKey;
  let takerTokenAccount: PublicKey;
  let creatorTokenAccount: PublicKey;

  before(async () => {
    // Load the IDLs
    const offerIdl = require("../target/idl/offer.json");

    // Initialize clients
    offerClient = new OfferClient(OFFER_PROGRAM_ID, provider, offerIdl);

    try {
      // Airdrop SOL to taker and mint authority
      await airdropSol(provider.connection, taker.publicKey, 100);
      await delay(1000);
      await airdropSol(provider.connection, mintAuthority.publicKey, 100);
      await delay(1000);

      // Initialize token mint
      tokenMint = await createTokenMint(
        provider.connection,
        mintAuthority,
        mintAuthority.publicKey,
        null,
        6
      );
      await delay(1000);

      takerTokenAccount = await createTokenAccount(
        provider.connection,
        mintAuthority,
        tokenMint,
        taker.publicKey
      );
      await delay(1000);

      // Mint some tokens to taker for testing
      await mintTokens(
        provider.connection,
        mintAuthority,
        tokenMint,
        takerTokenAccount,
        mintAuthority,
        1000_000_000 // 1000 tokens with 6 decimals
      );
      await delay(1000);
    } catch (error) {
      console.error("Error in test setup:", error);
      throw error;
    }
  });

  async function setupCreator() {
    const creator = Keypair.generate();
    await airdropSol(provider.connection, creator.publicKey, 100);
    await delay(1000);

    const creatorTokenAccount = await createTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      creator.publicKey,
      TOKEN_PROGRAM_ID
    );
    await delay(1000);

    await mintTokens(
      provider.connection,
      mintAuthority,
      tokenMint,
      creatorTokenAccount,
      mintAuthority,
      1000_000, // Mint 1 token with 6 decimals
      TOKEN_PROGRAM_ID
    );
    await delay(1000);

    // Set offer parameters
    const pricePerToken = new anchor.BN(100_000); // $1.00 with 5 decimals
    const minAmount = new anchor.BN(100_000); // 0.1 token
    const maxAmount = new anchor.BN(1000_000); // 1 token
    const offerType = OfferType.Sell;

    // Find the offer PDA with new seed formula
    const [offerPDA] = await offerClient.findOfferAddress(
      creator.publicKey,
      tokenMint,
      offerType,
      minAmount,
      maxAmount
    );
    
    // Create escrow token account
    const escrowTokenAccount = Keypair.generate();

    return { 
      creator, 
      creatorTokenAccount, 
      offerPDA, 
      escrowTokenAccount, 
      pricePerToken,
      minAmount,
      maxAmount,
      offerType
    };
  }

  it("Creates an offer", async () => {
    const { 
      creator, 
      offerPDA,
      pricePerToken,
      minAmount,
      maxAmount,
      offerType 
    } = await setupCreator();

    try {
      await offerClient.createOffer(
        creator,
        tokenMint,
        pricePerToken,
        minAmount,
        maxAmount,
        offerType
      );

      const offer = await offerClient.getOffer(offerPDA);
      expect(offer.maker.toString()).to.equal(creator.publicKey.toString());
      expect(offer.tokenMint.toString()).to.equal(tokenMint.toString());
      expect(offer.pricePerToken.toNumber()).to.equal(100_000);
      expect(offer.minAmount.toNumber()).to.equal(100_000);
      expect(offer.maxAmount.toNumber()).to.equal(1000_000);
      expect(offer.status).to.equal('active');
    } catch (error) {
      console.error("Error creating offer:", error);
      throw error;
    }
  });

  it("Updates offer price and amounts", async () => {
    const { 
      creator, 
      creatorTokenAccount, 
      offerPDA,
      pricePerToken,
      minAmount,
      maxAmount,
      offerType 
    } = await setupCreator();

    try {
      // First create a new offer
      await offerClient.createOffer(
        creator,
        tokenMint,
        pricePerToken,
        minAmount,
        maxAmount,
        offerType
      );

      // Now update it
      const newPrice = new anchor.BN(110_000); // $1.10
      const newMin = new anchor.BN(200_000); // 0.2 token
      const newMax = new anchor.BN(900_000); // 0.9 token

      await offerClient.updateOffer(
        offerPDA,
        creator,
        newPrice,
        newMin,
        newMax
      );

      const offer = await offerClient.getOffer(offerPDA);
      expect(offer.pricePerToken.toNumber()).to.equal(110_000);
      expect(offer.minAmount.toNumber()).to.equal(200_000);
      expect(offer.maxAmount.toNumber()).to.equal(900_000);
    } catch (error) {
      console.error("Error updating offer:", error);
      throw error;
    }
  });

  it("Manages offer lifecycle (pause/resume/close)", async () => {
    const { 
      creator, 
      creatorTokenAccount, 
      offerPDA,
      pricePerToken,
      minAmount,
      maxAmount,
      offerType 
    } = await setupCreator();

    try {
      // First create a new offer
      await offerClient.createOffer(
        creator,
        tokenMint,
        pricePerToken,
        minAmount,
        maxAmount,
        offerType
      );

      // Pause it
      await offerClient.pauseOffer(offerPDA, creator);
      let offer = await offerClient.getOffer(offerPDA);
      expect(offer.status).to.equal('paused');

      // Resume it
      await offerClient.resumeOffer(offerPDA, creator);
      offer = await offerClient.getOffer(offerPDA);
      expect(offer.status).to.equal('active');

      // Close it
      await offerClient.closeOffer(offerPDA, creator);
      offer = await offerClient.getOffer(offerPDA);
      expect(offer.status).to.equal('closed');
    } catch (error) {
      console.error("Error managing offer lifecycle:", error);
      throw error;
    }
  });

  it("Creates 3 offers with different parameters and load through the all query", async () => {
    const { 
      creator, 
      creatorTokenAccount, 
      offerPDA,
      pricePerToken,  
    } = await setupCreator();

    try {
      // Create 3 offers with different parameters
      const offer1 = await offerClient.createOffer(
        creator,
        tokenMint,
        new anchor.BN(100_000), // $1.00
        new anchor.BN(100_000), // 0.1 token
        new anchor.BN(1000_000), // 1 token
        OfferType.Sell
      );
      await delay(1000); // Wait for transaction to be confirmed

      const offer2 = await offerClient.createOffer(
        creator,
        tokenMint,
        new anchor.BN(110_000), // $1.10
        new anchor.BN(200_000), // 0.2 token
        new anchor.BN(900_000), // 0.9 token
        OfferType.Sell
      );
      await delay(1000); // Wait for transaction to be confirmed

      const offer3 = await offerClient.createOffer(
        creator,  
        tokenMint,
        new anchor.BN(120_000), // $1.20
        new anchor.BN(300_000), // 0.3 token
        new anchor.BN(800_000), // 0.8 token
        OfferType.Sell
      );  
      await delay(1000); // Wait for transaction to be confirmed

      // Load all offers
      const allOffers = await offerClient.getAllOffers();
      expect(allOffers.length).to.equal(3);

      // Check each offer's parameters
      expect(allOffers[0].pricePerToken.toNumber()).to.equal(100_000);
      expect(allOffers[0].minAmount.toNumber()).to.equal(100_000);
      expect(allOffers[0].maxAmount.toNumber()).to.equal(1000_000);
      expect(allOffers[1].pricePerToken.toNumber()).to.equal(110_000);
      expect(allOffers[1].minAmount.toNumber()).to.equal(200_000);
      expect(allOffers[1].maxAmount.toNumber()).to.equal(900_000);
      expect(allOffers[2].pricePerToken.toNumber()).to.equal(120_000);
      expect(allOffers[2].minAmount.toNumber()).to.equal(300_000);
      expect(allOffers[2].maxAmount.toNumber()).to.equal(800_000);
    } catch (error) {
      console.error("Error creating and loading offers:", error);
      throw error;
    }
  });
}); 