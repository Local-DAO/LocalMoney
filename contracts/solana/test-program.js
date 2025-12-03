const anchor = require('@coral-xyz/anchor');
const { PublicKey, Keypair } = require('@solana/web3.js');

const hubIdl = require('./target/idl/hub.json');
const programId = new PublicKey("8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH");

console.log('Testing Program creation...\n');

try {
  // Create a mock provider
  const connection = new anchor.web3.Connection('http://localhost:8899', 'confirmed');
  const wallet = new anchor.Wallet(Keypair.generate());
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  
  console.log('✓ Provider created');
  console.log('✓ IDL type:', typeof hubIdl);
  console.log('✓ IDL has metadata:', !!hubIdl.metadata);
  console.log('✓ IDL address:', hubIdl.address);
  
  // Try to create Program
  console.log('\nCreating Program...');
  const program = new anchor.Program(hubIdl, programId, provider);
  
  console.log('✓ Program created successfully!');
  console.log('  - Program ID:', program.programId.toBase58());
  console.log('  - Has account namespace:', !!program.account);
  
} catch (error) {
  console.error('\n✗ ERROR:', error.message);
  console.error('\nStack:', error.stack);
}
