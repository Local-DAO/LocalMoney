const path = require('path');
const anchor = require('@coral-xyz/anchor');

// Test loading IDL
const idlPath = path.join(process.cwd(), 'target/idl/hub.json');
console.log('Loading IDL from:', idlPath);

const hubIdl = require(idlPath);
console.log('✓ IDL loaded');
console.log('  - Has accounts:', hubIdl.accounts.length);
console.log('  - Has types:', hubIdl.types.length);

// Try to create a BorshCoder
const { BorshCoder } = anchor;
console.log('\nCreating BorshCoder...');
try {
  const coder = new BorshCoder(hubIdl);
  console.log('✓ BorshCoder created');
  console.log('  - Has accounts property:', !!coder.accounts);
  console.log('  - Accounts type:', typeof coder.accounts);
  
  if (coder.accounts) {
    console.log('\n✓ Trying accounts.size()...');
    const size = coder.accounts.size('HubConfig');
    console.log('  - HubConfig size:', size, 'bytes');
  }
} catch (error) {
  console.error('\n✗ ERROR:', error.message);
}
