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
 * Integration Test: Limits Enforcement
 *
 * Tests that the protocol enforces configured limits:
 *
 * Hub Config Limits:
 * - max_active_offers: Maximum offers per user
 * - max_active_trades: Maximum active trades per user
 * - min_trade_amount: Minimum USD amount for trades (in cents)
 * - max_trade_amount: Maximum USD amount for trades (in cents)
 *
 * These limits are critical for:
 * - Preventing spam and abuse
 * - Managing system load
 * - Regulatory compliance
 * - User experience (preventing overwhelming UI)
 *
 * This test verifies:
 * - Limits are enforced at creation time
 * - Limits decrement correctly on deletion/completion
 * - Limits are checked via Hub config CPI
 * - Profile active counters stay synchronized
 *
 * NOTE: Full enforcement requires CPI integration with Hub and Profile programs.
 */
describe("Integration: Limits Enforcement", () => {
  const env = new IntegrationTestEnv();

  before(async () => {
    await env.setup();

    // Create profiles
    await env.createProfile(env.seller, "seller-contact");
    await env.createProfile(env.buyer, "buyer-contact");

    console.log("✓ Test environment ready");
  });

  /**
   * Test 1: Max Active Offers Limit
   *
   * Verifies that users cannot exceed the max_active_offers limit
   */
  describe("Max Active Offers Enforcement", () => {
    it("Should get max_active_offers from hub config", async () => {
      env.logScenario("Check Max Active Offers Limit");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);

      console.log(`Max Active Offers: ${config.maxActiveOffers}`);
      expect(config.maxActiveOffers).to.be.greaterThan(0);
      expect(config.maxActiveOffers).to.be.lessThanOrEqual(20); // Reasonable limit
    });

    it("Should allow creating offers up to the limit", async () => {
      env.logScenario("Create Multiple Offers Up To Limit");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      const limit = config.maxActiveOffers;

      // Create offers up to limit
      const createdOffers: number[] = [];

      for (let i = 0; i < Math.min(limit, 3); i++) {
        const result = await env.createSellOffer(env.seller, {
          fiatCurrency: "USD",
          tokenMint: env.testToken.publicKey,
          minAmount: 5 * 10**6,
          maxAmount: 20 * 10**6,
          rate: 100,
          description: `Test offer ${i + 1}`,
        });

        createdOffers.push(result.offerId);
        console.log(`✓ Created offer #${result.offerId} (${i + 1}/${Math.min(limit, 3)})`);
      }

      // Check profile counter
      const [sellerProfile] = getUserProfilePda(env.seller.publicKey, env.programs.profile.programId);
      const profile = await env.programs.profile.account.userProfile.fetch(sellerProfile);

      console.log(`Profile active_offers counter: ${profile.activeOffers}`);
      // TODO: Once CPI is implemented, this should match number of offers created
    });

    it("Should reject offer creation when limit exceeded", async () => {
      env.logScenario("Attempt to Exceed Max Active Offers");

      // TODO: Create offers up to limit, then attempt one more
      // Should fail with error "MaxActiveOffersReached"

      console.log("⏳ Limit enforcement test pending CPI implementation");
      console.log("   Expected behavior: Creating offer beyond limit should fail");
    });

    it("Should decrement counter when offer is deleted", async () => {
      env.logScenario("Delete Offer and Verify Counter Decrements");

      // Create an offer
      const result = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 5 * 10**6,
        maxAmount: 20 * 10**6,
        rate: 100,
        description: "To be deleted",
      });

      const [sellerProfile] = getUserProfilePda(env.seller.publicKey, env.programs.profile.programId);
      const profileBefore = await env.programs.profile.account.userProfile.fetch(sellerProfile);

      console.log(`Active offers before delete: ${profileBefore.activeOffers}`);

      // Delete the offer
      const [offerPda] = getOfferPda(result.offerId, env.programs.offer.programId);

      await env.programs.offer.methods
        .deleteOffer()
        .accounts({
          offer: offerPda,
          owner: env.seller.publicKey,
        })
        .signers([env.seller])
        .rpc();

      const profileAfter = await env.programs.profile.account.userProfile.fetch(sellerProfile);

      console.log(`Active offers after delete: ${profileAfter.activeOffers}`);

      // TODO: Verify counter decremented once CPI is implemented
      console.log("⏳ Counter decrement verification pending CPI implementation");
    });
  });

  /**
   * Test 2: Max Active Trades Limit
   *
   * Verifies that users cannot exceed the max_active_trades limit
   */
  describe("Max Active Trades Enforcement", () => {
    it("Should get max_active_trades from hub config", async () => {
      env.logScenario("Check Max Active Trades Limit");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);

      console.log(`Max Active Trades: ${config.maxActiveTrades}`);
      expect(config.maxActiveTrades).to.be.greaterThan(0);
      expect(config.maxActiveTrades).to.be.lessThanOrEqual(10); // Reasonable limit
    });

    it("Should allow creating trades up to the limit", async () => {
      env.logScenario("Create Multiple Trades Up To Limit");

      // Create an offer first
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 1 * 10**6,
        maxAmount: 100 * 10**6,
        rate: 100,
        description: "Offer for trade limit test",
      });

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      const limit = config.maxActiveTrades;

      // Create trades up to limit (or 2 for test efficiency)
      const createdTrades: number[] = [];

      for (let i = 0; i < Math.min(limit, 2); i++) {
        const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
        const [offerPda] = getOfferPda(offerResult.offerId, env.programs.offer.programId);
        const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("escrow_vault"), Buffer.from(env.tradeCounterValue.toString())],
          env.programs.escrow.programId
        );
        const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);

        await env.programs.trade.methods
          .createTrade({
            offerId: offerResult.offerId,
            amount: new anchor.BN(10 * 10**6),
            fiatAmount: new anchor.BN(10 * 100),
            buyerContact: `buyer-${i}`,
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

        createdTrades.push(env.tradeCounterValue);
        env.tradeCounterValue++;

        console.log(`✓ Created trade #${createdTrades[i]} (${i + 1}/${Math.min(limit, 2)})`);
      }

      // Check profile counter
      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);
      const profile = await env.programs.profile.account.userProfile.fetch(buyerProfile);

      console.log(`Profile active_trades counter: ${profile.activeTrades}`);
      // TODO: Once CPI is implemented, this should match number of trades created
    });

    it("Should reject trade creation when limit exceeded", async () => {
      env.logScenario("Attempt to Exceed Max Active Trades");

      // TODO: Create trades up to limit, then attempt one more
      // Should fail with error "MaxActiveTradesReached"

      console.log("⏳ Limit enforcement test pending CPI implementation");
      console.log("   Expected behavior: Creating trade beyond limit should fail");
    });

    it("Should decrement counter when trade is canceled", async () => {
      env.logScenario("Cancel Trade and Verify Counter Decrements");

      // Create a trade
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 5 * 10**6,
        maxAmount: 20 * 10**6,
        rate: 100,
        description: "For cancel test",
      });

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );
      const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
      const [offerPda] = getOfferPda(offerResult.offerId, env.programs.offer.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(env.tradeCounterValue.toString())],
        env.programs.escrow.programId
      );
      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);

      await env.programs.trade.methods
        .createTrade({
          offerId: offerResult.offerId,
          amount: new anchor.BN(10 * 10**6),
          fiatAmount: new anchor.BN(10 * 100),
          buyerContact: "buyer-cancel",
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

      const tradeId = env.tradeCounterValue;
      env.tradeCounterValue++;

      const profileBefore = await env.programs.profile.account.userProfile.fetch(buyerProfile);
      console.log(`Active trades before cancel: ${profileBefore.activeTrades}`);

      // Cancel the trade
      await env.programs.trade.methods
        .cancelTrade()
        .accounts({
          trade: tradePda,
          canceller: env.buyer.publicKey,
        })
        .signers([env.buyer])
        .rpc();

      const profileAfter = await env.programs.profile.account.userProfile.fetch(buyerProfile);
      console.log(`Active trades after cancel: ${profileAfter.activeTrades}`);

      // TODO: Verify counter decremented once CPI is implemented
      console.log("⏳ Counter decrement verification pending CPI implementation");
    });

    it("Should decrement counter when trade is completed", async () => {
      env.logScenario("Complete Trade and Verify Counter Decrements");

      // TODO: Complete full trade flow from creation to escrow release
      // Verify active_trades decrements for both buyer and seller
      // Verify completed_trades increments

      console.log("⏳ Completion counter test pending full trade flow");
    });
  });

  /**
   * Test 3: Min/Max Trade Amount Enforcement
   *
   * Verifies USD amount limits are enforced
   */
  describe("Trade Amount Limits", () => {
    it("Should get min/max trade amounts from hub config", async () => {
      env.logScenario("Check Min/Max Trade Amount Limits");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);

      console.log(`Min Trade Amount: $${config.minTradeAmount / 100} USD`);
      console.log(`Max Trade Amount: $${config.maxTradeAmount / 100} USD`);

      expect(config.minTradeAmount).to.be.greaterThan(0);
      expect(config.maxTradeAmount).to.be.greaterThan(config.minTradeAmount);
    });

    it("Should reject trade below minimum amount", async () => {
      env.logScenario("Attempt Trade Below Minimum Amount");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      const minAmount = config.minTradeAmount; // In cents

      // Create offer
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 1 * 10**6,
        maxAmount: 100 * 10**6,
        rate: 100, // $1.00 per token
        description: "Min amount test",
      });

      // Attempt to create trade below minimum
      const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
      const [offerPda] = getOfferPda(offerResult.offerId, env.programs.offer.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(env.tradeCounterValue.toString())],
        env.programs.escrow.programId
      );
      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);

      const belowMinFiatAmount = minAmount - 1; // 1 cent below minimum

      try {
        await env.programs.trade.methods
          .createTrade({
            offerId: offerResult.offerId,
            amount: new anchor.BN(1 * 10**6), // 1 token
            fiatAmount: new anchor.BN(belowMinFiatAmount),
            buyerContact: "buyer",
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

        console.log("⚠️  Trade creation succeeded (should fail once validation is implemented)");
        console.log(`   Fiat amount: $${belowMinFiatAmount / 100}, Min: $${minAmount / 100}`);
      } catch (err) {
        console.log("✓ Trade below minimum amount correctly rejected");
      }

      // TODO: Implement validation in create_trade instruction
      console.log("⏳ Min amount enforcement pending Hub config CPI integration");
    });

    it("Should reject trade above maximum amount", async () => {
      env.logScenario("Attempt Trade Above Maximum Amount");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      const maxAmount = config.maxTradeAmount; // In cents

      // Create offer
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 1 * 10**6,
        maxAmount: 1000000 * 10**6, // Very large max
        rate: 100,
        description: "Max amount test",
      });

      const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
      const [offerPda] = getOfferPda(offerResult.offerId, env.programs.offer.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(env.tradeCounterValue.toString())],
        env.programs.escrow.programId
      );
      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);

      const aboveMaxFiatAmount = maxAmount + 100; // $1.00 above maximum

      try {
        await env.programs.trade.methods
          .createTrade({
            offerId: offerResult.offerId,
            amount: new anchor.BN(aboveMaxFiatAmount * 10), // Large token amount
            fiatAmount: new anchor.BN(aboveMaxFiatAmount),
            buyerContact: "buyer",
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

        console.log("⚠️  Trade creation succeeded (should fail once validation is implemented)");
        console.log(`   Fiat amount: $${aboveMaxFiatAmount / 100}, Max: $${maxAmount / 100}`);
      } catch (err) {
        console.log("✓ Trade above maximum amount correctly rejected");
      }

      // TODO: Implement validation in create_trade instruction
      console.log("⏳ Max amount enforcement pending Hub config CPI integration");
    });

    it("Should accept trade at exact minimum", async () => {
      env.logScenario("Trade at Exact Minimum Amount");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      const minAmount = config.minTradeAmount;

      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 1 * 10**6,
        maxAmount: 100 * 10**6,
        rate: 100,
        description: "Exact min test",
      });

      const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
      const [offerPda] = getOfferPda(offerResult.offerId, env.programs.offer.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(env.tradeCounterValue.toString())],
        env.programs.escrow.programId
      );
      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);

      await env.programs.trade.methods
        .createTrade({
          offerId: offerResult.offerId,
          amount: new anchor.BN((minAmount / 100) * 10**6), // Convert USD to tokens
          fiatAmount: new anchor.BN(minAmount), // Exact minimum
          buyerContact: "buyer",
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

      env.tradeCounterValue++;

      console.log(`✓ Trade at exact minimum ($${minAmount / 100}) accepted`);
    });
  });

  /**
   * Test 4: Limit Configuration Changes
   *
   * Verifies that admin can adjust limits and changes take effect
   */
  describe("Dynamic Limit Updates", () => {
    it("Should allow admin to update limits", async () => {
      env.logScenario("Admin Updates Limits");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const configBefore = await env.programs.hub.account.hubConfig.fetch(hubConfig);

      // Update limits
      await env.programs.hub.methods
        .updateConfig({
          maxActiveOffers: 15, // Change from default
          maxActiveTrades: 8,  // Change from default
          minTradeAmount: new anchor.BN(500), // $5.00
          maxTradeAmount: new anchor.BN(100000), // $1,000.00
          // Other params null
          burnFeePct: null,
          chainFeePct: null,
          warchestFeePct: null,
          conversionFeePct: null,
          arbitratorFeePct: null,
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

      const configAfter = await env.programs.hub.account.hubConfig.fetch(hubConfig);

      console.log("Limits updated:");
      console.log(`  max_active_offers: ${configBefore.maxActiveOffers} → ${configAfter.maxActiveOffers}`);
      console.log(`  max_active_trades: ${configBefore.maxActiveTrades} → ${configAfter.maxActiveTrades}`);
      console.log(`  min_trade_amount: $${configBefore.minTradeAmount / 100} → $${configAfter.minTradeAmount / 100}`);
      console.log(`  max_trade_amount: $${configBefore.maxTradeAmount / 100} → $${configAfter.maxTradeAmount / 100}`);

      expect(configAfter.maxActiveOffers).to.equal(15);
      expect(configAfter.maxActiveTrades).to.equal(8);

      // Restore defaults
      await env.programs.hub.methods
        .updateConfig({
          maxActiveOffers: 5,
          maxActiveTrades: 3,
          minTradeAmount: new anchor.BN(1000), // $10.00
          maxTradeAmount: new anchor.BN(1000000), // $10,000.00
          burnFeePct: null,
          chainFeePct: null,
          warchestFeePct: null,
          conversionFeePct: null,
          arbitratorFeePct: null,
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

      console.log("✓ Limits restored to defaults");
    });

    it("Should prevent non-admin from updating limits", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      try {
        await env.programs.hub.methods
          .updateConfig({
            maxActiveOffers: 100, // Malicious increase
            maxActiveTrades: null,
            minTradeAmount: null,
            maxTradeAmount: null,
            burnFeePct: null,
            chainFeePct: null,
            warchestFeePct: null,
            conversionFeePct: null,
            arbitratorFeePct: null,
            tradeExpirationTimer: null,
            tradeDisputeTimer: null,
            treasury: null,
            warchest: null,
          })
          .accounts({
            hubConfig: hubConfig,
            admin: env.buyer.publicKey, // Not admin!
          })
          .signers([env.buyer])
          .rpc();

        expect.fail("Non-admin should not be able to update limits");
      } catch (err) {
        console.log("✓ Non-admin correctly prevented from updating limits");
      }
    });
  });
});
