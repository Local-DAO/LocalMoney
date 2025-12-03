import dotenv from 'dotenv';
dotenv.config();

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

let lcdEndpoint = process.env.LCD || "https://cosmos-rest.publicnode.com";
let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";

// Use RPC endpoint for CosmWasmClient
const client = await CosmWasmClient.connect(rpcEndpoint);

// Hub contract address from .env
const hubAddr = process.env.HUB || 'cosmos1sl92yed0xxur0vevtd7e4fz4n9kxyp2vk9dwhh7jnlle4as9cftqua6hlz';

console.log('Querying hub configuration...\n');

try {
  // Query hub config
  const configQuery = { config: {} };
  const config = await client.queryContractSmart(hubAddr, configQuery);
  
  console.log('Hub Configuration:');
  console.log(JSON.stringify(config, null, 2));
} catch (error) {
  console.error('Error querying hub config:', error.message);
}

console.log('\n-----------------------------------\n');
console.log('Checking other contracts...\n');

// Also query the individual contracts to see their state
const contracts = {
  'Price': process.env.PRICE || 'cosmos1s5ntms0nxghv8gm4s46zhnaq2dc4j8avn6z5nxzcu7ecgswfzuwqqfw0zs',
  'Offer': process.env.OFFER || 'cosmos1h0esllwm83rvce570p7hkxea4uxdt7ges8mruh2dtu0gl9ah0srqy7cyxt',
  'Trade': process.env.TRADE || 'cosmos198n38wgqmvgx7re6sczzs8md349dw88rngy9rfzn4xwktjzqkjnqnds7qh',
  'Profile': process.env.PROFILE || 'cosmos1mktgurawlguwqhnrukf87lq5qcnt7scqwkpm3ps2lczxxz2unvus9h00qq'
};

for (const [name, addr] of Object.entries(contracts)) {
  try {
    const info = await client.getContract(addr);
    console.log(`${name} Contract (${addr}):`);
    console.log(`  Code ID: ${info.codeId}`);
    console.log(`  Creator: ${info.creator}`);
    console.log(`  Admin: ${info.admin || 'None'}`);
    console.log(`  Label: ${info.label}`);
    
    // Try to query hub address from each contract
    try {
      const hubQuery = { get_hub_addr: {} };
      const hubAddr = await client.queryContractSmart(addr, hubQuery);
      console.log(`  Registered Hub: ${hubAddr}`);
    } catch (e) {
      // Contract might not have this query
    }
    
    console.log('');
  } catch (error) {
    console.log(`Error querying ${name} contract:`, error.message);
  }
}