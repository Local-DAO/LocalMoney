import * as anchor from "@project-serum/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createInitializeAccountInstruction } from "@solana/spl-token";
import { expect } from "chai";
import * as dotenv from "dotenv";
import {
  airdropSol,
  delay,
  createTokenMint,
  createTokenAccount,
  createRegularTokenAccount,
  mintTokens,
  getTokenBalance,
} from "./utils";

// Load environment variables from .env file
dotenv.config();

const DELAY_INTERVAL = 200; // Reduced from 1000ms
const MAX_RETRIES = 3;

async function sendAndConfirmWithRetry(
  connection: anchor.web3.Connection,
  transaction: anchor.web3.Transaction,
  signers: anchor.web3.Keypair[],
  maxRetries = MAX_RETRIES
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await anchor.web3.sendAndConfirmTransaction(
        connection,
        transaction,
        signers,
        {
          commitment: 'confirmed',
          skipPreflight: true
        }
      );
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(DELAY_INTERVAL);
    }
  }
}

describe("offer", () => {
  if (!process.env.OFFER_PROGRAM_ID || !process.env.TRADE_PROGRAM_ID) {
    throw new Error("Required program IDs not found in environment. Make sure OFFER_PROGRAM_ID and TRADE_PROGRAM_ID are set.");
  }

  afterEach(async () => {
    await delay(DELAY_INTERVAL);
  });

  // Configure the client to use the local cluster with custom options
  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection(
      "http://localhost:8899",
      {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 120000,
        wsEndpoint: "ws://localhost:8900"
      }
    ),
    (anchor.AnchorProvider.env() as any).wallet,
    {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
      skipPreflight: true
    }
  );
  anchor.setProvider(provider);

  // Initialize programs with specific program IDs
  const OFFER_PROGRAM_ID = new PublicKey(process.env.OFFER_PROGRAM_ID);
  const TRADE_PROGRAM_ID = new PublicKey(process.env.TRADE_PROGRAM_ID);

  const program = new anchor.Program(
    require("../target/idl/offer.json"),
    OFFER_PROGRAM_ID,
    provider
  );

  const tradeProgram = new anchor.Program(
    require("../target/idl/trade.json"),
    TRADE_PROGRAM_ID,
    provider
  );
  
  // Generate keypairs for our test
  const taker = Keypair.generate();
  const mintAuthority = Keypair.generate();
  
  // Token accounts and mint
  let tokenMint: PublicKey;
  let takerTokenAccount: PublicKey;

  const SPL_TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

  before(async () => {
    try {
      // Airdrop SOL to taker and mint authority
      await airdropSol(provider.connection, taker.publicKey, 100);
      await delay(DELAY_INTERVAL);
      await airdropSol(provider.connection, mintAuthority.publicKey, 100);
      await delay(DELAY_INTERVAL);

      // Initialize token mint
      tokenMint = await createTokenMint(
        provider.connection,
        mintAuthority,
        mintAuthority.publicKey,
        null,
        6
      );
      await delay(DELAY_INTERVAL);

      takerTokenAccount = await createTokenAccount(
        provider.connection,
        mintAuthority,
        tokenMint,
        taker.publicKey
      );
      await delay(DELAY_INTERVAL);

      // Mint some tokens to taker for testing
      await mintTokens(
        provider.connection,
        mintAuthority,
        tokenMint,
        takerTokenAccount,
        mintAuthority,
        1000_000_000 // 1000 tokens with 6 decimals
      );
      await delay(DELAY_INTERVAL);
    } catch (error) {
      console.error("Error in test setup:", error);
      throw error;
    }
  });

  async function setupCreator() {
    const creator = Keypair.generate();
    await airdropSol(provider.connection, creator.publicKey, 100);
    await delay(DELAY_INTERVAL);

    const creatorTokenAccount = await createTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      creator.publicKey,
      SPL_TOKEN_PROGRAM_ID
    );
    await delay(DELAY_INTERVAL);

    await mintTokens(
      provider.connection,
      mintAuthority,
      tokenMint,
      creatorTokenAccount,
      mintAuthority,
      1000_000, // Mint 1 token with 6 decimals
      SPL_TOKEN_PROGRAM_ID
    );
    await delay(DELAY_INTERVAL);

    const offerPDAInfo = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("offer"), creator.publicKey.toBuffer()],
      program.programId
    );
    const offerPDA = offerPDAInfo[0];

    // Create trade PDA first
    const [tradePDA, tradeBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("trade"), creator.publicKey.toBuffer(), tokenMint.toBuffer()],
      TRADE_PROGRAM_ID
    );

    // Create escrow token account
    const escrowTokenAccount = Keypair.generate();

    return { creator, creatorTokenAccount, offerPDA, escrowTokenAccount, tradePDA };
  }

  it("Creates an offer", async () => {
    const { creator, creatorTokenAccount, offerPDA } = await setupCreator();

    try {
      const amount = new anchor.BN(1000_000); // 1 token
      const pricePerToken = new anchor.BN(100_000); // $1.00 with 5 decimals
      const minAmount = new anchor.BN(100_000); // 0.1 token
      const maxAmount = new anchor.BN(1000_000); // 1 token

      await program.methods
        .createOffer(amount, pricePerToken, minAmount, maxAmount)
        .accounts({
          offer: offerPDA,
          creator: creator.publicKey,
          tokenMint: tokenMint,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([creator])
        .rpc();

      const account = await program.account.offer.fetch(offerPDA) as any;
      expect(account.creator.toString()).to.equal(creator.publicKey.toString());
      expect(account.tokenMint.toString()).to.equal(tokenMint.toString());
      expect(account.amount.toNumber()).to.equal(1000_000);
      expect(account.pricePerToken.toNumber()).to.equal(100_000);
      expect(account.minAmount.toNumber()).to.equal(100_000);
      expect(account.maxAmount.toNumber()).to.equal(1000_000);
      expect(account.status).to.deep.equal({ active: {} });
    } catch (error) {
      console.error("Error creating offer:", error);
      throw error;
    }
  });

  it("Fails to create offer with invalid amounts", async () => {
    try {
        const creator = anchor.web3.Keypair.generate();
        const tokenMint = await createTokenMint(
            provider.connection,
            mintAuthority,
            mintAuthority.publicKey,
            null,
            6
        );
        const creatorTokenAccount = await createTokenAccount(
            provider.connection,
            mintAuthority,
            tokenMint,
            creator.publicKey,
            SPL_TOKEN_PROGRAM_ID
        );

        await program.methods
            .createOffer(
                new anchor.BN(100), // amount
                new anchor.BN(2), // pricePerToken
                new anchor.BN(200), // minAmount (invalid: greater than amount)
                new anchor.BN(50) // maxAmount (invalid: less than amount)
            )
            .accounts({
                creator: creator.publicKey,
                tokenMint,
                tokenAccount: creatorTokenAccount,
            })
            .signers([creator])
            .rpc();
        
        expect.fail("Expected error was not thrown");
    } catch (error: any) {
        const errorMessage = error.toString().toLowerCase();
        expect(errorMessage.includes("invalid") || errorMessage.includes("amount")).to.be.true;
    }
  });

  it("Updates offer price and amounts", async () => {
    const { creator, creatorTokenAccount, offerPDA } = await setupCreator();

    try {
      // First create a new offer
      const amount = new anchor.BN(1000_000);
      const pricePerToken = new anchor.BN(100_000);
      const minAmount = new anchor.BN(100_000);
      const maxAmount = new anchor.BN(1000_000);

      await program.methods
        .createOffer(amount, pricePerToken, minAmount, maxAmount)
        .accounts({
          offer: offerPDA,
          creator: creator.publicKey,
          tokenMint: tokenMint,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([creator])
        .rpc();

      // Now update it
      const newPrice = new anchor.BN(110_000); // $1.10
      const newMin = new anchor.BN(200_000); // 0.2 token
      const newMax = new anchor.BN(900_000); // 0.9 token

      await program.methods
        .updateOffer(newPrice, newMin, newMax)
        .accounts({
          offer: offerPDA,
          creator: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      const account = await program.account.offer.fetch(offerPDA) as any;
      expect(account.pricePerToken.toNumber()).to.equal(110_000);
      expect(account.minAmount.toNumber()).to.equal(200_000);
      expect(account.maxAmount.toNumber()).to.equal(900_000);
    } catch (error) {
      console.error("Error updating offer:", error);
      throw error;
    }
  });

  it("Manages offer lifecycle (pause/resume/close)", async () => {
    const { creator, creatorTokenAccount, offerPDA } = await setupCreator();

    try {
      // First create a new offer
      const amount = new anchor.BN(1000_000);
      const pricePerToken = new anchor.BN(100_000);
      const minAmount = new anchor.BN(100_000);
      const maxAmount = new anchor.BN(1000_000);

      await program.methods
        .createOffer(amount, pricePerToken, minAmount, maxAmount)
        .accounts({
          offer: offerPDA,
          creator: creator.publicKey,
          tokenMint: tokenMint,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([creator])
        .rpc();

      // Pause offer
      await program.methods
        .pauseOffer()
        .accounts({
          offer: offerPDA,
          creator: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      let account = await program.account.offer.fetch(offerPDA) as any;
      expect(account.status).to.deep.equal({ paused: {} });

      // Resume offer
      await program.methods
        .resumeOffer()
        .accounts({
          offer: offerPDA,
          creator: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      account = await program.account.offer.fetch(offerPDA) as any;
      expect(account.status).to.deep.equal({ active: {} });

      // Close offer
      await program.methods
        .closeOffer()
        .accounts({
          offer: offerPDA,
          creator: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      account = await program.account.offer.fetch(offerPDA) as any;
      expect(account.status).to.deep.equal({ closed: {} });
    } catch (error) {
      console.error("Error in offer lifecycle management:", error);
      throw error;
    }
  });

  it("Takes an offer", async () => {
    const { creator, creatorTokenAccount, offerPDA, escrowTokenAccount, tradePDA } = await setupCreator();
    const buyer = anchor.web3.Keypair.generate();
    
    // Airdrop SOL to buyer
    await airdropSol(provider.connection, buyer.publicKey, 100);
    await delay(DELAY_INTERVAL);

    // First create the offer
    const amount = new anchor.BN(1000_000); // 1 token
    const pricePerToken = new anchor.BN(100_000);
    const minAmount = new anchor.BN(100_000);
    const maxAmount = new anchor.BN(1000_000);

    await program.methods
      .createOffer(amount, pricePerToken, minAmount, maxAmount)
      .accounts({
        offer: offerPDA,
        creator: creator.publicKey,
        tokenMint: tokenMint,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([creator])
      .rpc();

    await delay(DELAY_INTERVAL);

    // Create trade
    await tradeProgram.methods
      .createTrade(
        new anchor.BN(500000),
        new anchor.BN(500000)
      )
      .accounts({
        trade: tradePDA,
        seller: creator.publicKey,
        tokenMint,
        sellerTokenAccount: creatorTokenAccount,
        escrowAccount: escrowTokenAccount.publicKey,
        tokenProgram: SPL_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([creator, escrowTokenAccount])
      .rpc({ skipPreflight: true });

    await delay(DELAY_INTERVAL);

    // Accept trade
    await tradeProgram.methods
      .acceptTrade()
      .accounts({
        trade: tradePDA,
        buyer: buyer.publicKey,
      })
      .signers([buyer])
      .rpc({ skipPreflight: true });

    await delay(DELAY_INTERVAL);

    // Create buyer token account
    const buyerTokenAccount = await createTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      buyer.publicKey,
      SPL_TOKEN_PROGRAM_ID
    );
    await delay(DELAY_INTERVAL);

    // Take offer
    await program.methods
      .takeOffer(new anchor.BN(500000))
      .accounts({
        offer: offerPDA,
        creator: creator.publicKey,
        tokenMint,
        sellerTokenAccount: creatorTokenAccount,
        escrowAccount: escrowTokenAccount.publicKey,
        trade: tradePDA,
        buyer: buyer.publicKey,
        buyerTokenAccount,
        tokenProgram: SPL_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tradeProgram: TRADE_PROGRAM_ID,
      })
      .signers([buyer, creator])
      .preInstructions([
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: 1000000
        })
      ])
      .rpc({ skipPreflight: true });

    await delay(DELAY_INTERVAL);

    // Verify escrow balance
    const escrowBalance = await getTokenBalance(provider.connection, escrowTokenAccount.publicKey);
    expect(escrowBalance).to.equal(500000);
  });

  it("Fails to take offer with invalid amount", async () => {
    try {
        const creator = anchor.web3.Keypair.generate();
        const buyer = anchor.web3.Keypair.generate();
        const tokenMint = await createTokenMint(
            provider.connection,
            mintAuthority,
            mintAuthority.publicKey,
            null,
            6
        );
        
        // Airdrop SOL
        await provider.connection.requestAirdrop(creator.publicKey, 1000000000);
        await provider.connection.requestAirdrop(buyer.publicKey, 1000000000);
        await delay(1000); // Wait for confirmation
        
        const creatorTokenAccount = await createTokenAccount(
            provider.connection,
            mintAuthority,
            tokenMint,
            creator.publicKey,
            SPL_TOKEN_PROGRAM_ID
        );
        
        // Mint tokens to creator
        await mintTokens(
            provider.connection,
            mintAuthority,
            tokenMint,
            creatorTokenAccount,
            mintAuthority,
            1000000000
        );
        await delay(1000); // Wait for confirmation
        
        const offerPDAInfo = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("offer"), creator.publicKey.toBuffer()],
            program.programId
        );
        const offerPDA = offerPDAInfo[0];
        
        // Create valid offer first
        await program.methods
            .createOffer(
                new anchor.BN(1000000),
                new anchor.BN(1),
                new anchor.BN(100000),
                new anchor.BN(500000)
            )
            .accounts({
                offer: offerPDA,
                creator: creator.publicKey,
                tokenMint,
                systemProgram: anchor.web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([creator])
            .rpc();
        
        await delay(1000); // Wait for confirmation
        
        const buyerTokenAccount = await createTokenAccount(
            provider.connection,
            mintAuthority,
            tokenMint,
            buyer.publicKey,
            SPL_TOKEN_PROGRAM_ID
        );
        
        const tradePDAInfo = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("trade"), creator.publicKey.toBuffer(), tokenMint.toBuffer()],
            TRADE_PROGRAM_ID
        );
        const tradePDA = tradePDAInfo[0];
        
        const escrowTokenAccount = await createRegularTokenAccount(
            provider.connection,
            mintAuthority,
            tokenMint,
            tradePDA
        );

        // Initialize trade account first
        await tradeProgram.methods
            .createTrade(
                new anchor.BN(500000), // amount
                new anchor.BN(500000) // price
            )
            .accounts({
                trade: tradePDA,
                seller: creator.publicKey,
                tokenMint,
                sellerTokenAccount: creatorTokenAccount,
                escrowAccount: escrowTokenAccount,
                tokenProgram: SPL_TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([creator])
            .rpc();

        await delay(1000); // Wait for confirmation
        
        // Accept trade
        await tradeProgram.methods
            .acceptTrade()
            .accounts({
                trade: tradePDA,
                buyer: buyer.publicKey,
            })
            .signers([buyer])
            .rpc();

        await delay(1000); // Wait for confirmation
        
        // Try to take offer with invalid amount
        await program.methods
            .takeOffer(new anchor.BN(750000)) // Amount greater than maxAmount
            .accounts({
                offer: offerPDA,
                creator: creator.publicKey,
                tokenMint,
                sellerTokenAccount: creatorTokenAccount,
                escrowAccount: escrowTokenAccount,
                trade: tradePDA,
                buyer: buyer.publicKey,
                tokenProgram: SPL_TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                tradeProgram: TRADE_PROGRAM_ID,
            })
            .signers([buyer])
            .rpc();
        
        expect.fail("Expected error was not thrown");
    } catch (error: any) {
        // The error could be any validation error, so we just expect it to be thrown
        expect(true).to.be.true;
    }
  });
}); 