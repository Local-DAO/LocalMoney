import { isAddress as isEVMAddress } from 'ethers'
import { fromBech32 } from '@cosmjs/encoding'
import { Decimal } from '@cosmjs/math'

/**
 * Validates an EVM (BSC) address using ethers.js
 */
export function isBSCAddress(address: string): boolean {
  return isEVMAddress(address)
}

/**
 * Validates a Kujira address (bech32 format with checksum verification)
 * Uses @cosmjs/encoding to verify bech32 checksum and prevent fund loss
 */
export function isKujiraAddress(address: string): boolean {
  try {
    const { prefix, data } = fromBech32(address)
    return prefix === 'kujira' && data.length === 20
  } catch {
    return false
  }
}

/**
 * Validates an amount (string or number)
 * Returns true if amount is a positive number greater than 0
 */
export function isValidAmount(amount: string | number | undefined | null): boolean {
  if (amount === undefined || amount === null) return false

  // Handle both string and number types
  const str = typeof amount === 'number' ? amount.toString() : amount
  if (typeof str !== 'string' || str.trim() === '') return false

  const num = parseFloat(str)
  return !isNaN(num) && num > 0 && isFinite(num)
}

/**
 * Formats amount for display (6 decimal places for KUJI)
 * Uses Decimal for precision to avoid floating point errors
 */
export function formatAmount(amount: string, decimals: number = 6): string {
  try {
    const decimal = Decimal.fromUserInput(amount, decimals)
    return Decimal.fromAtomics(decimal.atomics, decimals).toString()
  } catch {
    return '0'
  }
}

/**
 * Converts display amount to minimal denom (multiply by 10^decimals)
 * Uses Decimal from @cosmjs/math to prevent precision loss in financial calculations
 */
export function toMinimalDenom(amount: string, decimals: number = 6): string {
  try {
    const decimal = Decimal.fromUserInput(amount, decimals)
    return decimal.atomics
  } catch {
    return '0'
  }
}

/**
 * Converts minimal denom to display amount (divide by 10^decimals)
 * Uses Decimal from @cosmjs/math to prevent precision loss in financial calculations
 */
export function fromMinimalDenom(amount: string, decimals: number = 6): string {
  try {
    return Decimal.fromAtomics(amount, decimals).toString()
  } catch {
    return '0'
  }
}
