import dotenv from 'dotenv';
dotenv.config();

import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import fs from "fs";

let rpcEndpoint = process.env.RPC || "http://localhost:26657";
let seed = process.env.ADMIN_SEED || "";

const gasPrice = GasPrice.fromString(process.env.GAS_PRICE);
const wallet = await DirectSecp256k1HdWallet.fromMnemonic(seed, { prefix: process.env.ADDR_PREFIX });
const accounts = await wallet.getAccounts();
const walletAddr = accounts[0].address;
console.log('Admin Wallet Address:', walletAddr);

const cwClient = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, wallet, {
  broadcastTimeoutMs: 60 * 1000,
  gasPrice: gasPrice
});

// Migration for OFFER contract
console.log('\n========== OFFER CONTRACT MIGRATION ==========');
console.log('\n1. Uploading offer contract...');
const offerPath = '../contracts/cosmwasm/artifacts/offer.wasm';
const offerWasm = fs.readFileSync(offerPath);
const offerUploadResult = await cwClient.upload(walletAddr, offerWasm, "auto");
console.log('Offer contract uploaded. Code ID:', offerUploadResult.codeId);

const existingOfferAddr = process.env.OFFER;
console.log('\n2. Migrating offer contract to new code ID...');
console.log('Existing Offer Contract:', existingOfferAddr);
console.log('New Code ID:', offerUploadResult.codeId);

try {
  const offerMigrateResult = await cwClient.migrate(
    walletAddr,
    existingOfferAddr,
    offerUploadResult.codeId,
    {}, // Empty migration message
    "auto",
    "Migrate offer contract - add count queries"
  );

  console.log('\n✅ Offer contract migrated successfully!');
  console.log('Transaction hash:', offerMigrateResult.transactionHash);
  console.log('Gas used:', offerMigrateResult.gasUsed);
  
  // Query contract info to verify migration
  console.log('\n3. Verifying offer migration...');
  const offerContractInfo = await cwClient.getContract(existingOfferAddr);
  console.log('Contract Info:');
  console.log('- Address:', existingOfferAddr);
  console.log('- Code ID:', offerContractInfo.codeId);
  
} catch (error) {
  console.error('Error migrating offer contract:', error.message);
  process.exit(1);
}

// Migration for TRADE contract
console.log('\n========== TRADE CONTRACT MIGRATION ==========');
console.log('\n1. Uploading trade contract...');
const tradePath = '../contracts/cosmwasm/artifacts/trade.wasm';
const tradeWasm = fs.readFileSync(tradePath);
const tradeUploadResult = await cwClient.upload(walletAddr, tradeWasm, "auto");
console.log('Trade contract uploaded. Code ID:', tradeUploadResult.codeId);

const existingTradeAddr = process.env.TRADE;
console.log('\n2. Migrating trade contract to new code ID...');
console.log('Existing Trade Contract:', existingTradeAddr);
console.log('New Code ID:', tradeUploadResult.codeId);

try {
  const tradeMigrateResult = await cwClient.migrate(
    walletAddr,
    existingTradeAddr,
    tradeUploadResult.codeId,
    {}, // Empty migration message
    "auto",
    "Migrate trade contract - add count queries"
  );

  console.log('\n✅ Trade contract migrated successfully!');
  console.log('Transaction hash:', tradeMigrateResult.transactionHash);
  console.log('Gas used:', tradeMigrateResult.gasUsed);
  
  // Query contract info to verify migration
  console.log('\n3. Verifying trade migration...');
  const tradeContractInfo = await cwClient.getContract(existingTradeAddr);
  console.log('Contract Info:');
  console.log('- Address:', existingTradeAddr);
  console.log('- Code ID:', tradeContractInfo.codeId);
  
} catch (error) {
  console.error('Error migrating trade contract:', error.message);
  process.exit(1);
}

console.log('\n========== MIGRATION SUMMARY ==========');
console.log('✅ Both contracts migrated successfully!');
console.log('- Offer contract:', existingOfferAddr, '(Code ID:', offerUploadResult.codeId, ')');
console.log('- Trade contract:', existingTradeAddr, '(Code ID:', tradeUploadResult.codeId, ')');
console.log('\nNo .env update needed - contract addresses remain the same.');

// Test new queries
console.log('\n========== TESTING NEW QUERIES ==========');
try {
  // Test offer count query
  console.log('\nTesting OffersCountByStates query...');
  const activeOffersCount = await cwClient.queryContractSmart(existingOfferAddr, {
    offers_count_by_states: {
      states: ["active"]
    }
  });
  console.log('Active offers count:', activeOffersCount);

  // Test trade count query
  console.log('\nTesting TradesCountByStates query...');
  const activeTradesCount = await cwClient.queryContractSmart(existingTradeAddr, {
    trades_count_by_states: {
      states: ["request_created", "request_accepted", "escrow_funded", "fiat_deposited"]
    }
  });
  console.log('Active trades count:', activeTradesCount);

  console.log('\n✅ New queries working correctly!');
} catch (error) {
  console.error('Error testing new queries:', error.message);
}