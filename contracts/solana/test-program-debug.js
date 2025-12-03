const anchor = require('@coral-xyz/anchor');
const { PublicKey, Keypair } = require('@solana/web3.js');

// Patch AccountClient constructor to see what's being passed
const originalModule = require('@coral-xyz/anchor/dist/cjs/program/namespace/account.js');
const OriginalAccountClient = originalModule.default;

let callCount = 0;
class DebugAccountClient extends OriginalAccountClient {
  constructor(idl, idlAccount, programId, provider, coder) {
    callCount++;
    console.log(`\nAccountClient constructor call #${callCount}:`);
    console.log('  - idlAccount.name:', idlAccount?.name);
    console.log('  - coder exists:', !!coder);
    console.log('  - coder.accounts exists:', !!coder?.accounts);
    console.log('  - idl.accounts length:', idl?.accounts?.length);
    console.log('  - idl.types length:', idl?.types?.length);
    
    if (coder && coder.accounts) {
      console.log('  - accountLayouts size:', coder.accounts.accountLayouts?.size);
      console.log('  - accountLayouts keys:', coder.accounts.accountLayouts ? Array.from(coder.accounts.accountLayouts.keys()) : 'N/A');
    }
    
    try {
      super(idl, idlAccount, programId, provider, coder);
      console.log('  ✓ Constructor succeeded');
    } catch (e) {
      console.log('  ✗ Constructor failed:', e.message);
      throw e;
    }
  }
}

// Replace the export
originalModule.default = DebugAccountClient;

// Now try to create a Program
const hubIdl = require('./target/idl/hub.json');
const programId = new PublicKey("8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH");

const connection = new anchor.web3.Connection('http://localhost:8899', 'confirmed');
const wallet = new anchor.Wallet(Keypair.generate());
const provider = new anchor.AnchorProvider(connection, wallet, {});

console.log('Creating Program...\n');
try {
  const program = new anchor.Program(hubIdl, programId, provider);
  console.log('\n✓ Program created!');
} catch (e) {
  console.log('\n✗ Program creation failed');
}
