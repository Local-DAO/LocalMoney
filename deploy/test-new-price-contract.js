import dotenv from 'dotenv';
dotenv.config();

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";

const client = await CosmWasmClient.connect(rpcEndpoint);

// New Price contract address
const priceAddr = process.env.PRICE;

console.log('Testing new Price contract:', priceAddr);
console.log('');

// Test querying some fiat prices using correct format
const currencies = ['USD', 'EUR', 'BRL', 'ARS'];

for (const currency of currencies) {
  try {
    const priceQuery = { 
      get_fiat_price: { 
        currency: currency
      } 
    };
    const price = await client.queryContractSmart(priceAddr, priceQuery);
    console.log(`${currency} price:`, price);
  } catch (error) {
    console.log(`${currency} price error:`, error.message);
  }
}

console.log('\n--- Testing Price Query for ATOM/USD ---');
try {
  const priceQuery = { 
    price: { 
      fiat: "USD",
      denom: { native: "uatom" }
    } 
  };
  const price = await client.queryContractSmart(priceAddr, priceQuery);
  console.log('ATOM/USD price:', price);
} catch (error) {
  console.log('ATOM/USD price error:', error.message);
}