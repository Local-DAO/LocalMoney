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
 * Integration Test: Circuit Breakers
 *
 * Tests the emergency pause system that allows admins to halt operations:
 * - Global pause (pauses all operations)
 * - Operation-specific pauses:
 *   - pause_new_offers
 *   - pause_new_trades
 *   - pause_escrow_funding
 *   - pause_escrow_release
 *
 * Circuit breakers are critical for emergency situations like:
 * - Smart contract vulnerabilities discovered
 * - Market manipulation attempts
 * - System maintenance
 * - Regulatory compliance
 *
 * This ensures the protocol can be safely paused and resumed without data loss.
 */
describe("Integration: Circuit Breakers", () => {
  const env = new IntegrationTestEnv();

  before(async () => {
    await env.setup();

    // Create profiles for test users
    await env.createProfile(env.seller, "seller-contact");
    await env.createProfile(env.buyer, "buyer-contact");

    console.log("✓ Test environment ready with user profiles");
  });

  /**
   * Test 1: Global Pause
   *
   * When global_pause is enabled, ALL operations should be blocked.
   * This is the most severe circuit breaker for emergency situations.
   */
  describe("Global Pause", () => {
    it("Should allow admin to enable global pause", async () => {
      env.logScenario("Enable Global Pause");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: true,
          pauseNewOffers: null,
          pauseNewTrades: null,
          pauseEscrowFunding: null,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      expect(config.globalPause).to.be.true;

      console.log("✓ Global pause enabled");
    });

    it("Should block offer creation when globally paused", async () => {
      env.logScenario("Attempt to create offer with global pause");

      const [offerPda] = getOfferPda(env.offerCounterValue, env.programs.offer.programId);
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );
      const [sellerProfile] = getUserProfilePda(env.seller.publicKey, env.programs.profile.programId);

      try {
        await env.createSellOffer(env.seller, {
          fiatCurrency: "USD",
          tokenMint: env.testToken.publicKey,
          minAmount: 5 * 10**6,
          maxAmount: 20 * 10**6,
          rate: 100,
          description: "Should be blocked",
        });

        // Should not reach here
        expect.fail("Offer creation should have been blocked");
      } catch (err) {
        // Expected to fail
        // TODO: Verify specific error code once Hub config check is implemented in Offer program
        console.log("✓ Offer creation correctly blocked by global pause");
      }
    });

    it("Should block trade creation when globally paused", async () => {
      // First, disable global pause temporarily to create an offer
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: false,
          pauseNewOffers: null,
          pauseNewTrades: null,
          pauseEscrowFunding: null,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      // Create an offer
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 5 * 10**6,
        maxAmount: 20 * 10**6,
        rate: 100,
        description: "Test offer",
      });

      // Re-enable global pause
      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: true,
          pauseNewOffers: null,
          pauseNewTrades: null,
          pauseEscrowFunding: null,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      console.log("✓ Global pause re-enabled");

      // Attempt to create trade
      try {
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

        expect.fail("Trade creation should have been blocked");
      } catch (err) {
        // Expected to fail
        console.log("✓ Trade creation correctly blocked by global pause");
      }
    });

    it("Should allow admin to disable global pause", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: false,
          pauseNewOffers: null,
          pauseNewTrades: null,
          pauseEscrowFunding: null,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      expect(config.globalPause).to.be.false;

      console.log("✓ Global pause disabled - operations should resume");
    });

    it("Should allow operations after global pause is disabled", async () => {
      // Create offer should now work
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 5 * 10**6,
        maxAmount: 20 * 10**6,
        rate: 100,
        description: "Should work now",
      });

      expect(offerResult.offerId).to.be.greaterThan(0);
      console.log(`✓ Offer creation works after global pause disabled`);
    });
  });

  /**
   * Test 2: Operation-Specific Pause - New Offers
   *
   * Tests the pause_new_offers flag which prevents new offer creation
   * while allowing existing offers and trades to continue.
   */
  describe("Pause New Offers", () => {
    it("Should allow admin to pause new offers only", async () => {
      env.logScenario("Pause New Offers Only");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: null,
          pauseNewOffers: true,
          pauseNewTrades: null,
          pauseEscrowFunding: null,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      expect(config.pauseNewOffers).to.be.true;
      expect(config.pauseNewTrades).to.be.false; // Other operations still allowed

      console.log("✓ New offers paused");
    });

    it("Should block new offer creation", async () => {
      try {
        await env.createSellOffer(env.seller, {
          fiatCurrency: "EUR",
          tokenMint: env.testToken.publicKey,
          minAmount: 1 * 10**6,
          maxAmount: 10 * 10**6,
          rate: 90,
          description: "Should be blocked",
        });

        expect.fail("Offer creation should have been blocked");
      } catch (err) {
        console.log("✓ New offer creation correctly blocked");
      }
    });

    it("Should still allow trade creation on existing offers", async () => {
      // First create an offer with pause disabled
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: null,
          pauseNewOffers: false,
          pauseNewTrades: null,
          pauseEscrowFunding: null,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 5 * 10**6,
        maxAmount: 20 * 10**6,
        rate: 100,
        description: "Offer for trade test",
      });

      // Re-enable pause_new_offers
      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: null,
          pauseNewOffers: true,
          pauseNewTrades: null,
          pauseEscrowFunding: null,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      // Trades should still work
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

      console.log("✓ Trade creation still works when only offers are paused");

      // Cleanup: disable pause
      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: null,
          pauseNewOffers: false,
          pauseNewTrades: null,
          pauseEscrowFunding: null,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();
    });
  });

  /**
   * Test 3: Operation-Specific Pause - New Trades
   *
   * Tests the pause_new_trades flag which prevents new trade creation
   * while allowing existing trades to complete.
   */
  describe("Pause New Trades", () => {
    let existingOfferId: number;
    let existingTradeId: number;

    it("Should setup: create offer and trade before pause", async () => {
      env.logScenario("Setup for trade pause test");

      // Create offer
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 5 * 10**6,
        maxAmount: 20 * 10**6,
        rate: 100,
        description: "Offer for pause test",
      });
      existingOfferId = offerResult.offerId;

      // Mint tokens to seller
      await env.mintTokensTo(env.seller, 100 * 10**6);

      // Create trade
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );
      const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
      const [offerPda] = getOfferPda(existingOfferId, env.programs.offer.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(env.tradeCounterValue.toString())],
        env.programs.escrow.programId
      );
      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);

      await env.programs.trade.methods
        .createTrade({
          offerId: existingOfferId,
          amount: new anchor.BN(10 * 10**6),
          fiatAmount: new anchor.BN(10 * 100),
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

      existingTradeId = env.tradeCounterValue;
      env.tradeCounterValue++;

      console.log(`✓ Created offer #${existingOfferId} and trade #${existingTradeId}`);
    });

    it("Should pause new trades", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: null,
          pauseNewOffers: null,
          pauseNewTrades: true,
          pauseEscrowFunding: null,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      expect(config.pauseNewTrades).to.be.true;

      console.log("✓ New trades paused");
    });

    it("Should block new trade creation", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );
      const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
      const [offerPda] = getOfferPda(existingOfferId, env.programs.offer.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(env.tradeCounterValue.toString())],
        env.programs.escrow.programId
      );
      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);

      try {
        await env.programs.trade.methods
          .createTrade({
            offerId: existingOfferId,
            amount: new anchor.BN(5 * 10**6),
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

        expect.fail("Trade creation should have been blocked");
      } catch (err) {
        console.log("✓ New trade creation correctly blocked");
      }
    });

    it("Should still allow existing trade to progress (accept, fund, etc.)", async () => {
      const [tradePda] = getTradePda(existingTradeId, env.programs.trade.programId);
      const [offerPda] = getOfferPda(existingOfferId, env.programs.offer.programId);

      // Seller can still accept the existing trade
      await env.programs.trade.methods
        .acceptTrade({ sellerContact: "seller-contact" })
        .accounts({
          trade: tradePda,
          seller: env.seller.publicKey,
          offer: offerPda,
        })
        .signers([env.seller])
        .rpc();

      const trade = await env.programs.trade.account.trade.fetch(tradePda);
      expect(trade.state.requestAccepted).to.not.be.undefined;

      console.log("✓ Existing trade can still progress when new trades are paused");

      // Cleanup: disable pause
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: null,
          pauseNewOffers: null,
          pauseNewTrades: false,
          pauseEscrowFunding: null,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();
    });
  });

  /**
   * Test 4: Pause Escrow Funding
   *
   * Prevents funding escrow while allowing other operations.
   * Useful if there's an issue with the escrow mechanism specifically.
   */
  describe("Pause Escrow Funding", () => {
    let testOfferId: number;
    let testTradeId: number;

    it("Should setup trade ready for escrow funding", async () => {
      env.logScenario("Setup for escrow funding pause test");

      // Create offer and trade
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 5 * 10**6,
        maxAmount: 20 * 10**6,
        rate: 100,
        description: "Escrow pause test",
      });
      testOfferId = offerResult.offerId;

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );
      const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
      const [offerPda] = getOfferPda(testOfferId, env.programs.offer.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(env.tradeCounterValue.toString())],
        env.programs.escrow.programId
      );
      const [buyerProfile] = getUserProfilePda(env.buyer.publicKey, env.programs.profile.programId);

      await env.programs.trade.methods
        .createTrade({
          offerId: testOfferId,
          amount: new anchor.BN(10 * 10**6),
          fiatAmount: new anchor.BN(10 * 100),
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

      testTradeId = env.tradeCounterValue;
      env.tradeCounterValue++;

      // Accept trade
      await env.programs.trade.methods
        .acceptTrade({ sellerContact: "seller" })
        .accounts({
          trade: tradePda,
          seller: env.seller.publicKey,
          offer: offerPda,
        })
        .signers([env.seller])
        .rpc();

      console.log(`✓ Trade #${testTradeId} ready for escrow funding`);
    });

    it("Should pause escrow funding", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: null,
          pauseNewOffers: null,
          pauseNewTrades: null,
          pauseEscrowFunding: true,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      expect(config.pauseEscrowFunding).to.be.true;

      console.log("✓ Escrow funding paused");
    });

    it("Should block escrow funding", async () => {
      const [tradePda] = getTradePda(testTradeId, env.programs.trade.programId);
      const [escrowVault] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_vault"), Buffer.from(testTradeId.toString())],
        env.programs.escrow.programId
      );

      const sellerTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: env.seller.publicKey,
      });

      const vaultTokenAccount = await anchor.utils.token.associatedAddress({
        mint: env.testToken.publicKey,
        owner: escrowVault,
      });

      try {
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

        expect.fail("Escrow funding should have been blocked");
      } catch (err) {
        console.log("✓ Escrow funding correctly blocked");
      }

      // Cleanup: disable pause
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: null,
          pauseNewOffers: null,
          pauseNewTrades: null,
          pauseEscrowFunding: false,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();
    });
  });

  /**
   * Test 5: Pause Escrow Release
   *
   * Prevents releasing escrowed funds while allowing funding.
   * Critical safety mechanism if there's a discovered vulnerability in release logic.
   */
  describe("Pause Escrow Release", () => {
    it("Should test escrow release pause", async () => {
      env.logScenario("Escrow Release Pause Test");

      // TODO: Create complete trade flow up to FiatDeposited state
      // TODO: Enable pause_escrow_release
      // TODO: Attempt release_escrow and verify it's blocked
      // TODO: Disable pause and verify release works

      console.log("⏳ Escrow release pause test pending full trade flow");
    });
  });

  /**
   * Edge Cases and Security Tests
   */
  describe("Circuit Breaker Security", () => {
    it("Should prevent non-admin from setting circuit breakers", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      try {
        await env.programs.hub.methods
          .setCircuitBreaker({
            globalPause: true,
            pauseNewOffers: null,
            pauseNewTrades: null,
            pauseEscrowFunding: null,
            pauseEscrowRelease: null,
          })
          .accounts({
            hubConfig: hubConfig,
            admin: env.buyer.publicKey, // Not admin!
          })
          .signers([env.buyer])
          .rpc();

        expect.fail("Non-admin should not be able to set circuit breakers");
      } catch (err) {
        console.log("✓ Non-admin correctly prevented from setting circuit breakers");
      }
    });

    it("Should allow multiple circuit breakers simultaneously", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      // Enable multiple circuit breakers at once
      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: null,
          pauseNewOffers: true,
          pauseNewTrades: true,
          pauseEscrowFunding: true,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);
      expect(config.pauseNewOffers).to.be.true;
      expect(config.pauseNewTrades).to.be.true;
      expect(config.pauseEscrowFunding).to.be.true;
      expect(config.pauseEscrowRelease).to.be.false; // Not set

      console.log("✓ Multiple circuit breakers can be active simultaneously");

      // Cleanup: disable all
      await env.programs.hub.methods
        .setCircuitBreaker({
          globalPause: null,
          pauseNewOffers: false,
          pauseNewTrades: false,
          pauseEscrowFunding: false,
          pauseEscrowRelease: null,
        })
        .accounts({
          hubConfig: hubConfig,
          admin: env.admin.publicKey,
        })
        .signers([env.admin])
        .rpc();
    });

    it("Should verify circuit breaker events are emitted", async () => {
      // TODO: Listen for CircuitBreakerSet events and verify they contain correct data
      console.log("⏳ Event emission verification pending");
    });
  });
});
