import dotenv from 'dotenv';
dotenv.config();

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";

const client = await CosmWasmClient.connect(rpcEndpoint);

// Hub contract address
const hubAddr = process.env.HUB || 'cosmos1ars7lex2nenmxhdu8wfc0r7ux64kp4h37t4l2hxuft65qaszg27qneg6uw';

console.log('Querying hub configuration...\n');

try {
  // Query hub config
  const configQuery = { config: {} };
  const config = await client.queryContractSmart(hubAddr, configQuery);
  
  console.log('Hub Configuration:');
  console.log(JSON.stringify(config, null, 2));
} catch (error) {
  console.log('Config query failed, trying to get admin...');
  
  try {
    const adminQuery = { admin: {} };
    const admin = await client.queryContractSmart(hubAddr, adminQuery);
    console.log('Hub Admin:', admin);
  } catch (e) {
    console.log('Admin query also failed');
  }
  
  console.error('\nOriginal error:', error.message);
}