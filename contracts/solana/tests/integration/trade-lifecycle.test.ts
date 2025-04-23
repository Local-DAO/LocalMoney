import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, Connection, LAMPORTS_PER_SOL, SendTransactionError } from "@solana/web3.js";
import { assert } from "chai";
import * as fs from 'fs';
import * as path from 'path';
import { MINT_SIZE, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createMint, mintTo, createAssociatedTokenAccount, getAccount, Account as TokenAccount, createInitializeMintInstruction, createAssociatedTokenAccountInstruction, createMintToInstruction, getMinimumBalanceForRentExemptMint, getAssociatedTokenAddress } from "@solana/spl-token";
import { PROGRAM_IDS } from "../config";
import { Hub } from "../../target/types/hub";
import { Offer } from "../../target/types/offer";
import { Trade } from "../../target/types/trade";

// Interface for program account types
interface IAccount {
  [key: string]: any;
}

// Define HubConfig type inline based on IDL structure
type HubConfig = {
  offerProgram: PublicKey;
  tradeProgram: PublicKey;
  profileProgram: PublicKey;
  priceProgram: PublicKey;
  priceProvider: PublicKey;
  localMarket: PublicKey;
  localTokenMint: PublicKey;
  chainFeeCollector: PublicKey;
  warchest: PublicKey;
  activeOffersLimit: number;
  activeTradesLimit: number;
  arbitrationFeePct: number;
  burnFeePct: number;
  chainFeePct: number;
  warchestFeePct: number;
  tradeExpirationTimer: anchor.BN;
  tradeDisputeTimer: anchor.BN;
  tradeLimitMin: anchor.BN;
  tradeLimitMax: anchor.BN;
  isInitialized: boolean;
};

describe("LocalMoney Full Trade Lifecycle Test", () => {
  // Setup Anchor provider and connection
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const connection = provider.connection;

  // Generate keypairs
  const admin = anchor.web3.Keypair.generate();
  const maker = anchor.web3.Keypair.generate();
  const taker = anchor.web3.Keypair.generate();
  const arbitrator = anchor.web3.Keypair.generate();
  const mockUsdcMint = anchor.web3.Keypair.generate();

  // Program clients (load using workspace)
  const hubProgram = anchor.workspace.Hub as Program<Hub>;
  const offerProgram = anchor.workspace.Offer as Program<Offer>;
  const tradeProgram = anchor.workspace.Trade as Program<Trade>;
  // Define other program clients if needed for helpers (Profile, Price)
  // const profileProgram = anchor.workspace.Profile as Program<Profile>; 
  // const priceProgram = anchor.workspace.Price as Program<Price>;

  // Program IDs from config
  const programIds = PROGRAM_IDS;
  
  // Test accounts
  const adminKeypair = Keypair.generate();
  const makerKeypair = Keypair.generate();
  const takerKeypair = Keypair.generate();
  const arbitratorKeypair = Keypair.generate();
  
  // Program-related accounts
  let hubPda: PublicKey;
  let hubBump: number;
  let priceConfigPda: PublicKey;
  let profileConfigPda: PublicKey;
  let tradeConfigPda: PublicKey;
  
  // User profiles
  let makerProfilePda: PublicKey;
  let takerProfilePda: PublicKey;
  let arbitratorProfilePda: PublicKey;
  
  // Offer and trade accounts
  let offerCounterPda: PublicKey;
  let offerPda: PublicKey;
  let tradePda: PublicKey;
  let tradeCounterPda: PublicKey;
  
  // Mock USDC mint and related accounts
  let adminTokenAccount: PublicKey;
  let makerTokenAccount: PublicKey;
  let takerTokenAccount: PublicKey;
  let arbitratorTokenAccount: PublicKey;
  
  // Account caches for more efficient tests
  const accountCache: {[key: string]: IAccount} = {};
  
  before(async function() {
    this.timeout(60000); // Increase timeout for setup
    
    // Calculate PDAs
    [hubPda] = PublicKey.findProgramAddressSync([Buffer.from("hub")], programIds.hub);
    [priceConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programIds.price);
    [profileConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programIds.profile);
    [tradeConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programIds.trade);
    [offerCounterPda] = PublicKey.findProgramAddressSync([Buffer.from("counter")], programIds.offer);
    [tradeCounterPda] = PublicKey.findProgramAddressSync([Buffer.from("counter")], programIds.trade);
    console.log("PDAs calculated successfully");

    // Airdrop SOL
    await Promise.all([
      airdropSol(adminKeypair.publicKey),
      airdropSol(makerKeypair.publicKey),
      airdropSol(takerKeypair.publicKey),
      airdropSol(arbitratorKeypair.publicKey),
      airdropSol(provider.wallet.publicKey) // Ensure provider wallet has SOL
    ]);
    console.log("Airdropping SOL to test accounts..."); // Log moved after await

    // Create mock USDC mint
    await createMockTokenMintInternal(); 
    console.log("Creating mock USDC mint..."); // Log moved after await

    // Create token accounts
    [makerTokenAccount, takerTokenAccount, arbitratorTokenAccount] = await Promise.all([
      createAndFundTokenAccountInternal(makerKeypair, 1_000_000_000), // 1000 USDC
      createAndFundTokenAccountInternal(takerKeypair, 1_000_000_000), // 1000 USDC
      createAndFundTokenAccountInternal(arbitratorKeypair, 100_000_000) // 100 USDC (if needed for fees)
    ]);
    console.log("Creating token accounts for users..."); // Log moved after await
  });
  
  // Check program deployments
  it("should verify programs are deployed with correct IDs", async () => {
    console.log("\nVerifying program deployments...");
    
    // For each program ID, check that an account exists on chain
    for (const [name, pubkey] of Object.entries(programIds)) {
      const programInfo = await connection.getAccountInfo(pubkey);
      assert(programInfo !== null, `Program ${name} not found at ${pubkey.toString()}`);
      assert(programInfo.executable, `Program ${name} is not executable`);
      console.log(`✓ ${name} program found at ${pubkey.toString()}`);
    }
  });
  
  // Replace the placeholder test with a complete implementation
  it("should simulate a full trade lifecycle", async () => {
    console.log("\nSimulating full trade lifecycle...");
    
    // Step 1: Initialize hub by admin
    console.log("1. Initializing hub...");
    
    // Define HubConfig parameters
    const config: HubConfig = {
      offerProgram: programIds.offer,
      tradeProgram: programIds.trade,
      profileProgram: programIds.profile,
      priceProgram: programIds.price,
      priceProvider: adminKeypair.publicKey, // Placeholder
      localMarket: adminKeypair.publicKey,   // Placeholder
      localTokenMint: mockUsdcMint.publicKey,
      chainFeeCollector: adminKeypair.publicKey, // Placeholder
      warchest: adminKeypair.publicKey,          // Placeholder
      activeOffersLimit: 50,
      activeTradesLimit: 50,
      arbitrationFeePct: 50, 
      burnFeePct: 1,      
      chainFeePct: 1,     
      warchestFeePct: 1,  
      tradeExpirationTimer: new anchor.BN(3600), 
      tradeDisputeTimer: new anchor.BN(7200),    
      tradeLimitMin: new anchor.BN(1000000),    
      tradeLimitMax: new anchor.BN(1000000000), 
      isInitialized: false 
    };

    try {
      const txSignature = await hubProgram.methods
        .initialize(config)
        .accounts({ 
            hub: hubPda, 
            admin: adminKeypair.publicKey, 
            systemProgram: SystemProgram.programId 
        } as any) // Cast to any to bypass potential linter issues
        .signers([adminKeypair])
        .rpc();
      console.log(`✓ Hub initialized. Signature: ${txSignature}`);
    } catch(error) {
        console.error("Failed to initialize hub:", error);
        if (error instanceof SendTransactionError) {
           // console.error("Transaction Logs:", error.getLogs()); 
        }
        throw error;
    }

    // Verify hub data
    const hubAccount = await hubProgram.account.hub.fetch(hubPda);
    assert.ok(hubAccount, "Hub account should exist");
    assert.equal(hubAccount.config.arbitrationFeePct, config.arbitrationFeePct, "Hub arbitration fee mismatch");
    assert.ok(hubAccount.admin.equals(adminKeypair.publicKey), "Hub admin mismatch");
    
    // Step 2: Initialize price configuration
    console.log("2. Initializing price configuration...");
    const initPriceConfigIx = await createInitPriceConfigInstruction(
      adminKeypair.publicKey, 
      priceConfigPda,
      programIds.price
    );
    
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(initPriceConfigIx), [adminKeypair]);
    console.log("✓ Price configuration initialized");
    
    // Step 3: Initialize profile configuration
    console.log("3. Initializing profile configuration...");
    const initProfileConfigIx = await createInitProfileConfigInstruction(
      adminKeypair.publicKey,
      profileConfigPda,
      programIds.profile,
      { registrationFee: 10000000 } // 0.01 SOL
    );
    
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(initProfileConfigIx), [adminKeypair]);
    console.log("✓ Profile configuration initialized");
    
    // Step 4: Register profiles for maker, taker, and arbitrator
    console.log("4. Registering user profiles...");
    
    // Calculate PDAs for user profiles
    [makerProfilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), makerKeypair.publicKey.toBuffer()],
      programIds.profile
    );
    
    [takerProfilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), takerKeypair.publicKey.toBuffer()],
      programIds.profile
    );
    
    [arbitratorProfilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), arbitratorKeypair.publicKey.toBuffer()],
      programIds.profile
    );
    
    // Register arbitrator profile
    const registerArbitratorIx = await createRegisterProfileInstruction(
      arbitratorKeypair.publicKey,
      arbitratorProfilePda,
      profileConfigPda,
      programIds.profile,
      { isArbitrator: true, username: "Arbitrator1" }
    );
    
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(registerArbitratorIx), [arbitratorKeypair]);
    console.log("✓ Arbitrator profile registered");
    
    // Register maker profile
    const registerMakerIx = await createRegisterProfileInstruction(
      makerKeypair.publicKey,
      makerProfilePda,
      profileConfigPda,
      programIds.profile,
      { isArbitrator: false, username: "Maker1" }
    );
    
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(registerMakerIx), [makerKeypair]);
    console.log("✓ Maker profile registered");
    
    // Register taker profile
    const registerTakerIx = await createRegisterProfileInstruction(
      takerKeypair.publicKey,
      takerProfilePda,
      profileConfigPda,
      programIds.profile,
      { isArbitrator: false, username: "Taker1" }
    );
    
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(registerTakerIx), [takerKeypair]);
    console.log("✓ Taker profile registered");
    
    // Step 5: Initialize the offer counter and trade counter
    console.log("5. Initializing counters...");
    [offerCounterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("counter")],
      programIds.offer
    );
    
    const initOfferCounterIx = await createInitOfferCounterInstruction(
      adminKeypair.publicKey,
      offerCounterPda,
      programIds.offer
    );
    
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(initOfferCounterIx), [adminKeypair]);
    console.log("✓ Offer counter initialized");
    
    // Initialize trade config
    const initTradeConfigIx = await createInitTradeConfigInstruction(
      adminKeypair.publicKey,
      tradeConfigPda,
      programIds.trade
    );
    
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(initTradeConfigIx), [adminKeypair]);
    console.log("✓ Trade configuration initialized");
    
    // Initialize trade counter
    const initTradeCounterIx = await createInitTradeCounterInstruction(
      adminKeypair.publicKey,
      tradeCounterPda,
      programIds.trade
    );
    
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(initTradeCounterIx), [adminKeypair]);
    console.log("✓ Trade counter initialized");
    
    // Step 6: Create an offer by the maker
    console.log("6. Creating an offer...");
    
    // Fetch the current offer counter
    const offerCounterAccount = await fetchOfferCounterAccount(offerCounterPda);
    const offerId = offerCounterAccount.count;
    
    // Calculate the offer PDA
    [offerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("offer"), Buffer.from(offerId.toString())],
      programIds.offer
    );
    
    // Create offer
    const createOfferIx = await createOfferInstruction(
      makerKeypair.publicKey,
      offerPda,
      makerProfilePda,
      offerCounterPda,
      hubPda,
      mockUsdcMint.publicKey,
      programIds.offer,
      {
        amount: new anchor.BN(100_000_000), // 100 USDC
        minAmount: new anchor.BN(10_000_000), // 10 USDC
        price: new anchor.BN(19_000_000), // 19 USDC per SOL
        direction: { buy: {} }, // Buying SOL with USDC
        paymentMethod: { bank: {} },
        userSettlementDeadlineSec: 3600, // 1 hour
        disputeDeadlineSec: 7200, // 2 hours
        paymentDetails: "Bank account: 123456789"
      }
    );
    
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(createOfferIx), [makerKeypair]);
    console.log(`✓ Offer created with ID: ${offerId}`);
    
    // Step 7: Take the offer by the taker
    console.log("7. Taking the offer...");
    
    // Fetch the current trade counter
    const tradeCounterAccount = await fetchTradeCounterAccount(tradeCounterPda);
    const tradeId = tradeCounterAccount.count;
    
    // Calculate the trade PDA
    [tradePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("trade"), Buffer.from(tradeId.toString())],
      programIds.trade
    );
    
    // Take offer
    const takeOfferIx = await createTakeOfferInstruction(
      takerKeypair.publicKey,
      tradePda,
      takerProfilePda,
      tradeCounterPda,
      offerPda,
      tradeConfigPda,
      makerTokenAccount, // Maker's USDC account
      hubPda,
      arbitratorProfilePda,
      programIds.trade,
      {
        amount: new anchor.BN(50_000_000), // 50 USDC
        autoRelease: false
      }
    );
    
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(takeOfferIx), [takerKeypair]);
    console.log(`✓ Offer taken, trade created with ID: ${tradeId}`);
    
    // Step 8: Taker marks the payment as sent
    console.log("8. Taker marking payment as sent...");
    const markPaymentSentIx = await createPaymentSentInstruction(
      takerKeypair.publicKey,
      tradePda,
      takerProfilePda,
      programIds.trade
    );
    
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(markPaymentSentIx), [takerKeypair]);
    console.log("✓ Payment marked as sent by taker");
    
    // Step 9: Maker confirms payment received and releases funds
    console.log("9. Maker confirming payment and releasing funds...");
    const releaseTradeIx = await createReleaseTradeInstruction(
      makerKeypair.publicKey,
      tradePda,
      makerProfilePda,
      makerTokenAccount,
      takerTokenAccount,
      mockUsdcMint.publicKey,
      programIds.trade
    );
    
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(releaseTradeIx), [makerKeypair]);
    console.log("✓ Trade completed: payment confirmed and funds released");
    
    // Verify final token balances
    const makerFinalBalance = await connection.getTokenAccountBalance(makerTokenAccount);
    const takerFinalBalance = await connection.getTokenAccountBalance(takerTokenAccount);
    
    console.log(`Maker final USDC balance: ${makerFinalBalance.value.uiAmount}`);
    console.log(`Taker final USDC balance: ${takerFinalBalance.value.uiAmount}`);
    
    // Verify trade is in completed state
    const tradeAccount = await fetchTradeAccount(tradePda);
    assert.ok(tradeAccount.state.completed, "Trade state should be completed");
    
    console.log("✅ Full trade lifecycle completed successfully!");
  });
  
  // Helper functions
  async function airdropSol(pubkey: PublicKey) {
    try {
      const airdropSig = await connection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(airdropSig);
      console.log(`Airdropped 2 SOL to ${pubkey.toString()}`);
    } catch (error) {
      console.error(`Failed to airdrop SOL to ${pubkey.toString()}:`, error);
      // Try again with smaller amount in case of rate limiting
      try {
        const airdropSig = await connection.requestAirdrop(pubkey, LAMPORTS_PER_SOL);
        await connection.confirmTransaction(airdropSig);
        console.log(`Airdropped 1 SOL to ${pubkey.toString()}`);
      } catch (retryError) {
        console.error(`Failed retry airdrop to ${pubkey.toString()}:`, retryError);
      }
    }
  }
  
  async function createMockTokenMintInternal() {
    await createMint(
      connection,
      adminKeypair, // Payer
      adminKeypair.publicKey, // Mint authority
      adminKeypair.publicKey, // Freeze authority
      6, // Decimals (USDC standard)
      mockUsdcMint // Keypair for the mint
    );
    console.log(`Created mock USDC mint: ${mockUsdcMint.publicKey.toString()}`);
  }
  
  async function createAndFundTokenAccountInternal(owner: Keypair, amount: number): Promise<PublicKey> {
    const tokenAccount = await createAssociatedTokenAccount(
        connection,
        adminKeypair, // payer
        mockUsdcMint.publicKey,
        owner.publicKey
    );
    await mintTo(
        connection,
        adminKeypair, // payer
        mockUsdcMint.publicKey,
        tokenAccount,
        adminKeypair, // mint authority
        amount
    );
    console.log(`Created and funded token account for ${owner.publicKey.toString()}`);
    return tokenAccount;
  }
  
  // Helper functions for instruction creation and account fetching
  async function createInitPriceConfigInstruction(
    payer: PublicKey,
    priceConfigPda: PublicKey,
    programId: PublicKey
  ) {
    return new anchor.web3.TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: priceConfigPda, isSigner: false, isWritable: true },
        { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: Buffer.from([0]) // Instruction index for initialize
    });
  }
  
  async function createInitProfileConfigInstruction(
    payer: PublicKey,
    profileConfigPda: PublicKey,
    programId: PublicKey,
    params: { registrationFee: number }
  ) {
    // Convert fee to little endian bytes
    const feeBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      feeBytes[i] = (params.registrationFee >> (8 * i)) & 0xFF;
    }
    
    return new anchor.web3.TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: profileConfigPda, isSigner: false, isWritable: true },
        { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: Buffer.from([0, ...feeBytes]) // Instruction index for initialize + fee
    });
  }
  
  async function createRegisterProfileInstruction(
    payer: PublicKey,
    profilePda: PublicKey,
    profileConfigPda: PublicKey,
    programId: PublicKey,
    params: { isArbitrator: boolean, username: string }
  ) {
    // Convert username to bytes with length prefix
    const usernameBytes = Buffer.from(params.username);
    const usernameLength = new Uint8Array([usernameBytes.length]);
    
    return new anchor.web3.TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: true },
        { pubkey: profileConfigPda, isSigner: false, isWritable: false },
        { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: Buffer.from([
        1, // Instruction index for register
        params.isArbitrator ? 1 : 0,
        ...usernameLength,
        ...usernameBytes
      ])
    });
  }
  
  async function createInitOfferCounterInstruction(
    payer: PublicKey,
    counterPda: PublicKey,
    programId: PublicKey
  ) {
    return new anchor.web3.TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: counterPda, isSigner: false, isWritable: true },
        { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: Buffer.from([0]) // Instruction index for initialize counter
    });
  }
  
  async function createInitTradeConfigInstruction(
    payer: PublicKey,
    configPda: PublicKey,
    programId: PublicKey
  ) {
    return new anchor.web3.TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: Buffer.from([0]) // Instruction index for initialize config
    });
  }
  
  async function createInitTradeCounterInstruction(
    payer: PublicKey,
    counterPda: PublicKey,
    programId: PublicKey
  ) {
    return new anchor.web3.TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: counterPda, isSigner: false, isWritable: true },
        { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: Buffer.from([1]) // Instruction index for initialize counter
    });
  }
  
  async function createOfferInstruction(
    payer: PublicKey,
    offerPda: PublicKey,
    makerProfilePda: PublicKey,
    counterPda: PublicKey,
    hubPda: PublicKey,
    tokenMint: PublicKey,
    programId: PublicKey,
    params: {
      amount: anchor.BN,
      minAmount: anchor.BN,
      price: anchor.BN,
      direction: { buy: {} } | { sell: {} },
      paymentMethod: { bank: {} } | { other: {} },
      userSettlementDeadlineSec: number,
      disputeDeadlineSec: number,
      paymentDetails: string
    }
  ) {
    // Serialize parameters
    const amountBytes = params.amount.toArray('le', 8);
    const minAmountBytes = params.minAmount.toArray('le', 8);
    const priceBytes = params.price.toArray('le', 8);
    const directionByte = Object.keys(params.direction)[0] === 'buy' ? 0 : 1;
    const paymentMethodByte = Object.keys(params.paymentMethod)[0] === 'bank' ? 0 : 1;
    
    const settlementDeadlineBytes = new Uint8Array(8);
    const disputeDeadlineBytes = new Uint8Array(8);
    
    for (let i = 0; i < 8; i++) {
      settlementDeadlineBytes[i] = (params.userSettlementDeadlineSec >> (8 * i)) & 0xFF;
      disputeDeadlineBytes[i] = (params.disputeDeadlineSec >> (8 * i)) & 0xFF;
    }
    
    const paymentDetailsBytes = Buffer.from(params.paymentDetails);
    const paymentDetailsLength = new Uint8Array([paymentDetailsBytes.length]);
    
    return new anchor.web3.TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: offerPda, isSigner: false, isWritable: true },
        { pubkey: makerProfilePda, isSigner: false, isWritable: false },
        { pubkey: counterPda, isSigner: false, isWritable: true },
        { pubkey: hubPda, isSigner: false, isWritable: false },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: Buffer.from([
        2, // Instruction index for create offer
        ...amountBytes,
        ...minAmountBytes,
        ...priceBytes,
        directionByte,
        paymentMethodByte,
        ...settlementDeadlineBytes,
        ...disputeDeadlineBytes,
        ...paymentDetailsLength,
        ...paymentDetailsBytes
      ])
    });
  }
  
  async function createTakeOfferInstruction(
    payer: PublicKey,
    tradePda: PublicKey,
    takerProfilePda: PublicKey,
    tradeCounterPda: PublicKey,
    offerPda: PublicKey,
    tradeConfigPda: PublicKey,
    makerTokenAccount: PublicKey,
    hubPda: PublicKey,
    arbitratorProfilePda: PublicKey,
    programId: PublicKey,
    params: {
      amount: anchor.BN,
      autoRelease: boolean
    }
  ) {
    // Serialize parameters
    const amountBytes = params.amount.toArray('le', 8);
    const autoReleaseByte = params.autoRelease ? 1 : 0;
    
    return new anchor.web3.TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: tradePda, isSigner: false, isWritable: true },
        { pubkey: takerProfilePda, isSigner: false, isWritable: false },
        { pubkey: tradeCounterPda, isSigner: false, isWritable: true },
        { pubkey: offerPda, isSigner: false, isWritable: true },
        { pubkey: tradeConfigPda, isSigner: false, isWritable: false },
        { pubkey: makerTokenAccount, isSigner: false, isWritable: false },
        { pubkey: hubPda, isSigner: false, isWritable: false },
        { pubkey: arbitratorProfilePda, isSigner: false, isWritable: false },
        { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: Buffer.from([
        2, // Instruction index for take offer
        ...amountBytes,
        autoReleaseByte
      ])
    });
  }
  
  async function createPaymentSentInstruction(
    payer: PublicKey,
    tradePda: PublicKey,
    takerProfilePda: PublicKey,
    programId: PublicKey
  ) {
    return new anchor.web3.TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: false },
        { pubkey: tradePda, isSigner: false, isWritable: true },
        { pubkey: takerProfilePda, isSigner: false, isWritable: false }
      ],
      programId,
      data: Buffer.from([3]) // Instruction index for payment sent
    });
  }
  
  async function createReleaseTradeInstruction(
    payer: PublicKey,
    tradePda: PublicKey,
    makerProfilePda: PublicKey,
    makerTokenAccount: PublicKey,
    takerTokenAccount: PublicKey,
    tokenMint: PublicKey,
    programId: PublicKey
  ) {
    return new anchor.web3.TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: false },
        { pubkey: tradePda, isSigner: false, isWritable: true },
        { pubkey: makerProfilePda, isSigner: false, isWritable: false },
        { pubkey: makerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: takerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
      ],
      programId,
      data: Buffer.from([4]) // Instruction index for release
    });
  }
  
  // Account fetching helper functions
  async function fetchHubAccount(pubkey: PublicKey): Promise<any> {
    if (accountCache[pubkey.toString()]) {
      return accountCache[pubkey.toString()];
    }
    
    const accountInfo = await connection.getAccountInfo(pubkey);
    if (!accountInfo) return null;
    
    // Simple deserialization
    const data = accountInfo.data;
    const account = {
      commissionBps: data[8] | (data[9] << 8),
      arbitratorCut: data[10]
    };
    
    accountCache[pubkey.toString()] = account;
    return account;
  }
  
  async function fetchOfferCounterAccount(pubkey: PublicKey): Promise<{ count: number }> {
    try {
        const account = await offerProgram.account.offerCounter.fetch(pubkey);
        return { count: account.count }; // Assuming counter account has 'count' field
    } catch (error) {
        console.error("Failed to fetch offer counter:", error);
        // Handle account not found potentially
        return { count: 0 }; // Or throw error
    }
  }
  
  async function fetchTradeCounterAccount(pubkey: PublicKey): Promise<{ count: number }> {
    try {
        const account = await tradeProgram.account.tradesCounter.fetch(pubkey);
        return { count: account.counter }; // Assuming counter account has 'counter' field based on IDL
    } catch (error) {
        console.error("Failed to fetch trade counter:", error);
        // Handle account not found potentially
        return { count: 0 }; // Or throw error
    }
  }
  
  async function fetchTradeAccount(pubkey: PublicKey): Promise<any> {
    if (accountCache[pubkey.toString()]) {
      return accountCache[pubkey.toString()];
    }
    
    const accountInfo = await connection.getAccountInfo(pubkey);
    if (!accountInfo) return null;
    
    // Simple deserialization - just check state bits 
    // Real implementation would deserialize the full account data
    const data = accountInfo.data;
    const stateByte = data[50]; // Approximate position of state byte
    
    const account = {
      state: {
        initial: stateByte === 0,
        paymentSent: stateByte === 1,
        disputed: stateByte === 2,
        completed: stateByte === 3,
        canceled: stateByte === 4
      }
    };
    
    accountCache[pubkey.toString()] = account;
    return account;
  }
}); 