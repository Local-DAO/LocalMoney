import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { PriceOracle } from "../target/types/price_oracle";
import { TestUser, fiatToBytes, bytesToFiat, PROGRAM_IDS } from "./utils";
import { PublicKey } from "@solana/web3.js";

describe("Price Oracle Program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PriceOracle as Program<PriceOracle>;
  let admin: TestUser;
  let provider1: TestUser;
  let provider2: TestUser;
  let registryPDA: PublicKey;
  let registryBump: number;

  // Helper functions
  async function getRegistryPDA(): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("price_provider_registry")],
      program.programId
    );
  }

  async function getProviderPDA(providerPubkey: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("price_provider"), providerPubkey.toBuffer()],
      program.programId
    );
  }

  async function getPricePDA(fiatCurrency: string): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("price"), Buffer.from(fiatCurrency)],
      program.programId
    );
  }

  before(async () => {
    admin = new TestUser();
    provider1 = new TestUser();
    provider2 = new TestUser();

    await admin.airdrop(provider.connection);
    await provider1.airdrop(provider.connection);
    await provider2.airdrop(provider.connection);

    [registryPDA, registryBump] = await getRegistryPDA();
  });

  describe("Registry Initialization", () => {
    it("Initializes price provider registry", async () => {
      await program.methods
        .initializeRegistry({
          maxPriceStaleness: new BN(3600), // 1 hour
        })
        .accounts({
          registry: registryPDA,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin.keypair])
        .rpc();

      const registry = await program.account.priceProviderRegistry.fetch(registryPDA);
      expect(registry.admin.toBase58()).to.equal(admin.publicKey.toBase58());
      expect(registry.totalProviders.toNumber()).to.equal(0);
      expect(registry.maxPriceStaleness.toNumber()).to.equal(3600);
    });

    it("Fails to initialize registry twice", async () => {
      try {
        await program.methods
          .initializeRegistry({
            maxPriceStaleness: new BN(3600),
          })
          .accounts({
            registry: registryPDA,
            admin: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin.keypair])
          .rpc();
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe("Provider Registration", () => {
    let provider1PDA: PublicKey;
    let provider2PDA: PublicKey;

    before(async () => {
      [provider1PDA] = await getProviderPDA(provider1.publicKey);
      [provider2PDA] = await getProviderPDA(provider2.publicKey);
    });

    it("Registers a new price provider", async () => {
      await program.methods
        .registerProvider(provider1.publicKey)
        .accounts({
          registry: registryPDA,
          provider: provider1PDA,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin.keypair])
        .rpc();

      const providerAccount = await program.account.priceProvider.fetch(provider1PDA);
      expect(providerAccount.pubkey.toBase58()).to.equal(provider1.publicKey.toBase58());
      expect(providerAccount.isActive).to.be.true;
      expect(providerAccount.totalUpdates.toNumber()).to.equal(0);

      const registry = await program.account.priceProviderRegistry.fetch(registryPDA);
      expect(registry.totalProviders.toNumber()).to.equal(1);
    });

    it("Registers a second provider", async () => {
      await program.methods
        .registerProvider(provider2.publicKey)
        .accounts({
          registry: registryPDA,
          provider: provider2PDA,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin.keypair])
        .rpc();

      const registry = await program.account.priceProviderRegistry.fetch(registryPDA);
      expect(registry.totalProviders.toNumber()).to.equal(2);
    });

    it("Fails to register provider from non-admin", async () => {
      const [unauthorizedProviderPDA] = await getProviderPDA(
        anchor.web3.Keypair.generate().publicKey
      );

      try {
        await program.methods
          .registerProvider(anchor.web3.Keypair.generate().publicKey)
          .accounts({
            registry: registryPDA,
            provider: unauthorizedProviderPDA,
            admin: provider1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([provider1.keypair])
          .rpc();
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe("Price Feed Initialization", () => {
    let usdPricePDA: PublicKey;
    let eurPricePDA: PublicKey;

    before(async () => {
      [usdPricePDA] = await getPricePDA("USD");
      [eurPricePDA] = await getPricePDA("EUR");
    });

    it("Initializes USD price feed", async () => {
      const initialValue = new BN(1_500_000); // $1.50 with 6 decimals

      await program.methods
        .initializePrice(
          fiatToBytes("USD"),
          {
            initialValue,
            decimals: 6,
            minPrice: new BN(1),
            maxPrice: new BN(1_000_000_000_000),
          }
        )
        .accounts({
          registry: registryPDA,
          price: usdPricePDA,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin.keypair])
        .rpc();

      const price = await program.account.price.fetch(usdPricePDA);
      expect(bytesToFiat(price.fiatCurrency)).to.equal("USD");
      expect(price.value.toNumber()).to.equal(1_500_000);
      expect(price.decimals).to.equal(6);
      expect(price.lastProvider.toBase58()).to.equal(admin.publicKey.toBase58());
    });

    it("Initializes EUR price feed", async () => {
      const initialValue = new BN(1_600_000); // €1.60 with 6 decimals

      await program.methods
        .initializePrice(
          fiatToBytes("EUR"),
          {
            initialValue,
            decimals: 6,
            minPrice: new BN(1),
            maxPrice: new BN(1_000_000_000_000),
          }
        )
        .accounts({
          registry: registryPDA,
          price: eurPricePDA,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin.keypair])
        .rpc();

      const price = await program.account.price.fetch(eurPricePDA);
      expect(bytesToFiat(price.fiatCurrency)).to.equal("EUR");
      expect(price.value.toNumber()).to.equal(1_600_000);
    });

    it("Fails to initialize with invalid fiat code", async () => {
      const [invalidPricePDA] = await getPricePDA("us1"); // Invalid: contains digit

      try {
        await program.methods
          .initializePrice(
            fiatToBytes("us1"),
            {
              initialValue: new BN(1_000_000),
              decimals: 6,
              minPrice: new BN(1),
              maxPrice: new BN(1_000_000_000_000),
            }
          )
          .accounts({
            registry: registryPDA,
            price: invalidPricePDA,
            admin: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin.keypair])
          .rpc();
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidFiatCurrency");
      }
    });

    it("Fails to initialize with price below minimum", async () => {
      const [gbpPricePDA] = await getPricePDA("GBP");

      try {
        await program.methods
          .initializePrice(
            fiatToBytes("GBP"),
            {
              initialValue: new BN(0), // Zero price
              decimals: 6,
              minPrice: new BN(1),
              maxPrice: new BN(1_000_000_000_000),
            }
          )
          .accounts({
            registry: registryPDA,
            price: gbpPricePDA,
            admin: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin.keypair])
          .rpc();
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidPriceValue");
      }
    });
  });

  describe("Price Updates", () => {
    let usdPricePDA: PublicKey;
    let provider1PDA: PublicKey;

    before(async () => {
      [usdPricePDA] = await getPricePDA("USD");
      [provider1PDA] = await getProviderPDA(provider1.publicKey);
    });

    it("Authorized provider updates price", async () => {
      const newValue = new BN(1_550_000); // $1.55

      await program.methods
        .updatePrice({ value: newValue })
        .accounts({
          registry: registryPDA,
          provider: provider1PDA,
          price: usdPricePDA,
          providerSigner: provider1.publicKey,
        })
        .signers([provider1.keypair])
        .rpc();

      const price = await program.account.price.fetch(usdPricePDA);
      expect(price.value.toNumber()).to.equal(1_550_000);
      expect(price.lastProvider.toBase58()).to.equal(provider1.publicKey.toBase58());

      const providerAccount = await program.account.priceProvider.fetch(provider1PDA);
      expect(providerAccount.totalUpdates.toNumber()).to.equal(1);
    });

    it("Multiple updates increment counter", async () => {
      await program.methods
        .updatePrice({ value: new BN(1_560_000) })
        .accounts({
          registry: registryPDA,
          provider: provider1PDA,
          price: usdPricePDA,
          providerSigner: provider1.publicKey,
        })
        .signers([provider1.keypair])
        .rpc();

      const providerAccount = await program.account.priceProvider.fetch(provider1PDA);
      expect(providerAccount.totalUpdates.toNumber()).to.equal(2);
    });

    it("Fails when price exceeds maximum", async () => {
      try {
        await program.methods
          .updatePrice({ value: new BN(2_000_000_000_000) }) // Exceeds max
          .accounts({
            registry: registryPDA,
            provider: provider1PDA,
            price: usdPricePDA,
            providerSigner: provider1.publicKey,
          })
          .signers([provider1.keypair])
          .rpc();
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("PriceExceedsMaximum");
      }
    });

    it("Fails when unauthorized user tries to update", async () => {
      const unauthorized = new TestUser();
      await unauthorized.airdrop(provider.connection);

      const [unauthorizedProviderPDA] = await getProviderPDA(unauthorized.publicKey);

      try {
        await program.methods
          .updatePrice({ value: new BN(1_500_000) })
          .accounts({
            registry: registryPDA,
            provider: provider1PDA,
            price: usdPricePDA,
            providerSigner: unauthorized.publicKey,
          })
          .signers([unauthorized.keypair])
          .rpc();
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe("Provider Removal", () => {
    let provider2PDA: PublicKey;

    before(async () => {
      [provider2PDA] = await getProviderPDA(provider2.publicKey);
    });

    it("Admin removes a provider", async () => {
      await program.methods
        .removeProvider()
        .accounts({
          registry: registryPDA,
          provider: provider2PDA,
          admin: admin.publicKey,
        })
        .signers([admin.keypair])
        .rpc();

      const providerAccount = await program.account.priceProvider.fetch(provider2PDA);
      expect(providerAccount.isActive).to.be.false;

      const registry = await program.account.priceProviderRegistry.fetch(registryPDA);
      expect(registry.totalProviders.toNumber()).to.equal(1);
    });

    it("Removed provider cannot update prices", async () => {
      const [usdPricePDA] = await getPricePDA("USD");

      try {
        await program.methods
          .updatePrice({ value: new BN(1_500_000) })
          .accounts({
            registry: registryPDA,
            provider: provider2PDA,
            price: usdPricePDA,
            providerSigner: provider2.publicKey,
          })
          .signers([provider2.keypair])
          .rpc();
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.toString()).to.include("ProviderNotActive");
      }
    });

    it("Fails to remove provider from non-admin", async () => {
      const [provider1PDA] = await getProviderPDA(provider1.publicKey);

      try {
        await program.methods
          .removeProvider()
          .accounts({
            registry: registryPDA,
            provider: provider1PDA,
            admin: provider1.publicKey,
          })
          .signers([provider1.keypair])
          .rpc();
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe("Multiple Currencies", () => {
    const currencies = ["GBP", "JPY", "CNY", "AUD"];
    const prices = [1_800_000, 150_000_000, 10_500_000, 2_200_000];

    it("Initializes multiple currency price feeds", async () => {
      for (let i = 0; i < currencies.length; i++) {
        const [pricePDA] = await getPricePDA(currencies[i]);

        await program.methods
          .initializePrice(
            fiatToBytes(currencies[i]),
            {
              initialValue: new BN(prices[i]),
              decimals: 6,
              minPrice: new BN(1),
              maxPrice: new BN(1_000_000_000_000),
            }
          )
          .accounts({
            registry: registryPDA,
            price: pricePDA,
            admin: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin.keypair])
          .rpc();

        const price = await program.account.price.fetch(pricePDA);
        expect(bytesToFiat(price.fiatCurrency)).to.equal(currencies[i]);
        expect(price.value.toNumber()).to.equal(prices[i]);
      }
    });

    it("Queries all currency prices correctly", async () => {
      for (let i = 0; i < currencies.length; i++) {
        const [pricePDA] = await getPricePDA(currencies[i]);
        const price = await program.account.price.fetch(pricePDA);

        expect(bytesToFiat(price.fiatCurrency)).to.equal(currencies[i]);
        expect(price.value.toNumber()).to.equal(prices[i]);
        expect(price.decimals).to.equal(6);
      }
    });
  });
});
