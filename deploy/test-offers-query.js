import dotenv from 'dotenv';
dotenv.config();

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";

const client = await CosmWasmClient.connect(rpcEndpoint);

// Offer contract address from our deployment
const offerAddr = process.env.OFFER || 'cosmos1t97gan32qpyxpepzq8kjn7n44tvk72q6emak8k3kkypx4w8knvgs48w7wr';

console.log('Testing offers queries...\n');
console.log('Offer Contract:', offerAddr);

// Test 1: Query offers by owner (working)
console.log('\n1. Testing OffersByOwner query (working):');
try {
  const ownerQuery = {
    offers_by_owner: {
      owner: 'cosmos1gkec5sqldd822qxjn5wxvxwef7pw3v0yt36vah',
      limit: 10
    }
  };
  const ownerOffers = await client.queryContractSmart(offerAddr, ownerQuery);
  console.log('✅ OffersByOwner works. Found offers:', ownerOffers.offers ? ownerOffers.offers.length : 0);
} catch (error) {
  console.log('❌ OffersByOwner failed:', error.message);
}

// Test 2: Query offers by criteria (not working)
console.log('\n2. Testing OffersBy query (issue):');
try {
  const offersQuery = {
    offers_by: {
      offer_type: 'Buy',  // or { buy: {} }
      fiat_currency: 'USD',
      denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
      order: 'Asc',  // or { asc: {} }
      limit: 10
    }
  };
  console.log('Query:', JSON.stringify(offersQuery, null, 2));
  const offers = await client.queryContractSmart(offerAddr, offersQuery);
  console.log('✅ OffersBy works. Found offers:', offers.offers ? offers.offers.length : 0);
} catch (error) {
  console.log('❌ OffersBy failed:', error.message);
  
  // Try different formats
  console.log('\n  Trying different enum formats...');
  
  // Try with enum objects
  try {
    const offersQuery2 = {
      offers_by: {
        offer_type: { buy: {} },
        fiat_currency: 'USD',
        denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
        order: { asc: {} },
        limit: 10
      }
    };
    const offers2 = await client.queryContractSmart(offerAddr, offersQuery2);
    console.log('  ✅ With enum objects works. Found offers:', offers2.offers ? offers2.offers.length : 0);
  } catch (error2) {
    console.log('  ❌ With enum objects failed:', error2.message);
  }
}

// Test 3: Query a specific offer
console.log('\n3. Testing single offer query:');
try {
  const offerQuery = {
    offer: {
      id: 2
    }
  };
  const offer = await client.queryContractSmart(offerAddr, offerQuery);
  console.log('✅ Single offer query works');
  console.log('  Offer owner:', offer.offer.owner);
  console.log('  Offer type:', offer.offer.offer_type);
} catch (error) {
  console.log('❌ Single offer query failed:', error.message);
}

// Test 4: Query state
console.log('\n4. Testing state query:');
try {
  const stateQuery = { state: {} };
  const state = await client.queryContractSmart(offerAddr, stateQuery);
  console.log('✅ State query works');
  console.log('  Total offers:', state.offers_count);
} catch (error) {
  console.log('❌ State query failed:', error.message);
}