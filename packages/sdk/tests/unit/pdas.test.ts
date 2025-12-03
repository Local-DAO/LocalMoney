/**
 * PDA derivation tests
 */

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  getHubConfigPDA,
  getProfilePDA,
  getOfferPDA,
  getOfferCounterPDA,
  getTradePDA,
  getTradeCounterPDA,
  getEscrowVaultPDA,
  getArbitratorPDA,
  getDisputePDA,
  getPriceProviderRegistryPDA,
  getPriceProviderPDA,
  getPricePDA,
  fiatToBytes,
  bytesToFiat,
  validatePDA,
  HUB_CONFIG_SEED,
  PROFILE_SEED,
} from "../../src/pdas";

// Mock program IDs for testing
const HUB_PROGRAM_ID = new PublicKey("8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH");
const PROFILE_PROGRAM_ID = new PublicKey("86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5");
const OFFER_PROGRAM_ID = new PublicKey("CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo");
const TRADE_PROGRAM_ID = new PublicKey("5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE");
const ESCROW_PROGRAM_ID = new PublicKey("CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ");
const ARBITRATOR_PROGRAM_ID = new PublicKey("J5BNGJ128bxHuWemwaoGkDqy8DVSvsA7o5kpdy9eDoNe");
const PRICE_ORACLE_PROGRAM_ID = new PublicKey("CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw");

describe("PDA Derivation", () => {
  describe("Hub PDAs", () => {
    it("should derive hub config PDA", () => {
      const [pda, bump] = getHubConfigPDA(HUB_PROGRAM_ID);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
    });

    it("should derive consistent hub config PDA", () => {
      const [pda1] = getHubConfigPDA(HUB_PROGRAM_ID);
      const [pda2] = getHubConfigPDA(HUB_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(true);
    });
  });

  describe("Profile PDAs", () => {
    it("should derive profile PDA for user", () => {
      const user = PublicKey.unique();
      const [pda, bump] = getProfilePDA(user, PROFILE_PROGRAM_ID);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
    });

    it("should derive different PDAs for different users", () => {
      const user1 = PublicKey.unique();
      const user2 = PublicKey.unique();
      const [pda1] = getProfilePDA(user1, PROFILE_PROGRAM_ID);
      const [pda2] = getProfilePDA(user2, PROFILE_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(false);
    });
  });

  describe("Offer PDAs", () => {
    it("should derive offer PDA for ID", () => {
      const offerId = new BN(1);
      const [pda, bump] = getOfferPDA(offerId, OFFER_PROGRAM_ID);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });

    it("should derive different PDAs for different offer IDs", () => {
      const [pda1] = getOfferPDA(new BN(1), OFFER_PROGRAM_ID);
      const [pda2] = getOfferPDA(new BN(2), OFFER_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(false);
    });

    it("should derive offer counter PDA", () => {
      const [pda, bump] = getOfferCounterPDA(OFFER_PROGRAM_ID);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Trade PDAs", () => {
    it("should derive trade PDA for ID", () => {
      const tradeId = new BN(1);
      const [pda, bump] = getTradePDA(tradeId, TRADE_PROGRAM_ID);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });

    it("should derive trade counter PDA", () => {
      const [pda, bump] = getTradeCounterPDA(TRADE_PROGRAM_ID);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Escrow PDAs", () => {
    it("should derive escrow vault PDA", () => {
      const tradeId = new BN(1);
      const [pda, bump] = getEscrowVaultPDA(tradeId, ESCROW_PROGRAM_ID);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Arbitrator PDAs", () => {
    it("should derive arbitrator PDA", () => {
      const arbitrator = PublicKey.unique();
      const [pda, bump] = getArbitratorPDA(arbitrator, "USD", ARBITRATOR_PROGRAM_ID);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });

    it("should derive different PDAs for different currencies", () => {
      const arbitrator = PublicKey.unique();
      const [pda1] = getArbitratorPDA(arbitrator, "USD", ARBITRATOR_PROGRAM_ID);
      const [pda2] = getArbitratorPDA(arbitrator, "EUR", ARBITRATOR_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(false);
    });

    it("should derive dispute PDA", () => {
      const tradeId = new BN(1);
      const [pda, bump] = getDisputePDA(tradeId, ARBITRATOR_PROGRAM_ID);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Price Oracle PDAs", () => {
    it("should derive price provider registry PDA", () => {
      const [pda, bump] = getPriceProviderRegistryPDA(PRICE_ORACLE_PROGRAM_ID);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });

    it("should derive price provider PDA", () => {
      const provider = PublicKey.unique();
      const [pda, bump] = getPriceProviderPDA(provider, PRICE_ORACLE_PROGRAM_ID);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });

    it("should derive price PDA", () => {
      const [pda, bump] = getPricePDA("USD", PRICE_ORACLE_PROGRAM_ID);
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Fiat Currency Conversion", () => {
  describe("fiatToBytes", () => {
    it("should convert 3-char currency to bytes", () => {
      const bytes = fiatToBytes("USD");
      expect(bytes).toHaveLength(3);
      expect(bytes).toEqual([85, 83, 68]); // ASCII for "USD"
    });

    it("should handle lowercase", () => {
      const bytes = fiatToBytes("usd");
      expect(bytes).toEqual([85, 83, 68]); // Converted to uppercase
    });

    it("should pad short strings", () => {
      const bytes = fiatToBytes("US");
      expect(bytes).toHaveLength(3);
    });
  });

  describe("bytesToFiat", () => {
    it("should convert bytes back to currency string", () => {
      const currency = bytesToFiat([85, 83, 68]);
      expect(currency).toBe("USD");
    });

    it("should handle null bytes", () => {
      const currency = bytesToFiat([85, 83, 0]);
      expect(currency).toBe("US");
    });
  });

  describe("roundtrip", () => {
    it("should roundtrip currency codes", () => {
      const currencies = ["USD", "EUR", "GBP", "JPY", "BRL"];
      for (const currency of currencies) {
        const bytes = fiatToBytes(currency);
        const result = bytesToFiat(bytes);
        expect(result).toBe(currency);
      }
    });
  });
});

describe("PDA Validation", () => {
  it("should validate correct PDA", () => {
    const [expectedPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(HUB_CONFIG_SEED)],
      HUB_PROGRAM_ID
    );
    const isValid = validatePDA(
      expectedPDA,
      [Buffer.from(HUB_CONFIG_SEED)],
      HUB_PROGRAM_ID
    );
    expect(isValid).toBe(true);
  });

  it("should reject incorrect PDA", () => {
    const wrongPDA = PublicKey.unique();
    const isValid = validatePDA(
      wrongPDA,
      [Buffer.from(HUB_CONFIG_SEED)],
      HUB_PROGRAM_ID
    );
    expect(isValid).toBe(false);
  });
});
