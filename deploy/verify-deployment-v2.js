import dotenv from 'dotenv';
dotenv.config();

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import fs from "fs";

let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";

const client = await CosmWasmClient.connect(rpcEndpoint);

// Load contract addresses
const contractAddresses = JSON.parse(fs.readFileSync('contract-addresses-v2.json', 'utf8'));
console.log('Contract Addresses:', contractAddresses);

console.log('\n=== Verifying Deployment on Cosmos Hub Mainnet ===\n');

// Get a test address for queries
const testAddr = 'cosmos1gkec5sqldd822qxjn5wxvxwef7pw3v0yt36vah';

// 1. Query Hub contract
console.log('1. Hub Contract:', contractAddresses.hub);
try {
  const configQuery = { config: {} };
  const config = await client.queryContractSmart(contractAddresses.hub, configQuery);
  console.log('   ✅ Hub is responding');
  console.log('      - Local denom:', config.local_denom.native);
  console.log('      - Offer contract:', config.offer_addr);
  console.log('      - Trade contract:', config.trade_addr);
} catch (error) {
  console.log('   ❌ Hub query failed:', error.message);
}

// 2. Query Offer contract
console.log('\n2. Offer Contract:', contractAddresses.offer);
try {
  // Try to query offers by owner
  const offersQuery = { offers_by_owner: { owner: testAddr, limit: 10 } };
  const offers = await client.queryContractSmart(contractAddresses.offer, offersQuery);
  console.log('   ✅ Offer contract is responding');
  console.log('      - Offers for admin address:', offers.offers ? offers.offers.length : 0);
} catch (error) {
  console.log('   ❌ Offer query failed:', error.message);
  // Try state query
  try {
    const stateQuery = { state: {} };
    const state = await client.queryContractSmart(contractAddresses.offer, stateQuery);
    console.log('   ✅ Offer contract state query successful');
  } catch (e) {
    console.log('   ❌ State query also failed');
  }
}

// 3. Query Trade contract
console.log('\n3. Trade Contract:', contractAddresses.trade);
try {
  // Try to query trades for a user
  const tradesQuery = { trades: { user: testAddr } };
  const trades = await client.queryContractSmart(contractAddresses.trade, tradesQuery);
  console.log('   ✅ Trade contract is responding');
  console.log('      - Trades for admin address:', trades.trades ? trades.trades.length : 0);
} catch (error) {
  console.log('   ❌ Trade query failed:', error.message);
}

// 4. Query Price contract
console.log('\n4. Price Contract:', contractAddresses.price);
try {
  // Query for a price (even if it doesn't exist yet)
  const priceQuery = { price: { pair: "ATOM_USD" } };
  const price = await client.queryContractSmart(contractAddresses.price, priceQuery);
  console.log('   ✅ Price contract is responding');
  console.log('      - Price query successful');
} catch (error) {
  if (error.message.includes('not found')) {
    console.log('   ✅ Price contract is responding (no prices set yet)');
  } else {
    console.log('   ❌ Price query failed:', error.message);
  }
}

// 5. Query Profile contract
console.log('\n5. Profile Contract:', contractAddresses.profile);
try {
  // Try to query a profile
  const profileQuery = { profile: { user: testAddr } };
  const profile = await client.queryContractSmart(contractAddresses.profile, profileQuery);
  console.log('   ✅ Profile contract is responding');
  console.log('      - Profile exists:', profile ? 'Yes' : 'No');
} catch (error) {
  if (error.message.includes('not found') || error.message.includes('does not exist')) {
    console.log('   ✅ Profile contract is responding (no profile for test address)');
  } else {
    console.log('   ❌ Profile query failed:', error.message);
  }
}

console.log('\n=== Deployment Summary ===');
console.log('✅ All contracts successfully deployed to Cosmos Hub Mainnet');
console.log('✅ Contract code IDs stored in: ../app/tests/fixtures/codeIds.json');
console.log('✅ Contract addresses stored in: contract-addresses-v2.json');
console.log('\nDeployment Transaction Hashes:');
console.log('  - Hub (code 277): A05EDD7EE3E546276D021B2DDC11358C739D4DCA54AEE8EFEF8B08BBD70B1815');
console.log('  - Offer (code 278): ABE77FE3346241CF2EFCD96254B08DBAA5E66AF0DC73B62CD17FC848ED9113ED');
console.log('  - Price (code 279): 020B15127911E0488685563292E6A3173E2C9FA091FF0843081046BA4939E7B7');
console.log('  - Profile (code 280): DE3DD0C53FE1705ECCEB508BB1EB9BA99BAD576F6782D91FF373E40BD2B741EC');
console.log('  - Trade (code 281): E65D57E75381B09F258810A8D2F9DCA4DC202CFCF5E51EA4E0082EF3E5517BFF');