const anchor = require('@coral-xyz/anchor');
const { convertIdlToCamelCase } = require('@coral-xyz/anchor/dist/cjs/idl.js');

const hubIdl = require('./target/idl/hub.json');
const camelIdl = convertIdlToCamelCase(hubIdl);

console.log('Creating BorshCoder with camelCase IDL...');
const { BorshCoder } = anchor;
const coder = new BorshCoder(camelIdl);

console.log('✓ Coder created');
console.log('  - Has accounts:', !!coder.accounts);

if (coder.accounts) {
  console.log('\nTrying with original name "HubConfig":');
  try {
    const size1 = coder.accounts.size('HubConfig');
    console.log('  ✓ Size:', size1);
  } catch (e) {
    console.log('  ✗ Error:', e.message);
  }
  
  console.log('\nTrying with camelCase name "hubConfig":');
  try {
    const size2 = coder.accounts.size('hubConfig');
    console.log('  ✓ Size:', size2);
  } catch (e) {
    console.log('  ✗ Error:', e.message);
  }
  
  // Check what keys are in the accountLayouts map
  console.log('\nChecking internal accountLayouts...');
  console.log('  - Type of accountLayouts:', typeof coder.accounts.accountLayouts);
  if (coder.accounts.accountLayouts && coder.accounts.accountLayouts.size) {
    console.log('  - Number of entries:', coder.accounts.accountLayouts.size);
    console.log('  - Keys:', Array.from(coder.accounts.accountLayouts.keys()));
  }
}
