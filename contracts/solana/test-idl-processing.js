const { convertIdlToCamelCase } = require('@coral-xyz/anchor/dist/cjs/idl.js');

const hubIdl = require('./target/idl/hub.json');

console.log('Original IDL:');
console.log('  - accounts:', hubIdl.accounts?.length);
console.log('  - types:', hubIdl.types?.length);
console.log('  - first account name:', hubIdl.accounts?.[0]?.name);

const camelIdl = convertIdlToCamelCase(hubIdl);

console.log('\nCamel-cased IDL:');
console.log('  - accounts:', camelIdl.accounts?.length);
console.log('  - types:', camelIdl.types?.length);
console.log('  - first account name:', camelIdl.accounts?.[0]?.name);

console.log('\nTypes preserved?', camelIdl.types === hubIdl.types);
console.log('Accounts preserved?', camelIdl.accounts === hubIdl.accounts);

console.log('\nFirst type in original:', hubIdl.types?.[0]?.name);
console.log('First type in camel:', camelIdl.types?.[0]?.name);
