/**
 * Utility functions for address handling
 */

/**
 * Compare two addresses in a case-insensitive manner
 * Handles null/undefined values safely
 * @param addr1 - First address to compare
 * @param addr2 - Second address to compare
 * @returns true if addresses are equal (case-insensitive), false otherwise
 */
export function addressesEqual(addr1: string | null | undefined, addr2: string | null | undefined): boolean {
  // Handle null/undefined cases
  if (!addr1 || !addr2) {
    return addr1 === addr2
  }
  
  // Compare addresses in lowercase for case-insensitive comparison
  return addr1.toLowerCase() === addr2.toLowerCase()
}

/**
 * Normalize an address to lowercase
 * @param address - Address to normalize
 * @returns Normalized address or empty string if null/undefined
 */
export function normalizeAddress(address: string | null | undefined): string {
  return address?.toLowerCase() || ''
}