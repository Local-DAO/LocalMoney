# LocalMoney Solana WebApp

A Next.js frontend for LocalMoney Solana programs integrated with Phantom wallet.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

- Solana wallet integration using Phantom
- Connection to LocalMoney Solana programs
- Profile management
- Trade functionality
- Offer creation and management
- Price discovery

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Solana CLI (for local development)
- Phantom wallet extension installed in your browser

## Environment Setup

Create a `.env.local` file with the following:

```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=http://localhost:8899
```

## Learn More

- [Solana Documentation](https://docs.solana.com/)
- [Phantom Wallet](https://phantom.app/)
- [Next.js Documentation](https://nextjs.org/docs)
