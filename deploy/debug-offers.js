import dotenv from 'dotenv';
dotenv.config();

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";

const client = await CosmWasmClient.connect(rpcEndpoint);

const offerAddr = process.env.OFFER || 'cosmos1t97gan32qpyxpepzq8kjn7n44tvk72q6emak8k3kkypx4w8knvgs48w7wr';

console.log('=== Debugging Offers Query Issue ===\n');

// First, get all offers by owner to see what's actually stored
console.log('1. Getting all offers from owner to see what exists:');
const ownerQuery = {
  offers_by_owner: {
    owner: 'cosmos1gkec5sqldd822qxjn5wxvxwef7pw3v0yt36vah',
    limit: 100
  }
};
const ownerResult = await client.queryContractSmart(offerAddr, ownerQuery);
const ownerOffers = ownerResult.offers || ownerResult;

console.log(`Found ${ownerOffers.length} offers by owner:\n`);
ownerOffers.forEach(o => {
  console.log(`Offer #${o.offer.id}:`);
  console.log(`  Type: ${o.offer.offer_type}`);
  console.log(`  Fiat: ${o.offer.fiat_currency}`);
  console.log(`  Denom:`, o.offer.denom);
  console.log(`  Rate: ${o.offer.rate}`);
  console.log(`  Min: ${o.offer.min_amount}`);
  console.log(`  Max: ${o.offer.max_amount}`);
  console.log('');
});

// Now test offers_by with the EXACT parameters from existing offers
console.log('2. Testing offers_by query with exact parameters from existing offers:\n');

// Test for each unique combination found
const testQueries = [
  {
    name: 'Buy COP with USDC',
    query: {
      offers_by: {
        offer_type: 'buy',
        fiat_currency: 'COP',
        denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
        order: 'trades_count',
        limit: 10
      }
    }
  },
  {
    name: 'Buy ARS with USDC',
    query: {
      offers_by: {
        offer_type: 'buy',
        fiat_currency: 'ARS',
        denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
        order: 'trades_count',
        limit: 10
      }
    }
  },
  {
    name: 'Sell COP with USDC',
    query: {
      offers_by: {
        offer_type: 'sell',
        fiat_currency: 'COP',
        denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
        order: 'trades_count',
        limit: 10
      }
    }
  }
];

for (const test of testQueries) {
  console.log(`Testing: ${test.name}`);
  console.log('Query:', JSON.stringify(test.query.offers_by, null, 2));
  
  try {
    const result = await client.queryContractSmart(offerAddr, test.query);
    const offers = Array.isArray(result) ? result : (result.offers || []);
    console.log(`Result: Found ${offers.length} offers`);
    if (offers.length > 0) {
      offers.forEach(o => {
        console.log(`  - Offer #${o.offer.id} by ${o.offer.owner.substring(0, 20)}...`);
      });
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
  console.log('');
}

// Also check what the frontend default query would be
console.log('3. Testing frontend default query (Sell USD with USDC):');
const defaultQuery = {
  offers_by: {
    offer_type: 'sell',  // Default from frontend
    fiat_currency: 'USD', // Default from frontend
    denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
    order: 'trades_count',
    limit: 10
  }
};
console.log('Query:', JSON.stringify(defaultQuery.offers_by, null, 2));

try {
  const result = await client.queryContractSmart(offerAddr, defaultQuery);
  const offers = Array.isArray(result) ? result : (result.offers || []);
  console.log(`Result: Found ${offers.length} offers`);
} catch (error) {
  console.log(`Error: ${error.message}`);
}