import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import priceOracleIdl from './src/idl/price_oracle.json' with { type: 'json' };

function fiatToBytes(fiat) {
  const bytes = new Array(3).fill(0);
  for (let i = 0; i < Math.min(fiat.length, 3); i++) {
    bytes[i] = fiat.charCodeAt(i);
  }
  return bytes;
}

const PRICE_ORACLE_PROGRAM_ID = new PublicKey('CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw');

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  const provider = new anchor.AnchorProvider(connection, null, { commitment: 'confirmed' });
  const program = new anchor.Program(priceOracleIdl, provider);
  
  // Check COP
  const copBytes = fiatToBytes('COP');
  const [copPricePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('price'), Buffer.from(copBytes)],
    PRICE_ORACLE_PROGRAM_ID
  );
  
  console.log('COP Price PDA:', copPricePDA.toBase58());
  
  try {
    const priceAccount = await program.account.price.fetch(copPricePDA);
    console.log('COP Price Account:', priceAccount);
    console.log('Value:', priceAccount.value.toString());
  } catch (e) {
    console.error('Error fetching COP price:', e.message);
  }
}

main().catch(console.error);
