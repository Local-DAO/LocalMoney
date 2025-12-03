import { Connection, PublicKey } from '@solana/web3.js';
import pkg from '@coral-xyz/anchor';
const { Program, AnchorProvider, BN } = pkg;
import offerIdl from './src/idl/offer.json' with { type: 'json' };

const OFFER_PROGRAM_ID = new PublicKey('FxA3RfDZN17L1RWF5xAuwW1Xfpg2F9f6oBsmAdfduNrJ');

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const provider = new AnchorProvider(connection, null, { commitment: 'confirmed' });
  const program = new Program(offerIdl, provider);
  
  console.log('Fetching all offer accounts...\n');
  
  try {
    const allOffers = await program.account.offer.all();
    console.log(`Found ${allOffers.length} offers:\n`);
    
    for (const offer of allOffers) {
      console.log('Offer PDA:', offer.publicKey.toBase58());
      console.log('  ID:', offer.account.id.toString());
      console.log('  Owner:', offer.account.owner.toBase58());
      console.log('  Min Amount:', offer.account.minAmount.toString());
      console.log('  Max Amount:', offer.account.maxAmount.toString());
      console.log('  Rate:', offer.account.rate.toString());
      console.log('  Description:', offer.account.description);
      console.log('  State:', JSON.stringify(offer.account.state));
      console.log();
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main().catch(console.error);
