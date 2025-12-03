import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { IntegrationTestSetup } from "./setup";
import {
  getProfilePDA,
  getTradePDA,
  getEscrowVaultPDA,
} from "../utils";
import {
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";

/**
 * Cancellation Flows Integration Test
 *
 * Tests various cancellation scenarios throughout the trade lifecycle:
 *
 * Scenario 1: Cancel Before Accept
 * - Buyer creates trade request
 * - Buyer cancels before seller accepts
 * - Verify state: RequestCreated → RequestCanceled
 *
 * Scenario 2: Cancel Before Escrow
 * - Buyer creates trade request
 * - Seller accepts
 * - Buyer cancels before escrow funded
 * - Verify state: RequestAccepted → RequestCanceled
 *
 * Scenario 3: Refund After Escrow Funded
 * - Complete flow up to escrow funded
 * - Seller initiates refund
 * - Verify tokens returned to seller
 * - Verify state: EscrowFunded → EscrowRefunded
 */
describe("Cancellation Flows Integration", () => {
  let setup: IntegrationTestSetup;

  before(async () => {
    setup = new IntegrationTestSetup();
    await setup.initialize();

    // Create profiles for all tests
    await setup.createProfile(setup.seller, "seller@example.com_encrypted");
    await setup.createProfile(setup.buyer, "buyer@example.com_encrypted");
  });

  after(async () => {
    await setup.cleanup();
  });

  describe("Scenario 1: Cancel Before Accept", () => {
    it("Buyer cancels trade before seller accepts", async () => {
      setup.logScenario("CANCELLATION: Cancel Before Accept");

      // ============================================================
      // STEP 1: Create sell offer
      // ============================================================
      console.log("\n🏷️  Step 1: Creating sell offer...");

      const { offerPDA, offerId } = await setup.createSellOffer(setup.seller, {
        fiatCurrency: "USD",
        minAmount: new BN(1_000_000),
        maxAmount: new BN(100_000_000),
        rate: new BN(1_000_000),
      });

      console.log(`  ✓ Offer created: ID ${offerId.toString()}`);

      // ============================================================
      // STEP 2: Buyer creates trade request
      // ============================================================
      console.log("\n🤝 Step 2: Buyer creating trade request...");

      const tradeAmount = new BN(10_000_000);
      const fiatAmount = new BN(10_00);

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
          buyerContact: "buyer_contact_encrypted",
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

      console.log(`  ✓ Trade created: ID ${tradeId.toString()}`);

      // Verify initial state
      let tradeData = await setup.tradeProgram.account.trade.fetch(tradePDA);
      expect(tradeData.state).to.deep.equal({ requestCreated: {} });

      // ============================================================
      // STEP 3: Buyer cancels trade
      // ============================================================
      console.log("\n❌ Step 3: Buyer canceling trade...");

      await setup.tradeProgram.methods
        .cancelTrade()
        .accounts({
          trade: tradePDA,
          buyer: setup.buyer.publicKey,
        })
        .signers([setup.buyer.keypair])
        .rpc();

      console.log("  ✓ Trade canceled by buyer");

      // ============================================================
      // STEP 4: Verify final state
      // ============================================================
      console.log("\n📊 Step 4: Verifying final state...");

      tradeData = await setup.tradeProgram.account.trade.fetch(tradePDA);
      expect(tradeData.state).to.deep.equal({ requestCanceled: {} });

      console.log("  ✓ State correctly updated to RequestCanceled");
      console.log("\n✅ CANCEL BEFORE ACCEPT TEST PASSED!\n");
    });
  });

  describe("Scenario 2: Cancel After Accept, Before Escrow", () => {
    it("Buyer cancels trade after seller accepts but before escrow funded", async () => {
      setup.logScenario("CANCELLATION: Cancel After Accept, Before Escrow");

      // ============================================================
      // STEP 1: Create sell offer
      // ============================================================
      console.log("\n🏷️  Step 1: Creating sell offer...");

      const { offerPDA, offerId } = await setup.createSellOffer(setup.seller, {
        fiatCurrency: "USD",
        minAmount: new BN(1_000_000),
        maxAmount: new BN(100_000_000),
        rate: new BN(1_000_000),
      });

      console.log(`  ✓ Offer created: ID ${offerId.toString()}`);

      // ============================================================
      // STEP 2: Buyer creates trade request
      // ============================================================
      console.log("\n🤝 Step 2: Buyer creating trade request...");

      const tradeAmount = new BN(10_000_000);
      const fiatAmount = new BN(10_00);

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
          buyerContact: "buyer_contact_encrypted",
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

      console.log(`  ✓ Trade created: ID ${tradeId.toString()}`);

      // ============================================================
      // STEP 3: Seller accepts trade
      // ============================================================
      console.log("\n✅ Step 3: Seller accepting trade...");

      await setup.tradeProgram.methods
        .acceptTrade({
          sellerContact: "seller_contact_encrypted",
        })
        .accounts({
          trade: tradePDA,
          seller: setup.seller.publicKey,
        })
        .signers([setup.seller.keypair])
        .rpc();

      console.log("  ✓ Trade accepted by seller");

      // Verify state
      let tradeData = await setup.tradeProgram.account.trade.fetch(tradePDA);
      expect(tradeData.state).to.deep.equal({ requestAccepted: {} });

      // ============================================================
      // STEP 4: Buyer cancels trade
      // ============================================================
      console.log("\n❌ Step 4: Buyer canceling trade...");

      await setup.tradeProgram.methods
        .cancelTrade()
        .accounts({
          trade: tradePDA,
          buyer: setup.buyer.publicKey,
        })
        .signers([setup.buyer.keypair])
        .rpc();

      console.log("  ✓ Trade canceled by buyer");

      // ============================================================
      // STEP 5: Verify final state
      // ============================================================
      console.log("\n📊 Step 5: Verifying final state...");

      tradeData = await setup.tradeProgram.account.trade.fetch(tradePDA);
      expect(tradeData.state).to.deep.equal({ requestCanceled: {} });

      console.log("  ✓ State correctly updated to RequestCanceled");
      console.log("\n✅ CANCEL AFTER ACCEPT TEST PASSED!\n");
    });
  });

  describe("Scenario 3: Refund After Escrow Funded", () => {
    it("Seller refunds trade after escrow funded", async () => {
      setup.logScenario("CANCELLATION: Refund After Escrow Funded");

      // ============================================================
      // STEP 1: Create sell offer
      // ============================================================
      console.log("\n🏷️  Step 1: Creating sell offer...");

      const { offerPDA, offerId } = await setup.createSellOffer(setup.seller, {
        fiatCurrency: "USD",
        minAmount: new BN(1_000_000),
        maxAmount: new BN(100_000_000),
        rate: new BN(1_000_000),
      });

      console.log(`  ✓ Offer created: ID ${offerId.toString()}`);

      // ============================================================
      // STEP 2: Mint tokens to seller
      // ============================================================
      console.log("\n🪙 Step 2: Minting tokens to seller...");

      const sellerTokenAccount = await setup.mintTokensTo(
        setup.seller.publicKey,
        100_000_000
      );

      const sellerBalanceBefore = await setup.getTokenBalance(sellerTokenAccount);
      console.log(`  ✓ Seller balance: ${sellerBalanceBefore / 1_000_000} tokens`);

      // ============================================================
      // STEP 3: Create and accept trade
      // ============================================================
      console.log("\n🤝 Step 3: Creating and accepting trade...");

      const tradeAmount = new BN(10_000_000);
      const fiatAmount = new BN(10_00);

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
          buyerContact: "buyer_contact_encrypted",
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

      await setup.tradeProgram.methods
        .acceptTrade({
          sellerContact: "seller_contact_encrypted",
        })
        .accounts({
          trade: tradePDA,
          seller: setup.seller.publicKey,
        })
        .signers([setup.seller.keypair])
        .rpc();

      console.log(`  ✓ Trade created and accepted: ID ${tradeId.toString()}`);

      // ============================================================
      // STEP 4: Seller funds escrow
      // ============================================================
      console.log("\n🔒 Step 4: Seller funding escrow...");

      const [escrowVaultPDA] = await getEscrowVaultPDA(
        tradeId,
        setup.escrowProgram.programId
      );

      const escrowVaultATA = await getOrCreateAssociatedTokenAccount(
        setup.connection,
        setup.seller.keypair,
        setup.tokenMint,
        escrowVaultPDA,
        true
      );

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

      console.log("  ✓ Escrow funded");

      const escrowBalance = await setup.getTokenBalance(escrowVaultATA.address);
      expect(escrowBalance).to.equal(tradeAmount.toNumber());

      const sellerBalanceAfterEscrow = await setup.getTokenBalance(sellerTokenAccount);
      expect(sellerBalanceAfterEscrow).to.equal(
        sellerBalanceBefore - tradeAmount.toNumber()
      );

      // ============================================================
      // STEP 5: Refund trade
      // ============================================================
      console.log("\n↩️  Step 5: Refunding trade...");

      await setup.tradeProgram.methods
        .refundTrade()
        .accounts({
          trade: tradePDA,
          escrowVault: escrowVaultPDA,
          escrowVaultAta: escrowVaultATA.address,
          depositor: setup.seller.publicKey,
          depositorTokenAccount: sellerTokenAccount,
          seller: setup.seller.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([setup.seller.keypair])
        .rpc();

      console.log("  ✓ Trade refunded");

      // ============================================================
      // STEP 6: Verify refund completed
      // ============================================================
      console.log("\n📊 Step 6: Verifying refund...");

      const escrowBalanceAfter = await setup.getTokenBalance(escrowVaultATA.address);
      const sellerBalanceAfterRefund = await setup.getTokenBalance(sellerTokenAccount);

      console.log(`  ✓ Escrow balance after refund: ${escrowBalanceAfter / 1_000_000} tokens`);
      console.log(`  ✓ Seller balance after refund: ${sellerBalanceAfterRefund / 1_000_000} tokens`);

      expect(escrowBalanceAfter).to.equal(0);
      expect(sellerBalanceAfterRefund).to.equal(sellerBalanceBefore);

      // Verify trade state
      const tradeData = await setup.tradeProgram.account.trade.fetch(tradePDA);
      expect(tradeData.state).to.deep.equal({ escrowRefunded: {} });

      console.log("  ✓ State correctly updated to EscrowRefunded");
      console.log("  ✓ Full refund completed");
      console.log("\n✅ REFUND AFTER ESCROW FUNDED TEST PASSED!\n");
    });
  });

  describe("Edge Cases", () => {
    it("Prevents cancel after escrow funded (must use refund)", async () => {
      console.log("\n🚫 Testing: Cannot cancel after escrow funded");

      // Create offer, trade, and fund escrow
      const { offerPDA, offerId } = await setup.createSellOffer(setup.seller, {
        fiatCurrency: "USD",
        minAmount: new BN(1_000_000),
        maxAmount: new BN(100_000_000),
        rate: new BN(1_000_000),
      });

      const sellerTokenAccount = await setup.mintTokensTo(setup.seller.publicKey, 100_000_000);

      const counterAccount = await setup.tradeProgram.account.tradeCounter.fetch(
        setup.tradeCounterPDA
      );
      const tradeId = counterAccount.count;
      const [tradePDA] = await getTradePDA(tradeId, setup.tradeProgram.programId);

      await setup.tradeProgram.methods
        .createTrade({
          offerId,
          amount: new BN(10_000_000),
          fiatAmount: new BN(10_00),
          buyerContact: "buyer_contact_encrypted",
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

      await setup.tradeProgram.methods
        .acceptTrade({ sellerContact: "seller_contact_encrypted" })
        .accounts({ trade: tradePDA, seller: setup.seller.publicKey })
        .signers([setup.seller.keypair])
        .rpc();

      const [escrowVaultPDA] = await getEscrowVaultPDA(tradeId, setup.escrowProgram.programId);
      const escrowVaultATA = await getOrCreateAssociatedTokenAccount(
        setup.connection,
        setup.seller.keypair,
        setup.tokenMint,
        escrowVaultPDA,
        true
      );

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

      // Try to cancel (should fail)
      try {
        await setup.tradeProgram.methods
          .cancelTrade()
          .accounts({ trade: tradePDA, buyer: setup.buyer.publicKey })
          .signers([setup.buyer.keypair])
          .rpc();
        expect.fail("Should have thrown error");
      } catch (error) {
        console.log("  ✓ Cancel correctly rejected for funded escrow");
        expect(error.toString()).to.include("InvalidStateTransition");
      }

      console.log("✅ EDGE CASE TEST PASSED!\n");
    });
  });
});
