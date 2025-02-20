import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
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
  const SPL_TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const program = new anchor.Program(
    require("../target/idl/trade.json"),
    TRADE_PROGRAM_ID,
    provider
  ) as Program<Trade>;
  
  const profileProgram = new anchor.Program(
    require("../target/idl/profile.json"),
    PROFILE_PROGRAM_ID,
    provider
  );
  
  // Generate keypairs for our test
  const seller = Keypair.generate();
  const buyer = Keypair.generate();
  const tokenMint = Keypair.generate();
  const priceOracle = Keypair.generate();
  const priceProgram = Keypair.generate();
  
  // Find profile PDAs
  const [buyerProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), buyer.publicKey.toBuffer()],
    PROFILE_PROGRAM_ID
  );
  
  const [sellerProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), seller.publicKey.toBuffer()],
    PROFILE_PROGRAM_ID
  );

  // Token accounts
  let sellerTokenAccount: PublicKey;
  let buyerTokenAccount: PublicKey;
  let escrowTokenAccount: PublicKey;
  let tradePDA: PublicKey;
  let tradeBump: number;
  let mint: PublicKey;

  before(async () => {
    // Fund test accounts
    const fundTx = new anchor.web3.Transaction();
    
    // Add fund instructions
    fundTx.add(
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: seller.publicKey,
        lamports: 1000000000, // 1 SOL
      }),
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: buyer.publicKey,
        lamports: 1000000000, // 1 SOL
      }),
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: priceOracle.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );

    try {
      await provider.sendAndConfirm(fundTx);
    } catch (error) {
      console.error("Error funding accounts:", error);
      throw error;
    }
    await delay(1000);

    try {
      // Create token mint
      mint = await createMint(
        provider.connection,
        provider.wallet.payer,
        provider.wallet.publicKey,
        null,
        6
      );
      await delay(1000);

      // Create token accounts
      sellerTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        seller.publicKey
      ).then(account => account.address);

      buyerTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        buyer.publicKey
      ).then(account => account.address);

      await delay(1000);

      // Mint tokens to seller and buyer
      await mintTo(
        provider.connection,
        provider.wallet.payer,
        mint,
        sellerTokenAccount,
        provider.wallet.payer,
        1000_000_000 // 1000 tokens with 6 decimals
      );

      await mintTo(
        provider.connection,
        provider.wallet.payer,
        mint,
        buyerTokenAccount,
        provider.wallet.payer,
        1000_000_000 // 1000 tokens with 6 decimals
      );

      await delay(1000);

      // Initialize price oracle
      const priceProgram = new anchor.Program(
        require("../target/idl/price.json"),
        PRICE_PROGRAM_ID,
        provider
      );

      await priceProgram.methods
        .initialize()
        .accounts({
          state: priceOracle.publicKey,
          admin: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([priceOracle])
        .rpc();

      await delay(1000);

      // Update prices in the oracle
      await priceProgram.methods
        .updatePrices([{
          currency: "USD",
          usdPrice: new anchor.BN(100_000), // $1.00 with 5 decimals
          updatedAt: new anchor.BN(Math.floor(Date.now() / 1000))
        }])
        .accounts({
          oracle: priceOracle.publicKey,
          priceProvider: provider.wallet.publicKey,
        })
        .rpc();

      await delay(1000);

      // Initialize profiles
      // Create buyer profile
      await profileProgram.methods
        .createProfile("buyer")
        .accounts({
          profile: buyerProfile,
          owner: buyer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      await delay(1000);

      // Create seller profile
      await profileProgram.methods
        .createProfile("seller")
        .accounts({
          profile: sellerProfile,
          owner: seller.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([seller])
        .rpc();

      await delay(1000);

    } catch (error) {
      console.error("Error setting up test environment:", error);
      throw error;
    }
  });

  it("Creates a trade", async () => {
    const amount = new anchor.BN(1000_000); // 1 token
    const price = new anchor.BN(100_000); // $1.00 with 5 decimals

    // Find trade PDA
    [tradePDA, tradeBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("trade"),
        seller.publicKey.toBuffer(),
        mint.toBuffer(),
      ],
      TRADE_PROGRAM_ID
    );

    // Create a new escrow keypair
    const escrowKeypair = Keypair.generate();

    // Create the trade
    await program.methods
      .createTrade(amount, price)
      .accounts({
        trade: tradePDA,
        seller: seller.publicKey,
        tokenMint: mint,
        sellerTokenAccount: sellerTokenAccount,
        escrowAccount: escrowKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([seller, escrowKeypair])
      .rpc();

    await delay(1000);

    const account = await program.account.trade.fetch(tradePDA);
    expect(account.seller.toString()).to.equal(seller.publicKey.toString());
    expect(account.buyer).to.be.null;
    expect(account.amount.toNumber()).to.equal(1000_000);
    expect(account.price.toNumber()).to.equal(100_000);
    expect(account.tokenMint.toString()).to.equal(mint.toString());
    expect(account.escrowAccount.toString()).to.equal(escrowKeypair.publicKey.toString());
    expect(account.status).to.deep.equal({ open: {} });

    // Verify tokens were transferred to escrow
    const escrowBalance = await getTokenBalance(provider.connection, escrowKeypair.publicKey);
    expect(escrowBalance).to.equal(1000_000);

    // Update escrowTokenAccount for subsequent tests
    escrowTokenAccount = escrowKeypair.publicKey;
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

    await delay(1000);

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
        tokenProgram: TOKEN_PROGRAM_ID,
        priceOracle: priceOracle.publicKey,
        priceProgram: PRICE_PROGRAM_ID,
        buyerProfile: buyerProfile,
        sellerProfile: sellerProfile,
        profileProgram: PROFILE_PROGRAM_ID,
      })
      .signers([seller, buyer])
      .rpc();

    await delay(1000);

    const account = await program.account.trade.fetch(tradePDA);
    expect(account.status).to.deep.equal({ completed: {} });

    // Verify tokens were transferred to buyer
    const buyerBalance = await getTokenBalance(provider.connection, buyerTokenAccount);
    expect(buyerBalance).to.equal(1001_000_000); // Initial 1000 + 1 from trade
  });

  it("Cancels a trade", async () => {
    // Create a new trade for cancellation
    const amount = new anchor.BN(1000_000); // 1 token
    const price = new anchor.BN(100_000); // $1.00 with 5 decimals

    // Find cancel trade PDA
    const [cancelTradePDA, cancelTradeBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("trade"),
        seller.publicKey.toBuffer(),
        mint.toBuffer()
      ],
      TRADE_PROGRAM_ID
    );

    // Create a new escrow keypair
    const cancelEscrowKeypair = Keypair.generate();

    // Create the trade
    await program.methods
      .createTrade(amount, price)
      .accounts({
        trade: cancelTradePDA,
        seller: seller.publicKey,
        tokenMint: mint,
        sellerTokenAccount: sellerTokenAccount,
        escrowAccount: cancelEscrowKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([seller, cancelEscrowKeypair])
      .rpc();

    await delay(1000);

    // Cancel the trade
    await program.methods
      .cancelTrade()
      .accounts({
        trade: cancelTradePDA,
        seller: seller.publicKey,
        escrowAccount: cancelEscrowKeypair.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([seller])
      .rpc();

    await delay(1000);

    const account = await program.account.trade.fetch(cancelTradePDA);
    expect(account.status).to.deep.equal({ cancelled: {} });

    // Verify tokens were returned to seller
    const sellerBalance = await getTokenBalance(provider.connection, sellerTokenAccount);
    expect(sellerBalance).to.equal(999_000_000); // Initial 1000 - 1 from completed trade
  });

  it("Disputes a trade", async () => {
    // Create a new trade for dispute
    const amount = new anchor.BN(1000_000); // 1 token
    const price = new anchor.BN(100_000); // $1.00 with 5 decimals

    // Find dispute trade PDA
    const [disputeTradePDA, disputeTradeBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("trade"),
        seller.publicKey.toBuffer(),
        mint.toBuffer()
      ],
      TRADE_PROGRAM_ID
    );

    // Create a new escrow keypair
    const disputeEscrowKeypair = Keypair.generate();

    // Create the trade
    await program.methods
      .createTrade(amount, price)
      .accounts({
        trade: disputeTradePDA,
        seller: seller.publicKey,
        tokenMint: mint,
        sellerTokenAccount: sellerTokenAccount,
        escrowAccount: disputeEscrowKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([seller, disputeEscrowKeypair])
      .rpc();

    await delay(1000);

    // Accept the trade
    await program.methods
      .acceptTrade()
      .accounts({
        trade: disputeTradePDA,
        buyer: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    await delay(1000);

    // Dispute the trade
    await program.methods
      .disputeTrade()
      .accounts({
        trade: disputeTradePDA,
        disputer: buyer.publicKey,
      })
      .signers([buyer])
      .rpc();

    await delay(1000);

    const account = await program.account.trade.fetch(disputeTradePDA);
    expect(account.status).to.deep.equal({ disputed: {} });
  });

  it("Fails to dispute with unauthorized user", async () => {
    // Create an unauthorized user
    const unauthorizedUser = Keypair.generate();

    // Fund unauthorized user
    const fundTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: unauthorizedUser.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    
    await provider.sendAndConfirm(fundTx);
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
      throw new Error("Expected error did not occur");
    } catch (error: any) {
      expect(error.error.errorCode.code).to.equal("UnauthorizedDisputer");
    }
  });
});