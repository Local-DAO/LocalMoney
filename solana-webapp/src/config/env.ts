export const config = {
  solana: {
    rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta',
    programId: process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID || '',
  },
  features: {
    enableDevnet: process.env.NEXT_PUBLIC_ENABLE_DEVNET === 'true',
    enableTestnet: process.env.NEXT_PUBLIC_ENABLE_TESTNET === 'true',
  },
  analytics: {
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    gaId: process.env.NEXT_PUBLIC_GA_ID,
  },
  api: {
    url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    key: process.env.NEXT_PUBLIC_API_KEY || '',
  },
  priceFeed: {
    url: process.env.NEXT_PUBLIC_PRICE_FEED_URL || '',
    apiKey: process.env.NEXT_PUBLIC_PRICE_FEED_API_KEY || '',
  },
} as const;

// Validate required configuration
if (!config.solana.programId) {
  throw new Error('NEXT_PUBLIC_SOLANA_PROGRAM_ID is required');
}

export function getExplorerUrl(address: string, cluster?: string): string {
  const network = cluster || config.solana.network;
  return `https://explorer.solana.com/address/${address}${
    network === 'mainnet-beta' ? '' : `?cluster=${network}`
  }`;
}

export function getTokenExplorerUrl(address: string, cluster?: string): string {
  const network = cluster || config.solana.network;
  return `https://explorer.solana.com/token/${address}${
    network === 'mainnet-beta' ? '' : `?cluster=${network}`
  }`;
}

export function getTxExplorerUrl(signature: string, cluster?: string): string {
  const network = cluster || config.solana.network;
  return `https://explorer.solana.com/tx/${signature}${
    network === 'mainnet-beta' ? '' : `?cluster=${network}`
  }`;
} 