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

// 1. Query Hub contract
console.log('1. Hub Contract:', contractAddresses.hub);
try {
  const configQuery = { config: {} };
  const config = await client.queryContractSmart(contractAddresses.hub, configQuery);
  console.log('   ✅ Hub is responding. Config loaded successfully');
} catch (error) {
  console.log('   ❌ Hub query failed:', error.message);
}

// 2. Query Offer contract
console.log('\n2. Offer Contract:', contractAddresses.offer);
try {
  const offersQuery = { offers: { limit: 1 } };
  const offers = await client.queryContractSmart(contractAddresses.offer, offersQuery);
  console.log('   ✅ Offer contract is responding. Current offers:', offers.offers.length);
} catch (error) {
  console.log('   ❌ Offer query failed:', error.message);
}

// 3. Query Trade contract
console.log('\n3. Trade Contract:', contractAddresses.trade);
try {
  const tradesQuery = { trades: { limit: 1 } };
  const trades = await client.queryContractSmart(contractAddresses.trade, tradesQuery);
  console.log('   ✅ Trade contract is responding. Current trades:', trades.trades.length);
} catch (error) {
  console.log('   ❌ Trade query failed:', error.message);
}

// 4. Query Price contract
console.log('\n4. Price Contract:', contractAddresses.price);
try {
  const priceQuery = { config: {} };
  const priceConfig = await client.queryContractSmart(contractAddresses.price, priceQuery);
  console.log('   ✅ Price contract is responding. Admin:', priceConfig.admin_addr);
} catch (error) {
  console.log('   ❌ Price query failed:', error.message);
}

// 5. Query Profile contract
console.log('\n5. Profile Contract:', contractAddresses.profile);
try {
  // Profile contract might not have a config query, try listing profiles
  const profilesQuery = { profiles: { limit: 1 } };
  const profiles = await client.queryContractSmart(contractAddresses.profile, profilesQuery);
  console.log('   ✅ Profile contract is responding. Current profiles:', profiles.profiles.length);
} catch (error) {
  console.log('   ❌ Profile query failed:', error.message);
}

console.log('\n=== Deployment Verification Complete ===');