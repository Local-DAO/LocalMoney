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

// Contract addresses
const hubAddr = process.env.HUB || 'cosmos1zcsqlzeqwu82pu38d29glfkse5kefhfcvchxy5z4gegqw0dj3clqnlzlvz';
const oldOfferAddr = process.env.OFFER || 'cosmos1t97gan32qpyxpepzq8kjn7n44tvk72q6emak8k3kkypx4w8knvgs48w7wr';

console.log('Hub Address:', hubAddr);
console.log('Old Offer Address:', oldOfferAddr);

// 1. Instantiate the new offer contract
console.log('\n1. Instantiating new offer contract...');
const offerInstantiateMsg = {};
const offerResult = await cwClient.instantiate(
  walletAddr,
  282, // New code ID
  offerInstantiateMsg,
  "LocalMoney Offer v2 Fixed",
  "auto",
  { admin: walletAddr }
);
console.log('New Offer contract:', offerResult.contractAddress);

// 2. Get current hub configuration
console.log('\n2. Getting current hub configuration...');
const configQuery = { config: {} };
const currentConfig = await cwClient.queryContractSmart(hubAddr, configQuery);
console.log('Current hub configuration loaded');

// 3. Update hub configuration with new offer address
console.log('\n3. Updating hub configuration with new offer address...');
const updateConfigMsg = {
  update_config: {
    hub_owner: currentConfig.hub_owner || walletAddr,
    offer_addr: offerResult.contractAddress, // NEW OFFER ADDRESS
    trade_addr: currentConfig.trade_addr,
    price_addr: currentConfig.price_addr,
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

const hubResult = await cwClient.execute(
  walletAddr,
  hubAddr,
  updateConfigMsg,
  "auto",
  "Update hub with new offer contract"
);
console.log('Hub configuration updated');
console.log('Transaction hash:', hubResult.transactionHash);

// 4. Verify the update
console.log('\n4. Verifying hub configuration...');
const updatedConfig = await cwClient.queryContractSmart(hubAddr, configQuery);
console.log('Updated offer address:', updatedConfig.offer_addr);

// 5. Save new contract addresses
const contractAddresses = JSON.parse(fs.readFileSync('contract-addresses-v2.json', 'utf8'));
contractAddresses.offer_old = oldOfferAddr;
contractAddresses.offer = offerResult.contractAddress;
fs.writeFileSync('contract-addresses-v2.json', JSON.stringify(contractAddresses, null, 2));

console.log('\n✅ Offer contract replaced successfully!');
console.log('Old Offer Address:', oldOfferAddr);
console.log('New Offer Address:', offerResult.contractAddress);
console.log('Hub Update TX:', hubResult.transactionHash);