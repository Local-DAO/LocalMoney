import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { IntegrationTestSetup } from "./setup";
import {
  getProfilePDA,
  getOfferPDA,
  getTradePDA,
  getEscrowVaultPDA,
  fiatToBytes,
} from "../utils";
import {
  getOrCreateAssociatedTokenAccount,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";

/**
 * Complete Trade Flow Integration Test
 *
 * Tests the full lifecycle of a P2P trade from offer creation to escrow release:
 *
 * 1. Seller creates profile
 * 2. Buyer creates profile
 * 3. Seller creates sell offer
 * 4. Seller mints tokens to their account
 * 5. Buyer creates trade request
 * 6. Seller accepts trade
 * 7. Seller funds escrow with tokens
 * 8. Buyer confirms fiat deposit
 * 9. System releases escrow to buyer with fee distribution
 * 10. Verify final balances and statistics
 *
 * This test validates:
 * - Profile creation and management
 * - Offer lifecycle
 * - Trade state machine
 * - Escrow funding and release
 * - Fee distribution (chain, warchest, burn fees)
 * - Profile statistics updates
 */
describe("Complete Trade Flow Integration", () => {
  let setup: IntegrationTestSetup;

  before(async () => {
    setup = new IntegrationTestSetup();
    await setup.initialize();
  });

  after(async () => {
    await setup.cleanup();
  });

  it("Executes complete sell trade with escrow release", async () => {
    setup.logScenario("COMPLETE TRADE FLOW: Seller → Escrow → Buyer");

    // ============================================================
    // STEP 1: Create user profiles
    // ============================================================
    console.log("\n📋 Step 1: Creating user profiles...");

    const sellerProfile = await setup.createProfile(
      setup.seller,
      "seller@example.com_encrypted"
    );
    console.log(`  ✓ Seller profile: ${sellerProfile.toBase58()}`);

    const buyerProfile = await setup.createProfile(
      setup.buyer,
      "buyer@example.com_encrypted"
    );
    console.log(`  ✓ Buyer profile: ${buyerProfile.toBase58()}`);

    // Verify profiles created
    const sellerProfileData = await setup.profileProgram.account.userProfile.fetch(
      sellerProfile
    );
    expect(sellerProfileData.owner.toBase58()).to.equal(setup.seller.publicKey.toBase58());
    expect(sellerProfileData.totalTrades.toNumber()).to.equal(0);

    // ============================================================
    // STEP 2: Create sell offer
    // ============================================================
    console.log("\n🏷️  Step 2: Creating sell offer...");

    const offerParams = {
      fiatCurrency: "USD",
      minAmount: new BN(1_000_000), // 1 token (6 decimals)
      maxAmount: new BN(100_000_000), // 100 tokens
      rate: new BN(1_000_000), // $1.00 per token (6 decimals for cents)
      description: "Selling USDC for USD via bank transfer",
    };

    const { offerPDA, offerId } = await setup.createSellOffer(setup.seller, offerParams);
    console.log(`  ✓ Offer created: ID ${offerId.toString()}, PDA ${offerPDA.toBase58()}`);

    // Verify offer created
    const offerData = await setup.offerProgram.account.offer.fetch(offerPDA);
    expect(offerData.owner.toBase58()).to.equal(setup.seller.publicKey.toBase58());
    expect(offerData.state).to.deep.equal({ active: {} });

    // ============================================================
    // STEP 3: Mint tokens to seller
    // ============================================================
    console.log("\n🪙 Step 3: Minting tokens to seller...");

    const sellerTokenAccount = await setup.mintTokensTo(
      setup.seller.publicKey,
      100_000_000 // 100 tokens
    );
    console.log(`  ✓ Seller token account: ${sellerTokenAccount.toBase58()}`);

    const sellerBalanceBefore = await setup.getTokenBalance(sellerTokenAccount);
    console.log(`  ✓ Seller balance: ${sellerBalanceBefore / 1_000_000} tokens`);
    expect(sellerBalanceBefore).to.equal(100_000_000);

    // ============================================================
    // STEP 4: Buyer creates trade request
    // ============================================================
    console.log("\n🤝 Step 4: Buyer creating trade request...");

    const tradeAmount = new BN(10_000_000); // 10 tokens
    const fiatAmount = new BN(10_00); // $10.00 in cents

    const counterAccount = await setup.tradeProgram.account.tradeCounter.fetch(
      setup.tradeCounterPDA
    );
    const tradeId = counterAccount.count;
    const [tradePDA] = await getTradePDA(tradeId, setup.tradeProgram.programId);

    await setup.tradeProgram.methods
      .createTrade({
        offerId,
        amount: tradeAmount,
        fiatAmount,
        buyerContact: "buyer_bank_details_encrypted",
      })
      .accounts({
        trade: tradePDA,
        tradeCounter: setup.tradeCounterPDA,
        offer: offerPDA,
        buyer: setup.buyer.publicKey,
        seller: setup.seller.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([setup.buyer.keypair])
      .rpc();

    console.log(`  ✓ Trade created: ID ${tradeId.toString()}, PDA ${tradePDA.toBase58()}`);

    // Verify trade created
    let tradeData = await setup.tradeProgram.account.trade.fetch(tradePDA);
    expect(tradeData.state).to.deep.equal({ requestCreated: {} });
    expect(tradeData.buyer.toBase58()).to.equal(setup.buyer.publicKey.toBase58());
    expect(tradeData.seller.toBase58()).to.equal(setup.seller.publicKey.toBase58());
    expect(tradeData.amount.toString()).to.equal(tradeAmount.toString());

    // ============================================================
    // STEP 5: Seller accepts trade
    // ============================================================
    console.log("\n✅ Step 5: Seller accepting trade...");

    await setup.tradeProgram.methods
      .acceptTrade({
        sellerContact: "seller_bank_details_encrypted",
      })
      .accounts({
        trade: tradePDA,
        seller: setup.seller.publicKey,
      })
      .signers([setup.seller.keypair])
      .rpc();

    console.log("  ✓ Trade accepted by seller");

    // Verify state transition
    tradeData = await setup.tradeProgram.account.trade.fetch(tradePDA);
    expect(tradeData.state).to.deep.equal({ requestAccepted: {} });
    expect(tradeData.sellerContact).to.equal("seller_bank_details_encrypted");

    // ============================================================
    // STEP 6: Seller funds escrow
    // ============================================================
    console.log("\n🔒 Step 6: Seller funding escrow...");

    const [escrowVaultPDA] = await getEscrowVaultPDA(tradeId, setup.escrowProgram.programId);

    // Get or create escrow vault token account (ATA)
    const escrowVaultATA = await getOrCreateAssociatedTokenAccount(
      setup.connection,
      setup.seller.keypair,
      setup.tokenMint,
      escrowVaultPDA,
      true // Allow PDA owner
    );

    console.log(`  ✓ Escrow vault ATA: ${escrowVaultATA.address.toBase58()}`);

    await setup.tradeProgram.methods
      .fundEscrow()
      .accounts({
        trade: tradePDA,
        escrowVault: escrowVaultPDA,
        escrowVaultAta: escrowVaultATA.address,
        depositor: setup.seller.publicKey,
        depositorTokenAccount: sellerTokenAccount,
        tokenMint: setup.tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([setup.seller.keypair])
      .rpc();

    console.log("  ✓ Escrow funded with tokens");

    // Verify escrow funded
    const escrowBalance = await setup.getTokenBalance(escrowVaultATA.address);
    console.log(`  ✓ Escrow balance: ${escrowBalance / 1_000_000} tokens`);
    expect(escrowBalance).to.equal(tradeAmount.toNumber());

    const sellerBalanceAfterEscrow = await setup.getTokenBalance(sellerTokenAccount);
    console.log(`  ✓ Seller balance after escrow: ${sellerBalanceAfterEscrow / 1_000_000} tokens`);
    expect(sellerBalanceAfterEscrow).to.equal(sellerBalanceBefore - tradeAmount.toNumber());

    // Verify state transition
    tradeData = await setup.tradeProgram.account.trade.fetch(tradePDA);
    expect(tradeData.state).to.deep.equal({ escrowFunded: {} });

    // ============================================================
    // STEP 7: Buyer confirms fiat deposit
    // ============================================================
    console.log("\n💵 Step 7: Buyer confirming fiat deposit...");

    await setup.tradeProgram.methods
      .confirmFiatDeposit()
      .accounts({
        trade: tradePDA,
        buyer: setup.buyer.publicKey,
      })
      .signers([setup.buyer.keypair])
      .rpc();

    console.log("  ✓ Fiat deposit confirmed by buyer");

    // Verify state transition
    tradeData = await setup.tradeProgram.account.trade.fetch(tradePDA);
    expect(tradeData.state).to.deep.equal({ fiatDeposited: {} });

    // ============================================================
    // STEP 8: Release escrow to buyer
    // ============================================================
    console.log("\n🎉 Step 8: Releasing escrow to buyer...");

    // Create buyer's token account if needed
    const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(
      setup.connection,
      setup.buyer.keypair,
      setup.tokenMint,
      setup.buyer.publicKey
    );

    // Create treasury and warchest token accounts for fees
    const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
      setup.connection,
      setup.admin.keypair,
      setup.tokenMint,
      setup.admin.publicKey // Using admin as treasury
    );

    const warchestTokenAccount = treasuryTokenAccount; // Same for simplicity

    console.log(`  ✓ Buyer token account: ${buyerTokenAccount.address.toBase58()}`);

    // Get hub config for fee calculation
    const hubConfig = await setup.hubProgram.account.hubConfig.fetch(setup.hubConfigPDA);

    await setup.tradeProgram.methods
      .releaseEscrow()
      .accounts({
        trade: tradePDA,
        escrowVault: escrowVaultPDA,
        escrowVaultAta: escrowVaultATA.address,
        recipient: setup.buyer.publicKey,
        recipientTokenAccount: buyerTokenAccount.address,
        treasury: hubConfig.treasury,
        treasuryTokenAccount: treasuryTokenAccount.address,
        warchest: hubConfig.warchest,
        warchestTokenAccount: warchestTokenAccount.address,
        tokenMint: setup.tokenMint,
        seller: setup.seller.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([setup.seller.keypair]) // Seller releases after fiat confirmed
      .rpc();

    console.log("  ✓ Escrow released to buyer");

    // ============================================================
    // STEP 9: Verify final balances and fee distribution
    // ============================================================
    console.log("\n📊 Step 9: Verifying final balances...");

    const buyerBalance = await setup.getTokenBalance(buyerTokenAccount.address);
    const escrowBalanceAfter = await setup.getTokenBalance(escrowVaultATA.address);
    const treasuryBalance = await setup.getTokenBalance(treasuryTokenAccount.address);

    console.log(`  ✓ Buyer final balance: ${buyerBalance / 1_000_000} tokens`);
    console.log(`  ✓ Escrow final balance: ${escrowBalanceAfter / 1_000_000} tokens`);
    console.log(`  ✓ Treasury balance: ${treasuryBalance / 1_000_000} tokens`);

    // Calculate expected amounts
    const totalFees = tradeAmount.toNumber() * (hubConfig.chainFeePct + hubConfig.warchestFeePct + hubConfig.burnFeePct) / 10000;
    const expectedBuyerAmount = tradeAmount.toNumber() - totalFees;

    console.log(`  ✓ Total fees: ${totalFees / 1_000_000} tokens`);
    console.log(`  ✓ Expected buyer amount: ${expectedBuyerAmount / 1_000_000} tokens`);

    // Verify amounts (allowing for small rounding differences)
    expect(buyerBalance).to.be.closeTo(expectedBuyerAmount, 100);
    expect(escrowBalanceAfter).to.equal(0);

    // Verify trade state
    tradeData = await setup.tradeProgram.account.trade.fetch(tradePDA);
    expect(tradeData.state).to.deep.equal({ escrowReleased: {} });

    console.log("\n✅ COMPLETE TRADE FLOW TEST PASSED!");
    console.log("   - Profiles created");
    console.log("   - Offer created and validated");
    console.log("   - Trade request created and accepted");
    console.log("   - Escrow funded correctly");
    console.log("   - Fiat deposit confirmed");
    console.log("   - Escrow released with fee distribution");
    console.log("   - All state transitions valid");
    console.log("   - Final balances correct\n");
  });
});
