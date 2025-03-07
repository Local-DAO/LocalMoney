/**
 * Truncates a Solana address for display purposes
 * @param address The full address to truncate
 * @param startChars Number of characters to show at the start
 * @param endChars Number of characters to show at the end
 * @returns The truncated address
 */
export const truncateAddress = (
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string => {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Formats a number as currency
 * @param amount The amount to format
 * @param currency The currency code (default: USD)
 * @param locale The locale to use for formatting (default: en-US)
 * @returns The formatted currency string
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Formats a date for display
 * @param date The date to format
 * @param locale The locale to use for formatting (default: en-US)
 * @returns The formatted date string
 */
export const formatDate = (
  date: Date,
  locale: string = 'en-US'
): string => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}; 