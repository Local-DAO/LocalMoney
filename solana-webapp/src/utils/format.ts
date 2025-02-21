export function formatAddress(address: string, length = 8): string {
  if (!address) return '';
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

export function formatAmount(amount: number | string, decimals = 9): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return (num / Math.pow(10, decimals)).toFixed(decimals);
}

export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleDateString();
}

export function timeSince(date: Date | string | number): string {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return `${Math.floor(interval)}y ago`;

  interval = seconds / 2592000;
  if (interval > 1) return `${Math.floor(interval)}m ago`;

  interval = seconds / 86400;
  if (interval > 1) return `${Math.floor(interval)}d ago`;

  interval = seconds / 3600;
  if (interval > 1) return `${Math.floor(interval)}h ago`;

  interval = seconds / 60;
  if (interval > 1) return `${Math.floor(interval)}m ago`;

  return `${Math.floor(seconds)}s ago`;
} 