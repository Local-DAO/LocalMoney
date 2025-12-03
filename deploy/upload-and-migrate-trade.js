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

// Step 1: Upload the new trade contract version
console.log('\n1. Uploading trade contract v1.0.1...');
const tradePath = '../contracts/cosmwasm/artifacts/trade.wasm';
const tradeWasm = fs.readFileSync(tradePath);
const uploadResult = await cwClient.upload(walletAddr, tradeWasm, "auto");
console.log('Trade contract uploaded. Code ID:', uploadResult.codeId);

// Step 2: Migrate the existing trade contract
const existingTradeAddr = process.env.TRADE || 'cosmos198n38wgqmvgx7re6sczzs8md349dw88rngy9rfzn4xwktjzqkjnqnds7qh';
console.log('\n2. Migrating trade contract to new code ID...');
console.log('Existing Trade Contract:', existingTradeAddr);
console.log('New Code ID:', uploadResult.codeId);

// Migration message - empty object for trade contract
const migrateMsg = {};

try {
  const migrateResult = await cwClient.migrate(
    walletAddr,
    existingTradeAddr,
    uploadResult.codeId,
    migrateMsg,
    "auto",
    "Migrate trade contract to v1.0.1"
  );

  console.log('\n✅ Trade contract migrated successfully!');
  console.log('Transaction hash:', migrateResult.transactionHash);
  console.log('Gas used:', migrateResult.gasUsed);
  
  // Query contract info to verify migration
  console.log('\n3. Verifying migration...');
  const contractInfo = await cwClient.getContract(existingTradeAddr);
  console.log('Contract Info:');
  console.log('- Address:', existingTradeAddr);
  console.log('- Code ID:', contractInfo.codeId);
  console.log('- Admin:', contractInfo.admin);
  console.log('- Label:', contractInfo.label);
  
} catch (error) {
  console.error('Error migrating trade contract:', error.message);
  process.exit(1);
}

console.log('\n✅ Migration completed!');
console.log('The trade contract at', existingTradeAddr, 'is now using code ID', uploadResult.codeId);
console.log('\nNo .env update needed - contract address remains the same.');