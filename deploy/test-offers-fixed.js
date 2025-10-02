import dotenv from 'dotenv';
dotenv.config();

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";

const client = await CosmWasmClient.connect(rpcEndpoint);

// Offer contract address from our deployment
const offerAddr = process.env.OFFER || 'cosmos1t97gan32qpyxpepzq8kjn7n44tvk72q6emak8k3kkypx4w8knvgs48w7wr';

console.log('Testing fixed offers query...\n');
console.log('Offer Contract:', offerAddr);

// Test with correct lowercase enums
console.log('Testing OffersBy query with lowercase enums:');
try {
  const offersQuery = {
    offers_by: {
      offer_type: 'buy',  // lowercase
      fiat_currency: 'USD',
      denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
      order: 'asc',  // lowercase
      limit: 10
    }
  };
  console.log('Query:', JSON.stringify(offersQuery, null, 2));
  const response = await client.queryContractSmart(offerAddr, offersQuery);
  
  if (response.offers) {
    console.log('✅ OffersBy works! Found offers:', response.offers.length);
    if (response.offers.length > 0) {
      console.log('First offer:', response.offers[0]);
    }
  } else {
    console.log('✅ OffersBy works! Response:', response);
  }
} catch (error) {
  console.log('❌ OffersBy failed:', error.message);
}

// Also test sell offers
console.log('\nTesting sell offers:');
try {
  const sellQuery = {
    offers_by: {
      offer_type: 'sell',  // lowercase
      fiat_currency: 'USD',
      denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
      order: 'desc',  // lowercase
      limit: 10
    }
  };
  const response = await client.queryContractSmart(offerAddr, sellQuery);
  
  if (response.offers) {
    console.log('✅ Sell offers query works! Found offers:', response.offers.length);
  } else {
    console.log('✅ Sell offers query works! Response:', response);
  }
} catch (error) {
  console.log('❌ Sell offers query failed:', error.message);
}