import dotenv from 'dotenv';
dotenv.config();

import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import fs from "fs";

let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";
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

// Contract addresses
const hubAddr = process.env.HUB;
console.log('Hub Address:', hubAddr);

console.log('\n=== 1. Uploading New Price Contract ===');

// Upload the new price contract
const priceWasm = fs.readFileSync('../contracts/cosmwasm/artifacts/price.wasm');
const uploadResult = await cwClient.upload(walletAddr, priceWasm, "auto");
console.log('✅ Price contract uploaded successfully');
console.log('New Price Code ID:', uploadResult.codeId);
console.log('Transaction Hash:', uploadResult.transactionHash);

console.log('\n=== 2. Instantiating New Price Contract ===');

// Instantiate the new price contract
const priceInstantiateMsg = {
  admin_addr: walletAddr,
  price_provider_addr: walletAddr
};

const priceResult = await cwClient.instantiate(
  walletAddr,
  uploadResult.codeId,
  priceInstantiateMsg,
  "LocalMoney Price v3",
  "auto",
  { admin: walletAddr }
);

console.log('✅ New Price contract instantiated');
console.log('New Price Address:', priceResult.contractAddress);

console.log('\n=== 3. Getting Current Hub Configuration ===');

// Get current hub config
const configQuery = { config: {} };
const currentConfig = await cwClient.queryContractSmart(hubAddr, configQuery);
console.log('Current price_addr in hub:', currentConfig.price_addr);

console.log('\n=== 4. Updating Hub Configuration ===');

// Update hub configuration with new price contract
const updateConfigMsg = {
  update_config: {
    hub_owner: currentConfig.hub_owner,
    offer_addr: currentConfig.offer_addr,
    trade_addr: currentConfig.trade_addr,
    price_addr: priceResult.contractAddress, // New price contract address
    profile_addr: currentConfig.profile_addr,
    price_provider_addr: currentConfig.price_provider_addr,
    local_market_addr: currentConfig.local_market_addr,
    local_denom: currentConfig.local_denom,
    chain_fee_collector_addr: currentConfig.chain_fee_collector_addr,
    warchest_addr: currentConfig.warchest_addr,
    trade_limit_min: currentConfig.trade_limit_min,
    trade_limit_max: currentConfig.trade_limit_max,
    active_offers_limit: currentConfig.active_offers_limit,
    active_trades_limit: currentConfig.active_trades_limit,
    arbitration_fee_pct: currentConfig.arbitration_fee_pct,
    burn_fee_pct: currentConfig.burn_fee_pct,
    chain_fee_pct: currentConfig.chain_fee_pct,
    warchest_fee_pct: currentConfig.warchest_fee_pct,
    trade_expiration_timer: currentConfig.trade_expiration_timer,
    trade_dispute_timer: currentConfig.trade_dispute_timer
  }
};

const hubUpdateResult = await cwClient.execute(
  walletAddr,
  hubAddr,
  updateConfigMsg,
  "auto",
  "Update hub with new price contract"
);

console.log('✅ Hub configuration updated successfully');
console.log('Transaction hash:', hubUpdateResult.transactionHash);

console.log('\n=== 5. Updating Contract Addresses Files ===');

// Update contract-addresses.json
const contractAddresses = JSON.parse(fs.readFileSync('contract-addresses.json', 'utf8'));
contractAddresses.price = priceResult.contractAddress;
fs.writeFileSync('contract-addresses.json', JSON.stringify(contractAddresses, null, 2));

// Update .env file
const envContent = fs.readFileSync('.env', 'utf8');
const updatedEnvContent = envContent.replace(
  /PRICE=.*/,
  `PRICE=${priceResult.contractAddress}`
);
fs.writeFileSync('.env', updatedEnvContent);

// Update codeIds.json
const codeIdsPath = '../app/tests/fixtures/codeIds.json';
const codeIds = JSON.parse(fs.readFileSync(codeIdsPath, 'utf8'));
codeIds.price = uploadResult.codeId;
fs.writeFileSync(codeIdsPath, JSON.stringify(codeIds, null, 2));

console.log('\n=== 6. Verification ===');

// Verify the changes
const updatedConfig = await cwClient.queryContractSmart(hubAddr, configQuery);
console.log('✅ Verification Complete:');
console.log('  - Old price_addr:', currentConfig.price_addr);
console.log('  - New price_addr:', updatedConfig.price_addr);
console.log('  - New code ID:', uploadResult.codeId);

console.log('\n✅ Price contract deployment and hub update completed successfully!');
console.log('\nSummary:');
console.log(`  - New Price Contract: ${priceResult.contractAddress}`);
console.log(`  - New Code ID: ${uploadResult.codeId}`);
console.log(`  - Hub Updated: ${hubAddr}`);