import dotenv from 'dotenv';
dotenv.config();

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";

const client = await CosmWasmClient.connect(rpcEndpoint);

// Hub contract address from our deployment
const hubAddr = 'cosmos1zcsqlzeqwu82pu38d29glfkse5kefhfcvchxy5z4gegqw0dj3clqnlzlvz';

console.log('Testing hub configuration query...\n');

try {
  // Query hub config
  const configQuery = { config: {} };
  const config = await client.queryContractSmart(hubAddr, configQuery);
  
  console.log('✅ Hub Configuration loaded successfully:');
  console.log(JSON.stringify(config, null, 2));
} catch (error) {
  console.log('❌ Config query failed:', error.message);
  
  // Try raw query to see what's in storage
  try {
    console.log('\nTrying to get contract info...');
    const contractInfo = await client.getContract(hubAddr);
    console.log('Contract info:', contractInfo);
  } catch (e) {
    console.log('Contract info query also failed');
  }
}