import * as anchor from "@project-serum/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { PriceClient } from "../sdk/src/clients/price";
import { airdropSol, delay } from "../sdk/src/utils";
import * as fs from "fs";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

describe("price", () => {
  if (!process.env.PRICE_PROGRAM_ID) {
    throw new Error("PRICE_PROGRAM_ID not found in environment");
  }

  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const PROGRAM_ID = new PublicKey(process.env.PRICE_PROGRAM_ID);
  let priceClient: PriceClient;
  
  // Generate keypairs for our test
  const admin = Keypair.generate();
  const priceProvider = Keypair.generate();
  const priceState = Keypair.generate();

  // Load the test keypair
  const testKeypairData = JSON.parse(fs.readFileSync("../target/deploy/test-keypair.json", "utf-8"));
  const testKeypair = Keypair.fromSecretKey(new Uint8Array(testKeypairData));

  before(async () => {
    // Load the IDL directly from the file
    const idl = require("../target/idl/price.json");
    priceClient = new PriceClient(PROGRAM_ID, provider, idl);

    // Airdrop SOL to test keypair, admin and price provider
    await airdropSol(provider.connection, testKeypair.publicKey);
    await airdropSol(provider.connection, admin.publicKey);
    await airdropSol(provider.connection, priceProvider.publicKey);
    await delay(1000); // Wait for airdrop to be confirmed
  });

  it("Initializes the price oracle", async () => {
    await priceClient.initialize(priceState, admin);

    const account = await priceClient.getPriceState(priceState.publicKey);
    expect(account.isInitialized).to.be.true;
    expect(account.admin.toString()).to.equal(admin.publicKey.toString());
    expect(account.priceProvider.toString()).to.equal(admin.publicKey.toString());
    expect(account.prices).to.be.empty;
  });

  it("Updates prices with authorized provider", async () => {
    const prices = [
      {
        currency: "USD",
        usdPrice: new anchor.BN(100_000), // $1.00 with 5 decimals
        updatedAt: new anchor.BN(Math.floor(Date.now() / 1000)),
      },
      {
        currency: "EUR",
        usdPrice: new anchor.BN(120_000), // $1.20 with 5 decimals
        updatedAt: new anchor.BN(Math.floor(Date.now() / 1000)),
      },
    ];

    await priceClient.updatePrices(priceState.publicKey, admin, prices);

    const account = await priceClient.getPriceState(priceState.publicKey);
    expect(account.prices).to.have.lengthOf(2);
    expect(account.prices[0].currency).to.equal("USD");
    expect(account.prices[0].usdPrice.toNumber()).to.equal(100_000);
    expect(account.prices[1].currency).to.equal("EUR");
    expect(account.prices[1].usdPrice.toNumber()).to.equal(120_000);
  });

  it("Fails to update prices with unauthorized provider", async () => {
    const prices = [
      {
        currency: "USD",
        usdPrice: new anchor.BN(100_000),
        updatedAt: new anchor.BN(Math.floor(Date.now() / 1000)),
      },
    ];

    try {
      await priceClient.updatePrices(priceState.publicKey, priceProvider, prices);
      expect.fail("Expected error");
    } catch (err) {
      const anchorError = err as anchor.AnchorError;
      expect(anchorError.error.errorCode.code).to.equal("InvalidPriceProvider");
    }
  });

  it("Verifies price within tolerance", async () => {
    // Price in oracle is 100_000 (USD)
    // Test with 1% tolerance (100 basis points)
    const tradePrices = [
      99_000, // Just within lower bound
      100_000, // Exact match
      101_000, // Just within upper bound
    ];

    for (const price of tradePrices) {
      await priceClient.verifyPriceForTrade(
        priceState.publicKey,
        new anchor.BN(price),
        "USD",
        100 // 1% tolerance
      );
    }
  });

  it("Rejects price outside tolerance", async () => {
    // Price in oracle is 100_000 (USD)
    // Test with 1% tolerance (100 basis points)
    const tradePrices = [
      98_900, // Just below lower bound
      101_100, // Just above upper bound
    ];

    for (const price of tradePrices) {
      try {
        await priceClient.verifyPriceForTrade(
          priceState.publicKey,
          new anchor.BN(price),
          "USD",
          100 // 1% tolerance
        );
        expect.fail("Expected error");
      } catch (err) {
        const anchorError = err as anchor.AnchorError;
        expect(anchorError.error.errorCode.code).to.equal("PriceOutOfRange");
      }
    }
  });

  it("Rejects verification for non-existent currency", async () => {
    try {
      await priceClient.verifyPriceForTrade(
        priceState.publicKey,
        new anchor.BN(100_000),
        "GBP",
        100 // 1% tolerance
      );
      expect.fail("Expected error");
    } catch (err) {
      const anchorError = err as anchor.AnchorError;
      expect(anchorError.error.errorCode.code).to.equal("PriceNotFound");
    }
  });
}); 