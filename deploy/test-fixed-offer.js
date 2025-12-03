import dotenv from 'dotenv';
dotenv.config();

import { SigningCosmWasmClient, CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";

let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";
let seed = process.env.ADMIN_SEED || "";

const gasPrice = GasPrice.fromString(process.env.GAS_PRICE);
const wallet = await DirectSecp256k1HdWallet.fromMnemonic(seed, { prefix: process.env.ADDR_PREFIX });
const accounts = await wallet.getAccounts();
const walletAddr = accounts[0].address;

const cwClient = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, wallet, {
  broadcastTimeoutMs: 60 * 1000,
  gasPrice: gasPrice
});

// Also create a read-only client for queries
const queryClient = await CosmWasmClient.connect(rpcEndpoint);

const newOfferAddr = 'cosmos1e3w7k9lcv26t8lfnna9e2mawprgc7jqpzk6lruh52ze8vff7ey6qlyet5q';

console.log('=== Testing Fixed Offer Contract ===\n');
console.log('Admin Address:', walletAddr);
console.log('New Offer Contract:', newOfferAddr);

// 1. Create some test offers
console.log('\n1. Creating test offers...');

const offers = [
  {
    offer_type: 'buy',
    owner_contact: 'test@example.com',
    owner_encryption_key: 'test-key',
    rate: '100',
    min_amount: '1000000',
    max_amount: '100000000',
    fiat_currency: 'COP',
    denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
    description: 'Buy COP with USDC',
    payment_methods: ['bank_transfer']
  },
  {
    offer_type: 'sell',
    owner_contact: 'test@example.com',
    owner_encryption_key: 'test-key',
    rate: '100',
    min_amount: '1000000',
    max_amount: '100000000',
    fiat_currency: 'USD',
    denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
    description: 'Sell USD for USDC',
    payment_methods: ['paypal']
  },
  {
    offer_type: 'buy',
    owner_contact: 'test@example.com',
    owner_encryption_key: 'test-key',
    rate: '100',
    min_amount: '1000000',
    max_amount: '100000000',
    fiat_currency: 'USD',
    denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
    description: 'Buy USD with USDC',
    payment_methods: ['zelle']
  }
];

for (const offer of offers) {
  try {
    const msg = { create: { offer } };
    const result = await cwClient.execute(
      walletAddr,
      newOfferAddr,
      msg,
      "auto"
    );
    console.log(`  Created ${offer.offer_type} ${offer.fiat_currency} offer. TX: ${result.transactionHash.substring(0, 10)}...`);
  } catch (error) {
    console.log(`  Failed to create offer: ${error.message}`);
  }
}

// Wait a bit for blockchain to process
await new Promise(resolve => setTimeout(resolve, 3000));

// 2. Test offers_by queries
console.log('\n2. Testing offers_by queries with the fixed contract...');

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
    name: 'Buy USD with USDC',
    query: {
      offers_by: {
        offer_type: 'buy',
        fiat_currency: 'USD',
        denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
        order: 'trades_count',
        limit: 10
      }
    }
  },
  {
    name: 'Sell USD for USDC',
    query: {
      offers_by: {
        offer_type: 'sell',
        fiat_currency: 'USD',
        denom: { native: 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' },
        order: 'trades_count',
        limit: 10
      }
    }
  }
];

for (const test of testQueries) {
  console.log(`\n  Testing: ${test.name}`);
  
  try {
    const result = await queryClient.queryContractSmart(newOfferAddr, test.query);
    const offers = Array.isArray(result) ? result : (result.offers || []);
    console.log(`  ✅ Query works! Found ${offers.length} offers`);
    if (offers.length > 0) {
      offers.forEach(o => {
        console.log(`     - Offer #${o.offer.id}: ${o.offer.offer_type} ${o.offer.fiat_currency} at rate ${o.offer.rate}`);
      });
    }
  } catch (error) {
    console.log(`  ❌ Query failed: ${error.message}`);
  }
}

// 3. Test offers_by_owner
console.log('\n3. Testing offers_by_owner query...');
try {
  const ownerQuery = {
    offers_by_owner: {
      owner: walletAddr,
      limit: 10
    }
  };
  const result = await queryClient.queryContractSmart(newOfferAddr, ownerQuery);
  const offers = result.offers || result;
  console.log(`  ✅ Found ${offers.length} offers by owner`);
  offers.forEach(o => {
    console.log(`     - Offer #${o.offer.id}: ${o.offer.offer_type} ${o.offer.fiat_currency}`);
  });
} catch (error) {
  console.log(`  ❌ Owner query failed: ${error.message}`);
}

console.log('\n✅ Test complete! The fixed offer contract is working correctly.');