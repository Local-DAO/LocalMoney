import dotenv from 'dotenv';
dotenv.config();

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

const rpcEndpoint = process.env.RPC || "http://localhost:26657";
const tradeAddr = process.env.TRADE;
const offerAddr = process.env.OFFER;

console.log('Trade Contract:', tradeAddr);
console.log('Offer Contract:', offerAddr);
console.log('');

const client = await CosmWasmClient.connect(rpcEndpoint);

// Test different trade state combinations
const tradeStates = {
  active: ['request_created', 'request_accepted', 'escrow_funded', 'fiat_deposited'],
  completed: ['escrow_released', 'escrow_refunded'],
  cancelled: ['request_canceled', 'escrow_canceled'],
  disputed: ['escrow_disputed', 'settled_for_maker', 'settled_for_taker']
};

console.log('=== TRADE COUNTS BY STATE ===\n');

for (const [category, states] of Object.entries(tradeStates)) {
  try {
    const result = await client.queryContractSmart(tradeAddr, {
      trades_count_by_states: { states }
    });
    console.log(`${category.toUpperCase()} trades (${states.join(', ')}):`, result.count);
  } catch (e) {
    console.log(`${category.toUpperCase()} trades: Error -`, e.message);
  }
}

// Check each state individually to find which has the 3 trades
console.log('\n=== INDIVIDUAL STATE COUNTS ===\n');
const allStates = [
  'request_created', 'request_accepted', 'request_canceled', 'request_expired',
  'escrow_funded', 'escrow_canceled', 'escrow_refunded', 'fiat_deposited',
  'escrow_released', 'escrow_disputed', 'settled_for_maker', 'settled_for_taker'
];

for (const state of allStates) {
  try {
    const result = await client.queryContractSmart(tradeAddr, {
      trades_count_by_states: { states: [state] }
    });
    if (result.count > 0) {
      console.log(`${state}: ${result.count} trades`);
    }
  } catch (e) {
    console.log(`${state}: Error -`, e.message);
  }
}

// Also check offer counts
console.log('\n=== OFFER COUNTS ===\n');
const offerStates = ['active', 'paused', 'archive'];

for (const state of offerStates) {
  try {
    const result = await client.queryContractSmart(offerAddr, {
      offers_count_by_states: { states: [state] }
    });
    console.log(`${state}: ${result.count} offers`);
  } catch (e) {
    console.log(`${state}: Error -`, e.message);
  }
}

// Test the fiat rankings queries
console.log('\n=== FIAT RANKINGS ===\n');

try {
  const offersRanking = await client.queryContractSmart(offerAddr, {
    all_fiats_offers_count: { states: ['active'] }
  });
  console.log('Top fiats by active offers:');
  offersRanking.slice(0, 5).forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.fiat}: ${item.count} offers`);
  });
} catch (e) {
  console.log('Fiat offers ranking error:', e.message);
}

try {
  const tradesRanking = await client.queryContractSmart(tradeAddr, {
    all_fiats_trades_count: { states: ['escrow_released', 'escrow_refunded'] }
  });
  console.log('\nTop fiats by completed trades:');
  tradesRanking.slice(0, 5).forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.fiat}: ${item.count} trades`);
  });
} catch (e) {
  console.log('Fiat trades ranking error:', e.message);
}