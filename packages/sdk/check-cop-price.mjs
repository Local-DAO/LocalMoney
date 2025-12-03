import { Connection, PublicKey } from '@solana/web3.js';

function fiatToBytes(fiat) {
  const bytes = new Array(3).fill(0);
  for (let i = 0; i < Math.min(fiat.length, 3); i++) {
    bytes[i] = fiat.charCodeAt(i);
  }
  return bytes;
}

// Correct SDK program ID
const PRICE_ORACLE_PROGRAM_ID = new PublicKey('CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw');

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Check COP
  const copBytes = fiatToBytes('COP');
  const [copPricePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('price'), Buffer.from(copBytes)],
    PRICE_ORACLE_PROGRAM_ID
  );
  
  console.log('COP Price PDA:', copPricePDA.toBase58());
  
  const copAccountInfo = await connection.getAccountInfo(copPricePDA);
  if (copAccountInfo) {
    console.log('✅ COP Account exists, data length:', copAccountInfo.data.length);
    // Parse the price value (after 8-byte discriminator, bump, fiat_currency, value at offset)
    // Discriminator: 8 bytes
    // bump: 1 byte
    // fiat_currency: 3 bytes
    // value: 8 bytes (u64)
    const valueOffset = 8 + 1 + 3;
    const value = copAccountInfo.data.readBigUInt64LE(valueOffset);
    console.log('COP price value (raw):', value.toString());
  } else {
    console.log('❌ COP price account does NOT exist!');
  }
  
  // Check USD
  const usdBytes = fiatToBytes('USD');
  const [usdPricePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('price'), Buffer.from(usdBytes)],
    PRICE_ORACLE_PROGRAM_ID
  );
  
  console.log('\nUSD Price PDA:', usdPricePDA.toBase58());
  
  const usdAccountInfo = await connection.getAccountInfo(usdPricePDA);
  if (usdAccountInfo) {
    console.log('✅ USD Account exists, data length:', usdAccountInfo.data.length);
    const valueOffset = 8 + 1 + 3;
    const value = usdAccountInfo.data.readBigUInt64LE(valueOffset);
    console.log('USD price value (raw):', value.toString());
  } else {
    console.log('❌ USD price account does NOT exist!');
  }
}

main().catch(console.error);
