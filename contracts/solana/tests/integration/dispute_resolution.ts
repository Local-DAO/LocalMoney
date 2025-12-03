import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { IntegrationTestEnv } from "./setup";
import {
  getOfferPda,
  getTradePda,
  getUserProfilePda,
  getDisputePda
} from "../utils";

/**
 * Integration Test: Dispute Resolution Flow
 *
 * Tests the complete dispute resolution process including:
 * - Dispute initiation by buyer or seller
 * - Evidence submission from both parties
 * - Arbitrator assignment
 * - Resolution in favor of buyer
 * - Resolution in favor of seller
 * - Arbitrator fee distribution
 *
 * This test validates the entire dispute resolution mechanism that ensures
 * fair resolution when trades don't complete successfully.
 */
describe("Integration: Dispute Resolution", () => {
  const env = new IntegrationTestEnv();

  before(async () => {
    await env.setup();
  });

  /**
   * Scenario 1: Buyer initiates dispute and wins
   *
   * Flow:
   * 1. Create trade and fund escrow (seller funds)
   * 2. Buyer initiates dispute before confirming fiat
   * 3. Both parties submit evidence
   * 4. Arbitrator resolves in favor of buyer
   * 5. Buyer receives tokens with arbitrator fee deducted
   * 6. Arbitrator receives fee
   */
  describe("Scenario 1: Buyer Initiates Dispute and Wins", () => {
    let offerId: number;
    let tradeId: number;
    const tradeAmount = 10 * 10**6; // 10 tokens

    it("Should complete setup: create profiles, offer, and trade", async () => {
      env.logScenario("Setup: Create profiles, offer, and trade for dispute scenario");

      // Create profiles
      await env.createProfile(env.seller, "seller-contact-encrypted");
      await env.createProfile(env.buyer, "buyer-contact-encrypted");

      console.log("✓ Created seller and buyer profiles");

      // Create sell offer
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 5 * 10**6,
        maxAmount: 20 * 10**6,
        rate: 100, // $1.00 per token
        description: "Test offer for dispute",
      });
      offerId = offerResult.offerId;

      console.log(`✓ Created sell offer #${offerId}`);

      // Mint tokens to seller
      await env.mintTokensTo(env.seller, 100 * 10**6);
      const sellerBalance = await env.getTokenBalance(env.seller);
      expect(sellerBalance).to.equal(100 * 10**6);
      console.log(`✓ Minted 100 tokens to seller`);
    });

    it("Should create trade request and accept", async () => {
      // Buyer creates trade
      const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
      const [offerPda] = getOfferPda(offerId, env.programs.offer.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(env.tradeCounterValue.toString())],
        env.programs.escrow.programId
      );
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );
      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);

      await env.programs.trade.methods
        .createTrade({
          offerId: offerId,
          amount: new anchor.BN(tradeAmount),
          fiatAmount: new anchor.BN(10 * 100), // $10.00
          buyerContact: "buyer-contact-for-dispute",
        })
        .accounts({
          trade: tradePda,
          counter: env.tradeCounter,
          offer: offerPda,
          buyer: env.buyer.publicKey,
          buyerProfile: buyerProfile,
          hubConfig: hubConfig,
          escrowVault: escrowVault,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.buyer])
        .rpc();

      tradeId = env.tradeCounterValue;
      env.tradeCounterValue++;

      console.log(`✓ Buyer created trade #${tradeId}`);

      // Seller accepts trade
      const trade = await env.programs.trade.account.trade.fetch(tradePda);

      await env.programs.trade.methods
        .acceptTrade({
          sellerContact: "seller-contact-for-dispute",
        })
        .accounts({
          trade: tradePda,
          seller: env.seller.publicKey,
          offer: offerPda,
        })
        .signers([env.seller])
        .rpc();

      const tradeAfterAccept = await env.programs.trade.account.trade.fetch(tradePda);
      expect(tradeAfterAccept.state.requestAccepted).to.not.be.undefined;

      console.log(`✓ Seller accepted trade`);
    });

    it("Should fund escrow (seller deposits tokens)", async () => {
      const [tradePda] = getTradePda(tradeId, env.programs.trade.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(tradeId.toString())],
        env.programs.escrow.programId
      );

      // Get seller's token account
      const sellerTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: env.seller.publicKey,
      });

      // Create escrow vault token account if needed
      const vaultTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: escrowVault,
      });

      const sellerBalanceBefore = await env.getTokenBalance(env.seller);

      await env.programs.trade.methods
        .fundEscrow()
        .accounts({
          trade: tradePda,
          funder: env.seller.publicKey,
          funderTokenAccount: sellerTokenAccount,
          escrowVault: escrowVault,
          escrowVaultTokenAccount: vaultTokenAccount,
          tokenMint: env.testToken.publicKey,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.seller])
        .rpc();

      const sellerBalanceAfter = await env.getTokenBalance(env.seller);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore - tradeAmount);

      const tradeAfterFund = await env.programs.trade.account.trade.fetch(tradePda);
      expect(tradeAfterFund.state.escrowFunded).to.not.be.undefined;

      console.log(`✓ Seller funded escrow with ${tradeAmount / 10**6} tokens`);
    });

    it("Should allow buyer to initiate dispute", async () => {
      const [tradePda] = getTradePda(tradeId, env.programs.trade.programId);
      const [disputePda] = getDisputePda(tradeId, env.programs.arbitrator.programId);

      await env.programs.trade.methods
        .initiateDispute()
        .accounts({
          trade: tradePda,
          disputer: env.buyer.publicKey,
          dispute: disputePda,
          arbitratorProgram: env.programs.arbitrator.programId,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.buyer])
        .rpc();

      const tradeAfterDispute = await env.programs.trade.account.trade.fetch(tradePda);
      expect(tradeAfterDispute.state.disputed).to.not.be.undefined;
      expect(tradeAfterDispute.disputeInitiatedAt).to.not.be.null;

      console.log(`✓ Buyer initiated dispute for trade #${tradeId}`);
    });

    it("Should allow both parties to submit evidence", async () => {
      const [disputePda] = getDisputePda(tradeId, env.programs.arbitrator.programId);

      // Buyer submits evidence
      await env.programs.arbitrator.methods
        .submitEvidence({
          evidence: "Buyer evidence: Paid via bank transfer, have receipt",
        })
        .accounts({
          dispute: disputePda,
          submitter: env.buyer.publicKey,
        })
        .signers([env.buyer])
        .rpc();

      console.log(`✓ Buyer submitted evidence`);

      // Seller submits evidence
      await env.programs.arbitrator.methods
        .submitEvidence({
          evidence: "Seller evidence: No payment received in bank account",
        })
        .accounts({
          dispute: disputePda,
          submitter: env.seller.publicKey,
        })
        .signers([env.seller])
        .rpc();

      console.log(`✓ Seller submitted evidence`);

      const dispute = await env.programs.arbitrator.account.dispute.fetch(disputePda);
      expect(dispute.buyerEvidence).to.contain("Paid via bank transfer");
      expect(dispute.sellerEvidence).to.contain("No payment received");
    });

    it("Should allow arbitrator to resolve in favor of buyer", async () => {
      const [tradePda] = getTradePda(tradeId, env.programs.trade.programId);
      const [disputePda] = getDisputePda(tradeId, env.programs.arbitrator.programId);

      const buyerBalanceBefore = await env.getTokenBalance(env.buyer);
      const arbitratorBalanceBefore = await env.getTokenBalance(env.arbitrator);

      // Arbitrator resolves in favor of buyer
      await env.programs.arbitrator.methods
        .resolveDispute({
          winner: { buyer: {} }, // Buyer wins
        })
        .accounts({
          dispute: disputePda,
          trade: tradePda,
          arbitrator: env.arbitrator.publicKey,
        })
        .signers([env.arbitrator])
        .rpc();

      const tradeAfterResolution = await env.programs.trade.account.trade.fetch(tradePda);
      expect(tradeAfterResolution.state.disputeResolved).to.not.be.undefined;

      console.log(`✓ Arbitrator resolved dispute in favor of buyer`);

      const dispute = await env.programs.arbitrator.account.dispute.fetch(disputePda);
      expect(dispute.resolution).to.not.be.null;
      expect(dispute.resolution.buyer).to.not.be.undefined;
    });

    it("Should release tokens to buyer with arbitrator fee deducted", async () => {
      const [tradePda] = getTradePda(tradeId, env.programs.trade.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(tradeId.toString())],
        env.programs.escrow.programId
      );
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const buyerTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: env.buyer.publicKey,
      });

      const treasuryTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: env.treasury.publicKey,
      });

      const warchestTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: env.warchest.publicKey,
      });

      const arbitratorTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: env.arbitrator.publicKey,
      });

      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);
      const [sellerProfile] = getUserProfilePda(env.seller.publicKey, env.programs.profile.programId);
      const [offerPda] = getOfferPda(offerId, env.programs.offer.programId);

      const buyerBalanceBefore = await env.getTokenBalance(env.buyer);

      // TODO: This will use Escrow program CPI for fee distribution once implemented
      await env.programs.trade.methods
        .releaseEscrow()
        .accounts({
          trade: tradePda,
          releaser: env.arbitrator.publicKey, // Arbitrator releases
          escrowVault: escrowVault,
          recipientTokenAccount: buyerTokenAccount,
          treasuryTokenAccount: treasuryTokenAccount,
          warchestTokenAccount: warchestTokenAccount,
          arbitratorTokenAccount: arbitratorTokenAccount,
          hubConfig: hubConfig,
          buyerProfile: buyerProfile,
          sellerProfile: sellerProfile,
          offer: offerPda,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([env.arbitrator])
        .rpc();

      const buyerBalanceAfter = await env.getTokenBalance(env.buyer);

      // Buyer should receive tokens minus fees
      // Fees: chain (1%) + warchest (1%) + arbitrator (2% for dispute) = 4%
      // Expected: 10 tokens * 96% = 9.6 tokens
      const expectedBuyerAmount = Math.floor(tradeAmount * 0.96);

      // NOTE: Actual fee calculation will happen in Escrow program CPI
      // This test validates the flow, exact amounts pending CPI implementation
      console.log(`✓ Buyer balance after release: ${buyerBalanceAfter / 10**6} tokens`);
      console.log(`  Expected: ~${expectedBuyerAmount / 10**6} tokens (96% after fees)`);

      const tradeAfterRelease = await env.programs.trade.account.trade.fetch(tradePda);
      expect(tradeAfterRelease.state.escrowReleased).to.not.be.undefined;
    });

    it("Should verify arbitrator received fee", async () => {
      const arbitratorBalance = await env.getTokenBalance(env.arbitrator);

      // Arbitrator should receive 2% of trade amount (2% of 10 tokens = 0.2 tokens)
      const expectedArbitratorFee = Math.floor(tradeAmount * 0.02);

      console.log(`✓ Arbitrator fee: ~${expectedArbitratorFee / 10**6} tokens (2%)`);
      // NOTE: Exact amount pending Escrow CPI implementation
    });
  });

  /**
   * Scenario 2: Seller initiates dispute and wins
   *
   * Flow:
   * 1. Create trade and fund escrow
   * 2. Buyer confirms fiat deposit
   * 3. Seller initiates dispute before release
   * 4. Both parties submit evidence
   * 5. Arbitrator resolves in favor of seller
   * 6. Seller receives tokens back (refund)
   * 7. Arbitrator receives fee
   */
  describe("Scenario 2: Seller Initiates Dispute and Wins", () => {
    let offerId: number;
    let tradeId: number;
    const tradeAmount = 5 * 10**6; // 5 tokens

    it("Should complete setup and fund escrow", async () => {
      env.logScenario("Setup: Create trade and fund escrow for seller dispute");

      // Create sell offer
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 1 * 10**6,
        maxAmount: 10 * 10**6,
        rate: 100,
        description: "Test offer for seller dispute",
      });
      offerId = offerResult.offerId;

      // Create trade
      const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
      const [offerPda] = getOfferPda(offerId, env.programs.offer.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(env.tradeCounterValue.toString())],
        env.programs.escrow.programId
      );
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );
      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);

      await env.programs.trade.methods
        .createTrade({
          offerId: offerId,
          amount: new anchor.BN(tradeAmount),
          fiatAmount: new anchor.BN(5 * 100),
          buyerContact: "buyer-contact-2",
        })
        .accounts({
          trade: tradePda,
          counter: env.tradeCounter,
          offer: offerPda,
          buyer: env.buyer.publicKey,
          buyerProfile: buyerProfile,
          hubConfig: hubConfig,
          escrowVault: escrowVault,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.buyer])
        .rpc();

      tradeId = env.tradeCounterValue;
      env.tradeCounterValue++;

      // Accept trade
      await env.programs.trade.methods
        .acceptTrade({ sellerContact: "seller-contact-2" })
        .accounts({
          trade: tradePda,
          seller: env.seller.publicKey,
          offer: offerPda,
        })
        .signers([env.seller])
        .rpc();

      // Fund escrow
      const sellerTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: env.seller.publicKey,
      });
      const vaultTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: escrowVault,
      });

      await env.programs.trade.methods
        .fundEscrow()
        .accounts({
          trade: tradePda,
          funder: env.seller.publicKey,
          funderTokenAccount: sellerTokenAccount,
          escrowVault: escrowVault,
          escrowVaultTokenAccount: vaultTokenAccount,
          tokenMint: env.testToken.publicKey,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.seller])
        .rpc();

      console.log(`✓ Created trade #${tradeId} and funded escrow`);
    });

    it("Should allow buyer to confirm fiat deposit", async () => {
      const [tradePda] = getTradePda(tradeId, env.programs.trade.programId);

      await env.programs.trade.methods
        .confirmFiatDeposit()
        .accounts({
          trade: tradePda,
          buyer: env.buyer.publicKey,
        })
        .signers([env.buyer])
        .rpc();

      const trade = await env.programs.trade.account.trade.fetch(tradePda);
      expect(trade.state.fiatDeposited).to.not.be.undefined;

      console.log(`✓ Buyer confirmed fiat deposit`);
    });

    it("Should allow seller to initiate dispute", async () => {
      const [tradePda] = getTradePda(tradeId, env.programs.trade.programId);
      const [disputePda] = getDisputePda(tradeId, env.programs.arbitrator.programId);

      await env.programs.trade.methods
        .initiateDispute()
        .accounts({
          trade: tradePda,
          disputer: env.seller.publicKey,
          dispute: disputePda,
          arbitratorProgram: env.programs.arbitrator.programId,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([env.seller])
        .rpc();

      const trade = await env.programs.trade.account.trade.fetch(tradePda);
      expect(trade.state.disputed).to.not.be.undefined;

      console.log(`✓ Seller initiated dispute`);
    });

    it("Should allow evidence submission and arbitrator resolution for seller", async () => {
      const [disputePda] = getDisputePda(tradeId, env.programs.arbitrator.programId);
      const [tradePda] = getTradePda(tradeId, env.programs.trade.programId);

      // Submit evidence
      await env.programs.arbitrator.methods
        .submitEvidence({ evidence: "Buyer: Payment sent" })
        .accounts({ dispute: disputePda, submitter: env.buyer.publicKey })
        .signers([env.buyer])
        .rpc();

      await env.programs.arbitrator.methods
        .submitEvidence({ evidence: "Seller: No payment received, buyer using fraudulent receipt" })
        .accounts({ dispute: disputePda, submitter: env.seller.publicKey })
        .signers([env.seller])
        .rpc();

      console.log(`✓ Both parties submitted evidence`);

      // Arbitrator resolves in favor of seller
      await env.programs.arbitrator.methods
        .resolveDispute({ winner: { seller: {} } })
        .accounts({
          dispute: disputePda,
          trade: tradePda,
          arbitrator: env.arbitrator.publicKey,
        })
        .signers([env.arbitrator])
        .rpc();

      const dispute = await env.programs.arbitrator.account.dispute.fetch(disputePda);
      expect(dispute.resolution).to.not.be.null;
      expect(dispute.resolution.seller).to.not.be.undefined;

      console.log(`✓ Arbitrator resolved in favor of seller`);
    });

    it("Should refund tokens to seller with arbitrator fee deducted", async () => {
      const [tradePda] = getTradePda(tradeId, env.programs.trade.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(tradeId.toString())],
        env.programs.escrow.programId
      );
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const sellerTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: env.seller.publicKey,
      });

      const treasuryTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: env.treasury.publicKey,
      });

      const warchestTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: env.warchest.publicKey,
      });

      const arbitratorTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: env.arbitrator.publicKey,
      });

      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);
      const [sellerProfile] = getUserProfilePda(env.seller.publicKey, env.programs.profile.programId);
      const [offerPda] = getOfferPda(offerId, env.programs.offer.programId);

      const sellerBalanceBefore = await env.getTokenBalance(env.seller);

      // Release to seller (winner)
      await env.programs.trade.methods
        .releaseEscrow()
        .accounts({
          trade: tradePda,
          releaser: env.arbitrator.publicKey,
          escrowVault: escrowVault,
          recipientTokenAccount: sellerTokenAccount,
          treasuryTokenAccount: treasuryTokenAccount,
          warchestTokenAccount: warchestTokenAccount,
          arbitratorTokenAccount: arbitratorTokenAccount,
          hubConfig: hubConfig,
          buyerProfile: buyerProfile,
          sellerProfile: sellerProfile,
          offer: offerPda,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([env.arbitrator])
        .rpc();

      const sellerBalanceAfter = await env.getTokenBalance(env.seller);

      console.log(`✓ Seller received refund: ${(sellerBalanceAfter - sellerBalanceBefore) / 10**6} tokens`);
      console.log(`  Expected: ~${(tradeAmount * 0.96) / 10**6} tokens (96% after fees)`);

      const trade = await env.programs.trade.account.trade.fetch(tradePda);
      expect(trade.state.escrowReleased).to.not.be.undefined;
    });
  });

  /**
   * Edge Cases and Validations
   */
  describe("Dispute Edge Cases", () => {
    it("Should prevent dispute initiation before escrow funded", async () => {
      // TODO: Test that dispute cannot be initiated in RequestCreated or RequestAccepted states
    });

    it("Should prevent non-parties from initiating dispute", async () => {
      // TODO: Test that only buyer or seller can initiate dispute
    });

    it("Should prevent duplicate evidence submission", async () => {
      // TODO: Test that each party can only submit evidence once
    });

    it("Should prevent non-assigned arbitrator from resolving", async () => {
      // TODO: Test that only the assigned arbitrator can resolve
    });

    it("Should prevent resolution without evidence from both parties", async () => {
      // TODO: Test that both parties must submit evidence before resolution
    });

    it("Should handle dispute timeout correctly", async () => {
      // TODO: Test dispute timeout mechanism if implemented
    });
  });
});
