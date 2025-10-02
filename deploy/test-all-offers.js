import dotenv from 'dotenv';
dotenv.config();

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";

const client = await CosmWasmClient.connect(rpcEndpoint);

// Offer contract address from our deployment
const offerAddr = process.env.OFFER || 'cosmos1t97gan32qpyxpepzq8kjn7n44tvk72q6emak8k3kkypx4w8knvgs48w7wr';

console.log('Testing all offers queries...\n');
console.log('Offer Contract:', offerAddr);

// Test 1: Get specific offer
console.log('1. Getting offer #2:');
try {
  const offerQuery = { offer: { id: 2 } };
  const offer = await client.queryContractSmart(offerAddr, offerQuery);
  console.log('  Offer #2:');
  console.log('    Owner:', offer.offer.owner);
  console.log('    Type:', offer.offer.offer_type);
  console.log('    Fiat:', offer.offer.fiat_currency);
  console.log('    Denom:', offer.offer.denom);
} catch (error) {
  console.log('  Error:', error.message);
}

// Test 2: Query buy offers with USDC
console.log('\n2. Buy offers for USDC:');
try {
  const buyQuery = {
    offers_by: {
      offer_type: 'buy',
      fiat_currency: 'USD',
      denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
      order: 'trades_count',
      limit: 10
    }
  };
  const buyOffers = await client.queryContractSmart(offerAddr, buyQuery);
  console.log('  Found buy offers:', Array.isArray(buyOffers) ? buyOffers.length : buyOffers.offers?.length || 0);
  if (Array.isArray(buyOffers) && buyOffers.length > 0) {
    buyOffers.forEach(o => {
      console.log(`    Offer #${o.offer.id}: ${o.offer.offer_type} by ${o.offer.owner.substring(0, 20)}...`);
    });
  }
} catch (error) {
  console.log('  Error:', error.message);
}

// Test 3: Query sell offers with USDC
console.log('\n3. Sell offers for USDC:');
try {
  const sellQuery = {
    offers_by: {
      offer_type: 'sell',
      fiat_currency: 'USD',
      denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
      order: 'trades_count',
      limit: 10
    }
  };
  const sellOffers = await client.queryContractSmart(offerAddr, sellQuery);
  console.log('  Found sell offers:', Array.isArray(sellOffers) ? sellOffers.length : sellOffers.offers?.length || 0);
} catch (error) {
  console.log('  Error:', error.message);
}

// Test 4: Query offers by owner
console.log('\n4. Offers by owner:');
try {
  const ownerQuery = {
    offers_by_owner: {
      owner: 'cosmos1gkec5sqldd822qxjn5wxvxwef7pw3v0yt36vah',
      limit: 10
    }
  };
  const ownerOffers = await client.queryContractSmart(offerAddr, ownerQuery);
  const offers = ownerOffers.offers || ownerOffers;
  console.log('  Found offers by owner:', Array.isArray(offers) ? offers.length : 0);
  if (Array.isArray(offers) && offers.length > 0) {
    offers.forEach(o => {
      console.log(`    Offer #${o.offer.id}: ${o.offer.offer_type} ${o.offer.fiat_currency}`);
    });
  }
} catch (error) {
  console.log('  Error:', error.message);
}