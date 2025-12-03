/**
 * Utility function tests
 */

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  formatTokenAmount,
  formatFiatAmount,
  formatPercentage,
  formatOraclePrice,
  toTokenLamports,
  fromTokenLamports,
  toCents,
  fromCents,
  toBasisPoints,
  fromBasisPoints,
  calculateFee,
  calculateAmountAfterFee,
  calculateTradeFees,
  shortenAddress,
  isValidPublicKey,
  parsePublicKey,
  getCurrentTimestamp,
  formatTimestamp,
  getTimeUntilExpiration,
  isPast,
  isValidContactInfo,
  isValidFiatCurrency,
  isValidOfferRange,
  isAmountInRange,
} from "../../src/utils";

describe("Number Formatting", () => {
  describe("formatTokenAmount", () => {
    it("should format token amount with default decimals", () => {
      const result = formatTokenAmount(new BN(1000000), 6);
      expect(result).toBe("1");
    });

    it("should format with proper decimal places", () => {
      const result = formatTokenAmount(new BN(1500000), 6);
      expect(result).toBe("1.5");
    });

    it("should handle large numbers", () => {
      const result = formatTokenAmount(new BN(1000000000), 6);
      expect(parseFloat(result.replace(/,/g, ""))).toBe(1000);
    });
  });

  describe("formatFiatAmount", () => {
    it("should format cents as dollars", () => {
      const result = formatFiatAmount(new BN(1000));
      expect(result).toBe("$10.00");
    });

    it("should format cents with decimals", () => {
      const result = formatFiatAmount(new BN(1050));
      expect(result).toBe("$10.50");
    });
  });

  describe("formatPercentage", () => {
    it("should format basis points as percentage", () => {
      const result = formatPercentage(150);
      expect(result).toBe("1.50%");
    });

    it("should handle 100%", () => {
      const result = formatPercentage(10000);
      expect(result).toBe("100.00%");
    });
  });

  describe("formatOraclePrice", () => {
    it("should format oracle price with 8 decimals", () => {
      const result = formatOraclePrice(new BN(100000000)); // 1.0
      expect(result).toBe("$1.00000000");
    });
  });
});

describe("Number Conversions", () => {
  describe("toTokenLamports", () => {
    it("should convert to lamports", () => {
      const result = toTokenLamports(1, 6);
      expect(result.eq(new BN(1000000))).toBe(true);
    });

    it("should handle decimal amounts", () => {
      const result = toTokenLamports(1.5, 6);
      expect(result.eq(new BN(1500000))).toBe(true);
    });

    it("should handle string input", () => {
      const result = toTokenLamports("1.5", 6);
      expect(result.eq(new BN(1500000))).toBe(true);
    });
  });

  describe("fromTokenLamports", () => {
    it("should convert from lamports", () => {
      const result = fromTokenLamports(new BN(1000000), 6);
      expect(result).toBe(1);
    });

    it("should handle decimals", () => {
      const result = fromTokenLamports(new BN(1500000), 6);
      expect(result).toBe(1.5);
    });
  });

  describe("toCents/fromCents", () => {
    it("should convert dollars to cents", () => {
      const cents = toCents(10.50);
      expect(cents.eq(new BN(1050))).toBe(true);
    });

    it("should convert cents to dollars", () => {
      const dollars = fromCents(new BN(1050));
      expect(dollars).toBe(10.5);
    });

    it("should roundtrip correctly", () => {
      const original = 123.45;
      const cents = toCents(original);
      const result = fromCents(cents);
      expect(result).toBe(original);
    });
  });

  describe("toBasisPoints/fromBasisPoints", () => {
    it("should convert percentage to basis points", () => {
      expect(toBasisPoints(1.5)).toBe(150);
      expect(toBasisPoints(100)).toBe(10000);
    });

    it("should convert basis points to percentage", () => {
      expect(fromBasisPoints(150)).toBe(1.5);
      expect(fromBasisPoints(10000)).toBe(100);
    });
  });
});

describe("Fee Calculations", () => {
  describe("calculateFee", () => {
    it("should calculate fee correctly", () => {
      const amount = new BN(10000);
      const fee = calculateFee(amount, 100); // 1%
      expect(fee.eq(new BN(100))).toBe(true);
    });

    it("should handle zero fee", () => {
      const amount = new BN(10000);
      const fee = calculateFee(amount, 0);
      expect(fee.eq(new BN(0))).toBe(true);
    });
  });

  describe("calculateAmountAfterFee", () => {
    it("should subtract fee from amount", () => {
      const amount = new BN(10000);
      const result = calculateAmountAfterFee(amount, 100); // 1%
      expect(result.eq(new BN(9900))).toBe(true);
    });
  });

  describe("calculateTradeFees", () => {
    it("should calculate all fees", () => {
      const amount = new BN(1000000);
      const fees = {
        burnFeePct: 50, // 0.5%
        chainFeePct: 25, // 0.25%
        warchestFeePct: 15, // 0.15%
        conversionFeePct: 10, // 0.1%
      };
      const result = calculateTradeFees(amount, fees);

      expect(result.burnFee.eq(new BN(5000))).toBe(true);
      expect(result.chainFee.eq(new BN(2500))).toBe(true);
      expect(result.warchestFee.eq(new BN(1500))).toBe(true);
      expect(result.conversionFee.eq(new BN(1000))).toBe(true);
      expect(result.totalFee.eq(new BN(10000))).toBe(true);
      expect(result.netAmount.eq(new BN(990000))).toBe(true);
    });
  });
});

describe("Address Utilities", () => {
  describe("shortenAddress", () => {
    it("should shorten address", () => {
      const pubkey = new PublicKey("11111111111111111111111111111111");
      const result = shortenAddress(pubkey, 4);
      expect(result).toBe("1111...1111");
    });

    it("should handle string input", () => {
      const result = shortenAddress("11111111111111111111111111111111", 4);
      expect(result).toBe("1111...1111");
    });
  });

  describe("isValidPublicKey", () => {
    it("should validate valid public key", () => {
      expect(isValidPublicKey("11111111111111111111111111111111")).toBe(true);
    });

    it("should reject invalid public key", () => {
      expect(isValidPublicKey("invalid")).toBe(false);
      expect(isValidPublicKey("")).toBe(false);
    });
  });

  describe("parsePublicKey", () => {
    it("should parse valid public key", () => {
      const result = parsePublicKey("11111111111111111111111111111111");
      expect(result).toBeInstanceOf(PublicKey);
    });

    it("should return null for invalid key", () => {
      const result = parsePublicKey("invalid");
      expect(result).toBeNull();
    });
  });
});

describe("Time Utilities", () => {
  describe("getCurrentTimestamp", () => {
    it("should return current Unix timestamp", () => {
      const ts = getCurrentTimestamp();
      const expected = Math.floor(Date.now() / 1000);
      expect(Math.abs(ts - expected)).toBeLessThan(2);
    });
  });

  describe("formatTimestamp", () => {
    it("should format timestamp as date string", () => {
      const ts = 1700000000;
      const result = formatTimestamp(ts);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("getTimeUntilExpiration", () => {
    it("should return Expired for past time", () => {
      const pastTime = getCurrentTimestamp() - 100;
      expect(getTimeUntilExpiration(pastTime)).toBe("Expired");
    });

    it("should return time remaining", () => {
      const futureTime = getCurrentTimestamp() + 3600; // 1 hour
      const result = getTimeUntilExpiration(futureTime);
      expect(result).toMatch(/\d+h \d+m/);
    });
  });

  describe("isPast", () => {
    it("should return true for past timestamp", () => {
      expect(isPast(getCurrentTimestamp() - 100)).toBe(true);
    });

    it("should return false for future timestamp", () => {
      expect(isPast(getCurrentTimestamp() + 100)).toBe(false);
    });
  });
});

describe("Validation", () => {
  describe("isValidContactInfo", () => {
    it("should accept valid contact info", () => {
      expect(isValidContactInfo("test@example.com")).toBe(true);
      expect(isValidContactInfo("a".repeat(280))).toBe(true);
    });

    it("should reject too long contact info", () => {
      expect(isValidContactInfo("a".repeat(281))).toBe(false);
    });
  });

  describe("isValidFiatCurrency", () => {
    it("should accept valid currency codes", () => {
      expect(isValidFiatCurrency("USD")).toBe(true);
      expect(isValidFiatCurrency("EUR")).toBe(true);
      expect(isValidFiatCurrency("usd")).toBe(true);
    });

    it("should reject invalid currency codes", () => {
      expect(isValidFiatCurrency("US")).toBe(false);
      expect(isValidFiatCurrency("USDT")).toBe(false);
      expect(isValidFiatCurrency("123")).toBe(false);
    });
  });

  describe("isValidOfferRange", () => {
    it("should accept valid range", () => {
      expect(isValidOfferRange(new BN(100), new BN(1000))).toBe(true);
      expect(isValidOfferRange(new BN(100), new BN(100))).toBe(true);
    });

    it("should reject invalid range", () => {
      expect(isValidOfferRange(new BN(1000), new BN(100))).toBe(false);
      expect(isValidOfferRange(new BN(0), new BN(100))).toBe(false);
    });
  });

  describe("isAmountInRange", () => {
    it("should return true for amount in range", () => {
      expect(isAmountInRange(new BN(500), new BN(100), new BN(1000))).toBe(true);
      expect(isAmountInRange(new BN(100), new BN(100), new BN(1000))).toBe(true);
      expect(isAmountInRange(new BN(1000), new BN(100), new BN(1000))).toBe(true);
    });

    it("should return false for amount out of range", () => {
      expect(isAmountInRange(new BN(50), new BN(100), new BN(1000))).toBe(false);
      expect(isAmountInRange(new BN(1500), new BN(100), new BN(1000))).toBe(false);
    });
  });
});
