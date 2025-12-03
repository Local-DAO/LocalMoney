import dotenv from 'dotenv';
dotenv.config();

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";

const client = await CosmWasmClient.connect(rpcEndpoint);

// Offer contract address from our deployment
const offerAddr = process.env.OFFER || 'cosmos1t97gan32qpyxpepzq8kjn7n44tvk72q6emak8k3kkypx4w8knvgs48w7wr';

console.log('Testing final offers query format...\n');
console.log('Offer Contract:', offerAddr);

// Test with correct format: lowercase offer_type, unchanged order
console.log('Testing OffersBy query with correct format:');
try {
  const offersQuery = {
    offers_by: {
      offer_type: 'buy',  // lowercase
      fiat_currency: 'USD',
      denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
      order: 'trades_count',  // as-is
      limit: 10
    }
  };
  console.log('Query:', JSON.stringify(offersQuery, null, 2));
  const response = await client.queryContractSmart(offerAddr, offersQuery);
  
  console.log('✅ OffersBy works!');
  if (response.offers) {
    console.log('  Found offers:', response.offers.length);
    if (response.offers.length > 0) {
      console.log('  First offer ID:', response.offers[0].offer.id);
      console.log('  First offer type:', response.offers[0].offer.offer_type);
    }
  } else if (Array.isArray(response)) {
    console.log('  Found offers (as array):', response.length);
    if (response.length > 0) {
      console.log('  First offer ID:', response[0].offer.id);
      console.log('  First offer type:', response[0].offer.offer_type);
    }
  } else {
    console.log('  Response:', response);
  }
} catch (error) {
  console.log('❌ OffersBy failed:', error.message);
}

// Also test with price_rate order
console.log('\nTesting with price_rate order:');
try {
  const priceQuery = {
    offers_by: {
      offer_type: 'sell',  // lowercase
      fiat_currency: 'USD',
      denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
      order: 'price_rate',  // as-is
      limit: 10
    }
  };
  const response = await client.queryContractSmart(offerAddr, priceQuery);
  
  console.log('✅ Price rate query works!');
  if (response.offers) {
    console.log('  Found offers:', response.offers.length);
  } else if (Array.isArray(response)) {
    console.log('  Found offers (as array):', response.length);
  }
} catch (error) {
  console.log('❌ Price rate query failed:', error.message);
}