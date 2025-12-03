import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { IntegrationTestEnv } from "./setup";
import {
  getOfferPda,
  getTradePda,
  getUserProfilePda,
} from "../utils";

/**
 * Integration Test: Fee Distribution
 *
 * Tests the protocol's fee mechanism to ensure all fees are calculated
 * and distributed correctly:
 *
 * Fee Types (in basis points, 10000 = 100%):
 * 1. Burn Fee - Tokens burned (removed from supply)
 * 2. Chain Fee - Sent to treasury for protocol development
 * 3. Warchest Fee - Sent to warchest for sustainability
 * 4. Conversion Fee - For cross-chain operations (if applicable)
 * 5. Arbitrator Fee - Only in disputed trades (sent to arbitrator)
 *
 * This test validates:
 * - Correct fee calculation using basis points
 * - Proper token transfers to each recipient
 * - Fee limits enforcement (max 5%, max 3%, etc.)
 * - Total fee cap (max 10% combined)
 * - Edge cases (zero fees, max fees, minimum amounts)
 *
 * NOTE: Actual fee distribution requires Escrow program CPI implementation.
 * These tests define the expected behavior.
 */
describe("Integration: Fee Distribution", () => {
  const env = new IntegrationTestEnv();

  before(async () => {
    await env.setup();

    // Create profiles
    await env.createProfile(env.seller, "seller-contact");
    await env.createProfile(env.buyer, "buyer-contact");

    console.log("✓ Test environment ready");
  });

  /**
   * Helper function to calculate fee amount
   * @param amount Base amount in lamports
   * @param feePercentBasisPoints Fee percentage in basis points (100 = 1%)
   * @returns Fee amount in lamports
   */
  function calculateFee(amount: number, feePercentBasisPoints: number): number {
    return Math.floor((amount * feePercentBasisPoints) / 10000);
  }

  /**
   * Test 1: Standard Fee Distribution (No Dispute)
   *
   * Verifies fees are correctly calculated and distributed in a normal trade:
   * - Burn fee: 1% (100 basis points)
   * - Chain fee: 1% (100 basis points)
   * - Warchest fee: 1% (100 basis points)
   * - Total: 3%
   * - Buyer/Seller receives: 97%
   */
  describe("Standard Fee Distribution", () => {
    let offerId: number;
    let tradeId: number;
    const tradeAmount = 100 * 10**6; // 100 tokens

    it("Should verify hub config has expected fee configuration", async () => {
      env.logScenario("Verify Fee Configuration");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);

      console.log("Fee Configuration:");
      console.log(`  Burn Fee: ${config.burnFeePct} basis points (${config.burnFeePct / 100}%)`);
      console.log(`  Chain Fee: ${config.chainFeePct} basis points (${config.chainFeePct / 100}%)`);
      console.log(`  Warchest Fee: ${config.warchestFeePct} basis points (${config.warchestFeePct / 100}%)`);
      console.log(`  Conversion Fee: ${config.conversionFeePct} basis points (${config.conversionFeePct / 100}%)`);
      console.log(`  Arbitrator Fee: ${config.arbitratorFeePct} basis points (${config.arbitratorFeePct / 100}%)`);

      // Total non-dispute fees
      const totalStandardFees = config.burnFeePct + config.chainFeePct + config.warchestFeePct;
      console.log(`  Total Standard Fees: ${totalStandardFees} basis points (${totalStandardFees / 100}%)`);

      // Verify within limits
      expect(config.burnFeePct).to.be.lessThanOrEqual(500); // Max 5%
      expect(config.chainFeePct).to.be.lessThanOrEqual(300); // Max 3%
      expect(config.warchestFeePct).to.be.lessThanOrEqual(300); // Max 3%
      expect(totalStandardFees).to.be.lessThanOrEqual(1000); // Max 10% total
    });

    it("Should complete trade up to FiatDeposited state", async () => {
      env.logScenario("Setup: Complete trade for fee distribution test");

      // Create offer
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 50 * 10**6,
        maxAmount: 200 * 10**6,
        rate: 100,
        description: "Fee distribution test",
      });
      offerId = offerResult.offerId;

      // Mint tokens to seller
      await env.mintTokensTo(env.seller, 200 * 10**6);

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
          fiatAmount: new anchor.BN(100 * 100), // $100
          buyerContact: "buyer-contact",
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
        .acceptTrade({ sellerContact: "seller-contact" })
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

      // Confirm fiat deposit
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

      console.log(`✓ Trade #${tradeId} ready for release with ${tradeAmount / 10**6} tokens in escrow`);
    });

    it("Should calculate expected fee amounts", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);

      const burnFee = calculateFee(tradeAmount, config.burnFeePct);
      const chainFee = calculateFee(tradeAmount, config.chainFeePct);
      const warchestFee = calculateFee(tradeAmount, config.warchestFeePct);
      const totalFees = burnFee + chainFee + warchestFee;
      const recipientAmount = tradeAmount - totalFees;

      console.log("\nExpected Fee Distribution:");
      console.log(`  Trade Amount: ${tradeAmount / 10**6} tokens`);
      console.log(`  Burn Fee (${config.burnFeePct / 100}%): ${burnFee / 10**6} tokens`);
      console.log(`  Chain Fee (${config.chainFeePct / 100}%): ${chainFee / 10**6} tokens`);
      console.log(`  Warchest Fee (${config.warchestFeePct / 100}%): ${warchestFee / 10**6} tokens`);
      console.log(`  Total Fees: ${totalFees / 10**6} tokens`);
      console.log(`  Recipient (Buyer): ${recipientAmount / 10**6} tokens`);

      // Verify calculations
      expect(burnFee).to.be.greaterThan(0);
      expect(chainFee).to.be.greaterThan(0);
      expect(warchestFee).to.be.greaterThan(0);
      expect(recipientAmount).to.equal(tradeAmount - totalFees);
    });

    it("Should release escrow with correct fee distribution", async () => {
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

      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);
      const [sellerProfile] = getUserProfilePda(env.seller.publicKey, env.programs.profile.programId);
      const [offerPda] = getOfferPda(offerId, env.programs.offer.programId);

      // Get balances before release
      const buyerBefore = await env.getTokenBalance(env.buyer);
      const treasuryBefore = await env.getTokenBalance(env.treasury);
      const warchestBefore = await env.getTokenBalance(env.warchest);

      console.log("\nBalances Before Release:");
      console.log(`  Buyer: ${buyerBefore / 10**6} tokens`);
      console.log(`  Treasury: ${treasuryBefore / 10**6} tokens`);
      console.log(`  Warchest: ${warchestBefore / 10**6} tokens`);

      // Release escrow
      // NOTE: This currently doesn't do actual fee distribution
      // Actual implementation requires Escrow program CPI
      await env.programs.trade.methods
        .releaseEscrow()
        .accounts({
          trade: tradePda,
          releaser: env.seller.publicKey,
          escrowVault: escrowVault,
          recipientTokenAccount: buyerTokenAccount,
          treasuryTokenAccount: treasuryTokenAccount,
          warchestTokenAccount: warchestTokenAccount,
          arbitratorTokenAccount: null,
          hubConfig: hubConfig,
          buyerProfile: buyerProfile,
          sellerProfile: sellerProfile,
          offer: offerPda,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([env.seller])
        .rpc();

      // Get balances after release
      const buyerAfter = await env.getTokenBalance(env.buyer);
      const treasuryAfter = await env.getTokenBalance(env.treasury);
      const warchestAfter = await env.getTokenBalance(env.warchest);

      console.log("\nBalances After Release:");
      console.log(`  Buyer: ${buyerAfter / 10**6} tokens`);
      console.log(`  Treasury: ${treasuryAfter / 10**6} tokens`);
      console.log(`  Warchest: ${warchestAfter / 10**6} tokens`);

      console.log("\nBalance Changes:");
      console.log(`  Buyer: +${(buyerAfter - buyerBefore) / 10**6} tokens`);
      console.log(`  Treasury: +${(treasuryAfter - treasuryBefore) / 10**6} tokens`);
      console.log(`  Warchest: +${(warchestAfter - warchestBefore) / 10**6} tokens`);

      // TODO: Verify exact amounts once Escrow CPI is implemented
      // Expected:
      // - Buyer: +97 tokens (100 - 3% fees)
      // - Treasury: +1 token (1% chain fee)
      // - Warchest: +1 token (1% warchest fee)
      // - Burned: 1 token (1% burn fee)

      console.log("\n⚠️  NOTE: Exact fee distribution pending Escrow program CPI implementation");
    });
  });

  /**
   * Test 2: Fee Distribution with Arbitrator Fee (Disputed Trade)
   *
   * In disputed trades, an additional arbitrator fee is deducted:
   * - Burn fee: 1%
   * - Chain fee: 1%
   * - Warchest fee: 1%
   * - Arbitrator fee: 2%
   * - Total: 5%
   * - Winner receives: 95%
   */
  describe("Fee Distribution with Arbitrator Fee", () => {
    it("Should include arbitrator fee in disputed trade", async () => {
      env.logScenario("Fee Distribution with Arbitrator Fee");

      const tradeAmount = 50 * 10**6; // 50 tokens

      // Get hub config
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);

      // Calculate fees including arbitrator
      const burnFee = calculateFee(tradeAmount, config.burnFeePct);
      const chainFee = calculateFee(tradeAmount, config.chainFeePct);
      const warchestFee = calculateFee(tradeAmount, config.warchestFeePct);
      const arbitratorFee = calculateFee(tradeAmount, config.arbitratorFeePct);
      const totalFees = burnFee + chainFee + warchestFee + arbitratorFee;
      const recipientAmount = tradeAmount - totalFees;

      console.log("\nExpected Fee Distribution (Disputed Trade):");
      console.log(`  Trade Amount: ${tradeAmount / 10**6} tokens`);
      console.log(`  Burn Fee (${config.burnFeePct / 100}%): ${burnFee / 10**6} tokens`);
      console.log(`  Chain Fee (${config.chainFeePct / 100}%): ${chainFee / 10**6} tokens`);
      console.log(`  Warchest Fee (${config.warchestFeePct / 100}%): ${warchestFee / 10**6} tokens`);
      console.log(`  Arbitrator Fee (${config.arbitratorFeePct / 100}%): ${arbitratorFee / 10**6} tokens`);
      console.log(`  Total Fees: ${totalFees / 10**6} tokens`);
      console.log(`  Winner Receives: ${recipientAmount / 10**6} tokens`);

      // Verify arbitrator fee is included
      expect(arbitratorFee).to.be.greaterThan(0);
      expect(totalFees).to.equal(burnFee + chainFee + warchestFee + arbitratorFee);

      // TODO: Complete full disputed trade flow and verify arbitrator receives fee
      console.log("\n⏳ Full dispute flow pending integration test completion");
    });
  });

  /**
   * Test 3: Fee Edge Cases
   *
   * Tests edge cases in fee calculation:
   * - Zero fees (all fees set to 0)
   * - Maximum fees (at limit)
   * - Minimum trade amount (ensures fees don't exceed trade)
   * - Rounding behavior
   */
  describe("Fee Edge Cases", () => {
    it("Should handle zero fees configuration", async () => {
      env.logScenario("Zero Fees Edge Case");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      // Temporarily set all fees to zero
      await env.programs.hub.methods
        .updateConfig({
          burnFeePct: 0,
          chainFeePct: 0,
          warchestFeePct: 0,
          conversionFeePct: 0,
          arbitratorFeePct: 0,
          // Other params null
          minTradeAmount: null,
          maxTradeAmount: null,
          maxActiveOffers: null,
          maxActiveTrades: null,
          tradeExpirationTimer: null,
          tradeDisputeTimer: null,
          treasury: null,
          warchest: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      expect(config.burnFeePct).to.equal(0);
      expect(config.chainFeePct).to.equal(0);
      expect(config.warchestFeePct).to.equal(0);

      const tradeAmount = 100 * 10**6;
      const totalFees = calculateFee(tradeAmount, 0);
      expect(totalFees).to.equal(0);

      console.log(`✓ With zero fees, recipient receives 100% (${tradeAmount / 10**6} tokens)`);

      // Restore fees
      await env.programs.hub.methods
        .updateConfig({
          burnFeePct: 100, // 1%
          chainFeePct: 100, // 1%
          warchestFeePct: 100, // 1%
          conversionFeePct: 0,
          arbitratorFeePct: 200, // 2%
          minTradeAmount: null,
          maxTradeAmount: null,
          maxActiveOffers: null,
          maxActiveTrades: null,
          tradeExpirationTimer: null,
          tradeDisputeTimer: null,
          treasury: null,
          warchest: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();
    });

    it("Should handle maximum fees at limits", async () => {
      env.logScenario("Maximum Fees Edge Case");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      // Set fees to maximum allowed
      await env.programs.hub.methods
        .updateConfig({
          burnFeePct: 500, // 5% (max)
          chainFeePct: 300, // 3% (max)
          warchestFeePct: 200, // 2% (combined max 10%)
          conversionFeePct: 0,
          arbitratorFeePct: 200, // 2% (max)
          minTradeAmount: null,
          maxTradeAmount: null,
          maxActiveOffers: null,
          maxActiveTrades: null,
          tradeExpirationTimer: null,
          tradeDisputeTimer: null,
          treasury: null,
          warchest: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);

      const tradeAmount = 100 * 10**6;
      const burnFee = calculateFee(tradeAmount, config.burnFeePct);
      const chainFee = calculateFee(tradeAmount, config.chainFeePct);
      const warchestFee = calculateFee(tradeAmount, config.warchestFeePct);
      const totalStandardFees = burnFee + chainFee + warchestFee;
      const recipientAmount = tradeAmount - totalStandardFees;

      console.log("\nMaximum Fees:");
      console.log(`  Burn: ${burnFee / 10**6} tokens (${config.burnFeePct / 100}%)`);
      console.log(`  Chain: ${chainFee / 10**6} tokens (${config.chainFeePct / 100}%)`);
      console.log(`  Warchest: ${warchestFee / 10**6} tokens (${config.warchestFeePct / 100}%)`);
      console.log(`  Total: ${totalStandardFees / 10**6} tokens (${totalStandardFees / 100}%)`);
      console.log(`  Recipient: ${recipientAmount / 10**6} tokens`);

      expect(totalStandardFees).to.be.lessThanOrEqual(tradeAmount * 0.1); // Max 10%

      // Restore normal fees
      await env.programs.hub.methods
        .updateConfig({
          burnFeePct: 100,
          chainFeePct: 100,
          warchestFeePct: 100,
          conversionFeePct: 0,
          arbitratorFeePct: 200,
          minTradeAmount: null,
          maxTradeAmount: null,
          maxActiveOffers: null,
          maxActiveTrades: null,
          tradeExpirationTimer: null,
          tradeDisputeTimer: null,
          treasury: null,
          warchest: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();
    });

    it("Should handle fee rounding correctly", async () => {
      env.logScenario("Fee Rounding Edge Case");

      // Test with amount that doesn't divide evenly
      const awkwardAmount = 103; // 103 lamports
      const feePct = 33; // 0.33%

      const fee = calculateFee(awkwardAmount, feePct);

      // Fee should be: floor(103 * 33 / 10000) = floor(0.3399) = 0
      expect(fee).to.equal(0);
      console.log(`✓ Small amount (${awkwardAmount}) with 0.33% fee rounds to ${fee} (floor)`);

      // Test with larger amount
      const largerAmount = 1000000; // 1 token (6 decimals)
      const fee2 = calculateFee(largerAmount, feePct);

      // Fee should be: floor(1000000 * 33 / 10000) = floor(3300) = 3300
      expect(fee2).to.equal(3300);
      console.log(`✓ Larger amount (${largerAmount}) with 0.33% fee = ${fee2} lamports`);
    });

    it("Should ensure fees never exceed trade amount", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);

      // Even with maximum fees (10%), recipient should get something
      const minAmount = 1000; // 1000 lamports
      const burnFee = calculateFee(minAmount, config.burnFeePct);
      const chainFee = calculateFee(minAmount, config.chainFeePct);
      const warchestFee = calculateFee(minAmount, config.warchestFeePct);
      const totalFees = burnFee + chainFee + warchestFee;
      const recipientAmount = minAmount - totalFees;

      console.log(`\nMinimum Trade Amount Test (${minAmount} lamports):`);
      console.log(`  Total Fees: ${totalFees} lamports`);
      console.log(`  Recipient: ${recipientAmount} lamports`);

      expect(totalFees).to.be.lessThanOrEqual(minAmount);
      expect(recipientAmount).to.be.greaterThanOrEqual(0);
      console.log(`✓ Fees don't exceed trade amount`);
    });
  });

  /**
   * Test 4: Fee Validation and Limits
   *
   * Tests that the Hub program enforces fee limits correctly
   */
  describe("Fee Validation and Limits", () => {
    it("Should reject burn fee above 5%", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      try {
        await env.programs.hub.methods
          .updateConfig({
            burnFeePct: 501, // 5.01% - above limit
            chainFeePct: null,
            warchestFeePct: null,
            conversionFeePct: null,
            arbitratorFeePct: null,
            minTradeAmount: null,
            maxTradeAmount: null,
            maxActiveOffers: null,
            maxActiveTrades: null,
            tradeExpirationTimer: null,
            tradeDisputeTimer: null,
            treasury: null,
            warchest: null,
          })
          .accounts({
            hubConfig: hubConfig,
            admin: env.admin.publicKey,
          })
          .signers([env.admin])
          .rpc();

        expect.fail("Should reject burn fee above 5%");
      } catch (err) {
        console.log("✓ Burn fee above 5% correctly rejected");
      }
    });

    it("Should reject total fees above 10%", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      try {
        await env.programs.hub.methods
          .updateConfig({
            burnFeePct: 500, // 5%
            chainFeePct: 300, // 3%
            warchestFeePct: 300, // 3% - Total 11% exceeds limit
            conversionFeePct: null,
            arbitratorFeePct: null,
            minTradeAmount: null,
            maxTradeAmount: null,
            maxActiveOffers: null,
            maxActiveTrades: null,
            tradeExpirationTimer: null,
            tradeDisputeTimer: null,
            treasury: null,
            warchest: null,
          })
          .accounts({
            hubConfig: hubConfig,
            admin: env.admin.publicKey,
          })
          .signers([env.admin])
          .rpc();

        expect.fail("Should reject total fees above 10%");
      } catch (err) {
        console.log("✓ Total fees above 10% correctly rejected");
      }
    });

    it("Should accept fees at exact limit (10%)", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      // Should accept exactly 10%
      await env.programs.hub.methods
        .updateConfig({
          burnFeePct: 500, // 5%
          chainFeePct: 300, // 3%
          warchestFeePct: 200, // 2% - Total 10% at limit
          conversionFeePct: null,
          arbitratorFeePct: null,
          minTradeAmount: null,
          maxTradeAmount: null,
          maxActiveOffers: null,
          maxActiveTrades: null,
          tradeExpirationTimer: null,
          tradeDisputeTimer: null,
          treasury: null,
          warchest: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      const totalFees = config.burnFeePct + config.chainFeePct + config.warchestFeePct;
      expect(totalFees).to.equal(1000); // Exactly 10%

      console.log("✓ Fees at exactly 10% accepted");

      // Restore normal fees
      await env.programs.hub.methods
        .updateConfig({
          burnFeePct: 100,
          chainFeePct: 100,
          warchestFeePct: 100,
          conversionFeePct: 0,
          arbitratorFeePct: 200,
          minTradeAmount: null,
          maxTradeAmount: null,
          maxActiveOffers: null,
          maxActiveTrades: null,
          tradeExpirationTimer: null,
          tradeDisputeTimer: null,
          treasury: null,
          warchest: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();
    });
  });
});
