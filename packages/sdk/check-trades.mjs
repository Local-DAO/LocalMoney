import { LocalMoneySDK, getSolanaConfig } from './dist/index.mjs';
import { Connection, Keypair } from '@solana/web3.js';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const config = getSolanaConfig('devnet');
  const dummyWallet = { publicKey: Keypair.generate().publicKey, signTransaction: async (t) => t, signAllTransactions: async (t) => t };
  
  const sdk = new LocalMoneySDK(connection, dummyWallet, config);
  
  // Get all offers
  const offers = await sdk.offer.getActiveOffers();
  console.log('Active offers:', offers.length);
  for (const offer of offers) {
    console.log('- Offer ID:', offer.id.toString(), 'Owner:', offer.owner.toBase58().slice(0, 8), 'TokenMint:', offer.tokenMint.toBase58());
  }
  
  // Get all trades
  const trades = await sdk.trade.getActiveTrades();
  console.log('\nActive trades:', trades.length);
  for (const trade of trades) {
    console.log('- Trade ID:', trade.id.toString(), 'State:', Object.keys(trade.state)[0], 'TokenMint:', trade.tokenMint.toBase58());
  }
}

main().catch(console.error);
