export interface Token {
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
  mintAddress?: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export const SUPPORTED_TOKENS: Token[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    icon: '/tokens/sol.png',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: '/tokens/usdc.png',
    mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
  },
];

export const SUPPORTED_CURRENCIES: Currency[] = [
  {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
  },
  {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
  },
  {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
  },
]; 