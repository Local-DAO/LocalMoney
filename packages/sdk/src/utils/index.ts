/**
 * Utility functions for the LocalMoney SDK
 */

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { BASIS_POINTS, USD_CENTS_DECIMALS, PRICE_DECIMALS } from "../constants";

// ============================================================
// Number Formatting
// ============================================================

/**
 * Format token amount for display
 *
 * @param amount - Amount in lamports
 * @param decimals - Token decimals (default 6)
 * @param maxDecimals - Maximum display decimals (default = decimals)
 * @returns Formatted string
 */
export function formatTokenAmount(
  amount: BN | number | string,
  decimals: number = 6,
  maxDecimals?: number
): string {
  const value = typeof amount === "string" ? new BN(amount) : amount;
  const numValue =
    value instanceof BN ? value.toNumber() : (value as number);
  const divisor = Math.pow(10, decimals);
  const result = numValue / divisor;

  const displayDecimals = maxDecimals ?? decimals;
  return result.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimals,
  });
}

/**
 * Format fiat amount (cents to dollars)
 *
 * @param amountCents - Amount in cents
 * @param currency - Currency code for symbol (default USD)
 * @returns Formatted string with currency symbol
 */
export function formatFiatAmount(
  amountCents: BN | number | string,
  currency: string = "USD"
): string {
  const value = typeof amountCents === "string" ? new BN(amountCents) : amountCents;
  const numValue =
    value instanceof BN ? value.toNumber() : (value as number);
  const dollars = numValue / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format percentage from basis points
 *
 * @param basisPoints - Amount in basis points (100 = 1%)
 * @returns Formatted percentage string
 */
export function formatPercentage(basisPoints: number): string {
  const percentage = basisPoints / 100;
  return `${percentage.toFixed(2)}%`;
}

/**
 * Format price from oracle format (8 decimals)
 *
 * @param price - Price with 8 decimals
 * @returns Formatted dollar string
 */
export function formatOraclePrice(price: BN | number): string {
  const numValue = price instanceof BN ? price.toNumber() : price;
  const dollars = numValue / Math.pow(10, PRICE_DECIMALS);
  return `$${dollars.toFixed(8)}`;
}

// ============================================================
// Number Conversions
// ============================================================

/**
 * Convert token amount to lamports
 *
 * @param amount - Human-readable amount
 * @param decimals - Token decimals
 * @returns BN in lamports
 */
export function toTokenLamports(amount: number | string, decimals: number = 6): BN {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const multiplier = Math.pow(10, decimals);
  return new BN(Math.floor(num * multiplier));
}

/**
 * Convert lamports to token amount
 *
 * @param lamports - Amount in lamports
 * @param decimals - Token decimals
 * @returns Human-readable number
 */
export function fromTokenLamports(lamports: BN | number, decimals: number = 6): number {
  const numValue = lamports instanceof BN ? lamports.toNumber() : lamports;
  return numValue / Math.pow(10, decimals);
}

/**
 * Convert dollars to cents
 *
 * @param dollars - Dollar amount
 * @returns BN in cents
 */
export function toCents(dollars: number | string): BN {
  const num = typeof dollars === "string" ? parseFloat(dollars) : dollars;
  return new BN(Math.floor(num * 100));
}

/**
 * Convert cents to dollars
 *
 * @param cents - Amount in cents
 * @returns Dollar amount
 */
export function fromCents(cents: BN | number): number {
  const numValue = cents instanceof BN ? cents.toNumber() : cents;
  return numValue / 100;
}

/**
 * Convert percentage to basis points
 *
 * @param percentage - Percentage (e.g., 1.5 for 1.5%)
 * @returns Basis points
 */
export function toBasisPoints(percentage: number): number {
  return Math.floor(percentage * 100);
}

/**
 * Convert basis points to percentage
 *
 * @param basisPoints - Basis points
 * @returns Percentage
 */
export function fromBasisPoints(basisPoints: number): number {
  return basisPoints / 100;
}

// ============================================================
// Fee Calculations
// ============================================================

/**
 * Calculate fee amount from basis points
 *
 * @param amount - Principal amount
 * @param feeBasisPoints - Fee in basis points
 * @returns Fee amount
 */
export function calculateFee(amount: BN, feeBasisPoints: number): BN {
  return amount.mul(new BN(feeBasisPoints)).div(new BN(BASIS_POINTS));
}

/**
 * Calculate amount after fee deduction
 *
 * @param amount - Original amount
 * @param feeBasisPoints - Fee in basis points
 * @returns Amount after fee
 */
export function calculateAmountAfterFee(amount: BN, feeBasisPoints: number): BN {
  const fee = calculateFee(amount, feeBasisPoints);
  return amount.sub(fee);
}

/**
 * Calculate all fees for a trade
 *
 * @param amount - Trade amount
 * @param fees - Fee configuration from hub
 * @returns Breakdown of all fees
 */
export function calculateTradeFees(
  amount: BN,
  fees: {
    burnFeePct: number;
    chainFeePct: number;
    warchestFeePct: number;
    conversionFeePct: number;
  }
): {
  burnFee: BN;
  chainFee: BN;
  warchestFee: BN;
  conversionFee: BN;
  totalFee: BN;
  netAmount: BN;
} {
  const burnFee = calculateFee(amount, fees.burnFeePct);
  const chainFee = calculateFee(amount, fees.chainFeePct);
  const warchestFee = calculateFee(amount, fees.warchestFeePct);
  const conversionFee = calculateFee(amount, fees.conversionFeePct);
  const totalFee = burnFee.add(chainFee).add(warchestFee).add(conversionFee);
  const netAmount = amount.sub(totalFee);

  return {
    burnFee,
    chainFee,
    warchestFee,
    conversionFee,
    totalFee,
    netAmount,
  };
}

// ============================================================
// Address Utilities
// ============================================================

/**
 * Shorten a public key for display
 *
 * @param pubkey - Public key
 * @param chars - Characters to show on each side (default 4)
 * @returns Shortened string like "Abc1...xyz4"
 */
export function shortenAddress(pubkey: PublicKey | string, chars: number = 4): string {
  const address = typeof pubkey === "string" ? pubkey : pubkey.toBase58();
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Check if a string is a valid Solana public key
 *
 * @param address - String to check
 * @returns true if valid
 */
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe parse public key
 *
 * @param address - String to parse
 * @returns PublicKey or null
 */
export function parsePublicKey(address: string): PublicKey | null {
  try {
    return new PublicKey(address);
  } catch {
    return null;
  }
}

// ============================================================
// Time Utilities
// ============================================================

/**
 * Get current Unix timestamp
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Format a Unix timestamp for display
 *
 * @param timestamp - Unix timestamp in seconds
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatTimestamp(
  timestamp: BN | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const numValue = timestamp instanceof BN ? timestamp.toNumber() : timestamp;
  const date = new Date(numValue * 1000);
  return date.toLocaleString(
    "en-US",
    options || {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

/**
 * Get time until expiration
 *
 * @param expiresAt - Expiration timestamp
 * @returns Human-readable time remaining or "Expired"
 */
export function getTimeUntilExpiration(expiresAt: BN | number): string {
  const numValue = expiresAt instanceof BN ? expiresAt.toNumber() : expiresAt;
  const now = getCurrentTimestamp();
  const diff = numValue - now;

  if (diff <= 0) {
    return "Expired";
  }

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

/**
 * Check if a timestamp has passed
 *
 * @param timestamp - Unix timestamp to check
 * @returns true if timestamp is in the past
 */
export function isPast(timestamp: BN | number): boolean {
  const numValue = timestamp instanceof BN ? timestamp.toNumber() : timestamp;
  return numValue < getCurrentTimestamp();
}

// ============================================================
// Validation
// ============================================================

/**
 * Validate contact info length
 *
 * @param contactInfo - Contact string to validate
 * @param maxLength - Maximum allowed length (default 280)
 * @returns true if valid
 */
export function isValidContactInfo(
  contactInfo: string,
  maxLength: number = 280
): boolean {
  return contactInfo.length <= maxLength;
}

/**
 * Validate fiat currency code
 *
 * @param currency - Currency code to validate
 * @returns true if valid ISO 4217 format
 */
export function isValidFiatCurrency(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency.toUpperCase());
}

/**
 * Validate offer amounts
 *
 * @param minAmount - Minimum amount
 * @param maxAmount - Maximum amount
 * @returns true if min <= max and both > 0
 */
export function isValidOfferRange(minAmount: BN, maxAmount: BN): boolean {
  return minAmount.gt(new BN(0)) && maxAmount.gte(minAmount);
}

/**
 * Validate trade amount against offer range
 *
 * @param amount - Trade amount
 * @param minAmount - Offer minimum
 * @param maxAmount - Offer maximum
 * @returns true if amount is within range
 */
export function isAmountInRange(amount: BN, minAmount: BN, maxAmount: BN): boolean {
  return amount.gte(minAmount) && amount.lte(maxAmount);
}

// ============================================================
// Sleep/Wait Utilities
// ============================================================

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 *
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum wait time in ms (default 30000)
 * @param interval - Check interval in ms (default 1000)
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 30000,
  interval: number = 1000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await sleep(interval);
  }

  return false;
}
