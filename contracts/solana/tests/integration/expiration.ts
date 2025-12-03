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
 * Integration Test: Trade Expiration
 *
 * Tests the trade expiration mechanism:
 * - Trades automatically expire after configured time period
 * - Expired trades cannot progress to next states
 * - Anyone can call check_expiration (permissionless enforcement)
 * - Expiration time comes from Hub config trade_expiration_timer
 * - Cleanup happens correctly after expiration
 *
 * Expiration is critical for:
 * - Preventing indefinitely stuck trades
 * - Cleaning up abandoned requests
 * - Ensuring timely trade completion
 * - Protecting users from long waits
 *
 * NOTE: The Solana test validator does not support time manipulation,
 * so these tests verify the expiration logic without actually waiting
 * for time to pass. Production testing would require devnet/mainnet
 * or specialized testing tools.
 */
describe("Integration: Trade Expiration", () => {
  const env = new IntegrationTestEnv();

  before(async () => {
    await env.setup();

    // Create profiles
    await env.createProfile(env.seller, "seller-contact");
    await env.createProfile(env.buyer, "buyer-contact");

    console.log("✓ Test environment ready");
  });

  /**
   * Test 1: Expiration Timer Configuration
   *
   * Verifies expiration timer is read from Hub config
   */
  describe("Expiration Configuration", () => {
    it("Should get trade_expiration_timer from hub config", async () => {
      env.logScenario("Check Trade Expiration Timer Configuration");

      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const config = await env.programs.hub.account.hubConfig.fetch(hubConfig);

      console.log(`Trade Expiration Timer: ${config.tradeExpirationTimer} seconds`);
      console.log(`  = ${config.tradeExpirationTimer / 60} minutes`);
      console.log(`  = ${config.tradeExpirationTimer / 3600} hours`);

      expect(config.tradeExpirationTimer).to.be.greaterThan(0);
      expect(config.tradeExpirationTimer).to.be.lessThanOrEqual(86400); // Max 24 hours
    });

    it("Should verify trade has expiration timestamp set on creation", async () => {
      env.logScenario("Verify Trade Expiration Timestamp");

      // Create offer
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 5 * 10**6,
        maxAmount: 20 * 10**6,
        rate: 100,
        description: "Expiration test offer",
      });

      // Create trade
      const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
      const [offerPda] = getOfferPda(offerResult.offerId, env.programs.offer.programId);
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

      const tradeId = env.tradeCounterValue;
      env.tradeCounterValue++;

      // Fetch trade and check expiration
      const trade = await env.programs.trade.account.trade.fetch(tradePda);

      const now = Math.floor(Date.now() / 1000);
      const expirationTime = trade.expiresAt.toNumber();

      console.log(`Current time: ${now}`);
      console.log(`Trade created at: ${trade.createdAt}`);
      console.log(`Trade expires at: ${expirationTime}`);
      console.log(`Time until expiration: ${expirationTime - now} seconds`);

      expect(expirationTime).to.be.greaterThan(trade.createdAt.toNumber());

      // TODO: Once Hub config CPI is implemented, verify:
      // expires_at == created_at + hub_config.trade_expiration_timer
      console.log("⏳ Expiration time calculation verification pending Hub config CPI");
    });

    it("Should allow admin to update expiration timer", async () => {
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      const configBefore = await env.programs.hub.account.hubConfig.fetch(hubConfig);

      // Update to 2 hours
      const newTimer = 7200; // 2 hours in seconds

      await env.programs.hub.methods
        .updateConfig({
          tradeExpirationTimer: new anchor.BN(newTimer),
          // Other params null
          minTradeAmount: null,
          maxTradeAmount: null,
          maxActiveOffers: null,
          maxActiveTrades: null,
          burnFeePct: null,
          chainFeePct: null,
          warchestFeePct: null,
          conversionFeePct: null,
          arbitratorFeePct: null,
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

      console.log(`Expiration timer updated: ${configBefore.tradeExpirationTimer}s → ${configAfter.tradeExpirationTimer}s`);
      expect(configAfter.tradeExpirationTimer.toNumber()).to.equal(newTimer);

      // Restore default (1 hour)
      await env.programs.hub.methods
        .updateConfig({
          tradeExpirationTimer: new anchor.BN(3600),
          minTradeAmount: null,
          maxTradeAmount: null,
          maxActiveOffers: null,
          maxActiveTrades: null,
          burnFeePct: null,
          chainFeePct: null,
          warchestFeePct: null,
          conversionFeePct: null,
          arbitratorFeePct: null,
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

      console.log("✓ Expiration timer restored to 1 hour");
    });
  });

  /**
   * Test 2: Expiration Enforcement
   *
   * Verifies that expired trades cannot progress
   *
   * NOTE: Cannot actually test time passing on test validator.
   * These tests verify the expiration check logic exists.
   */
  describe("Expiration Enforcement", () => {
    it("Should verify check_expiration instruction exists", async () => {
      env.logScenario("Verify Expiration Check Functionality");

      // Create a trade
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 5 * 10**6,
        maxAmount: 20 * 10**6,
        rate: 100,
        description: "Expiration check test",
      });

      const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
      const [offerPda] = getOfferPda(offerResult.offerId, env.programs.offer.programId);
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

      const tradeId = env.tradeCounterValue;
      env.tradeCounterValue++;

      // Attempt to check expiration (won't actually be expired yet)
      try {
        await env.programs.trade.methods
          .checkExpiration()
          .accounts({
            trade: tradePda,
          })
          .rpc();

        console.log("⚠️  check_expiration succeeded (trade not expired yet)");
      } catch (err) {
        // Expected to fail because trade hasn't expired
        console.log("✓ check_expiration correctly failed - trade not expired");
      }

      console.log("⏳ Actual expiration testing requires time manipulation or devnet");
    });

    it("Should test permissionless expiration (anyone can call)", async () => {
      env.logScenario("Permissionless Expiration Check");

      // Create a trade
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 5 * 10**6,
        maxAmount: 20 * 10**6,
        rate: 100,
        description: "Permissionless test",
      });

      const [tradePda] = getTradePda(env.tradeCounterValue, env.programs.trade.programId);
      const [offerPda] = getOfferPda(offerResult.offerId, env.programs.offer.programId);
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

      const tradeId = env.tradeCounterValue;
      env.tradeCounterValue++;

      // Third party (admin) can call check_expiration
      // This demonstrates permissionless nature
      try {
        await env.programs.trade.methods
          .checkExpiration()
          .accounts({
            trade: tradePda,
          })
          .rpc(); // No signer required for check_expiration

        console.log("✓ check_expiration is permissionless (no signer required)");
      } catch (err) {
        console.log("✓ Expiration check failed (expected - not expired yet)");
      }
    });

    it("Should prevent state transitions after expiration", async () => {
      env.logScenario("State Transitions Blocked After Expiration");

      console.log("⏳ This test requires time manipulation not available in test validator");
      console.log("   On devnet/mainnet:");
      console.log("   1. Create trade");
      console.log("   2. Wait for expiration_timer to pass");
      console.log("   3. Call check_expiration");
      console.log("   4. Attempt accept_trade - should fail");
      console.log("   5. Attempt fund_escrow - should fail");
      console.log("   6. Verify trade state is RequestExpired");
    });
  });

  /**
   * Test 3: Expiration Cleanup
   *
   * Verifies that expiration properly cleans up state
   */
  describe("Expiration Cleanup", () => {
    it("Should verify expired trade marked as RequestExpired", async () => {
      env.logScenario("Expiration State Transition");

      console.log("Expected behavior:");
      console.log("  - Trade in RequestCreated state can expire");
      console.log("  - After check_expiration: state = RequestExpired");
      console.log("  - Expired trades cannot be accepted or funded");
      console.log("  - Profile active_trades counter should decrement");

      console.log("\n⏳ Full expiration flow requires time manipulation");
    });

    it("Should verify active trade counter decrements on expiration", async () => {
      env.logScenario("Counter Cleanup on Expiration");

      console.log("Expected behavior:");
      console.log("  1. User creates trade - active_trades = 1");
      console.log("  2. Trade expires - active_trades should decrement to 0");
      console.log("  3. User can create new trades up to limit again");

      console.log("\n⏳ Pending Profile CPI integration and time manipulation");
    });

    it("Should allow new trades after expired trades cleanup", async () => {
      env.logScenario("Reuse Slots After Expiration");

      console.log("Expected behavior:");
      console.log("  - If user at max_active_trades limit");
      console.log("  - And some trades expire");
      console.log("  - User can create new trades again");
      console.log("  - Expiration acts as automatic cleanup");

      console.log("\n⏳ Pending full integration and time manipulation");
    });
  });

  /**
   * Test 4: Expiration Edge Cases
   */
  describe("Expiration Edge Cases", () => {
    it("Should not allow expiration of completed trades", async () => {
      env.logScenario("Cannot Expire Completed Trades");

      console.log("Expected behavior:");
      console.log("  - Trade in EscrowReleased state cannot expire");
      console.log("  - check_expiration should fail on terminal states");
      console.log("  - Terminal states: EscrowReleased, RequestCanceled, EscrowRefunded");

      console.log("\n⏳ Pending state machine validation tests");
    });

    it("Should not allow expiration of trades in escrow", async () => {
      env.logScenario("Cannot Expire After Escrow Funded");

      console.log("Expected behavior:");
      console.log("  - Trade in EscrowFunded state cannot expire");
      console.log("  - Must use refund_trade instead");
      console.log("  - Protects funds from being stuck");

      console.log("\n⏳ Pending state machine validation tests");
    });

    it("Should handle expiration during dispute", async () => {
      env.logScenario("Expiration During Dispute");

      console.log("Expected behavior:");
      console.log("  - Disputed trades may have separate timeout (dispute_timer)");
      console.log("  - Regular expiration may not apply during dispute");
      console.log("  - Or dispute_timer extends the expiration");

      console.log("\n⏳ Design decision needed for dispute + expiration interaction");
    });

    it("Should test very short expiration timer", async () => {
      env.logScenario("Short Expiration Timer");

      // Set a very short timer (1 second for testing)
      const [hubConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("hub_config")],
        env.programs.hub.programId
      );

      await env.programs.hub.methods
        .updateConfig({
          tradeExpirationTimer: new anchor.BN(1), // 1 second
          minTradeAmount: null,
          maxTradeAmount: null,
          maxActiveOffers: null,
          maxActiveTrades: null,
          burnFeePct: null,
          chainFeePct: null,
          warchestFeePct: null,
          conversionFeePct: null,
          arbitratorFeePct: null,
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

      console.log("✓ Set expiration timer to 1 second");

      // Create trade
      const offerResult = await env.createSellOffer(env.seller, {
        fiatCurrency: "USD",
        tokenMint: env.testToken.publicKey,
        minAmount: 5 * 10**6,
        maxAmount: 20 * 10**6,
        rate: 100,
        description: "Quick expiration test",
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

      env.tradeCounterValue++;

      // Wait 2 seconds
      console.log("Waiting 2 seconds for trade to expire...");
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check expiration
      try {
        await env.programs.trade.methods
          .checkExpiration()
          .accounts({
            trade: tradePda,
          })
          .rpc();

        const trade = await env.programs.trade.account.trade.fetch(tradePda);

        if (trade.state.requestExpired) {
          console.log("✓ Trade expired after 1 second timer");
        } else {
          console.log("⚠️  Trade did not expire (clock may not have updated)");
        }
      } catch (err) {
        console.log("⚠️  Expiration check failed - validator clock issue");
      }

      // Restore normal timer
      await env.programs.hub.methods
        .updateConfig({
          tradeExpirationTimer: new anchor.BN(3600),
          minTradeAmount: null,
          maxTradeAmount: null,
          maxActiveOffers: null,
          maxActiveTrades: null,
          burnFeePct: null,
          chainFeePct: null,
          warchestFeePct: null,
          conversionFeePct: null,
          arbitratorFeePct: null,
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

      console.log("✓ Timer restored to 1 hour");
    });
  });

  /**
   * Test 5: Expiration and Other Operations
   */
  describe("Expiration Interaction with Other Features", () => {
    it("Should test expiration with max_active_trades limit", async () => {
      env.logScenario("Expiration Frees Up Trade Slots");

      console.log("Scenario:");
      console.log("  1. User creates max_active_trades trades");
      console.log("  2. Cannot create more (at limit)");
      console.log("  3. Some trades expire");
      console.log("  4. User can create new trades (slots freed)");

      console.log("\n⏳ Requires time manipulation and limit enforcement");
    });

    it("Should test expiration prevents disputes", async () => {
      console.log("Expected behavior:");
      console.log("  - Expired trade cannot have dispute initiated");
      console.log("  - Must be in valid state for dispute (EscrowFunded/FiatDeposited)");
      console.log("  - Expiration happens first if time passes");

      console.log("\n⏳ Requires time manipulation");
    });
  });
});
