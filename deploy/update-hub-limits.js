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

// Read contract addresses
const contractAddresses = JSON.parse(fs.readFileSync('contract-addresses-v2.json', 'utf8'));

console.log('Updating hub configuration with 50 offer/trade limits...');
const updateConfigMsg = {
  update_config: {
    offer_addr: contractAddresses.offer,
    trade_addr: contractAddresses.trade,
    price_addr: contractAddresses.price,
    profile_addr: contractAddresses.profile,
    price_provider_addr: walletAddr,
    local_market_addr: walletAddr,
    local_denom: { native: process.env.LOCAL_DENOM || "uatom" },
    chain_fee_collector_addr: walletAddr,
    warchest_addr: walletAddr,
    trade_limit_min: "1",
    trade_limit_max: "100",
    active_offers_limit: 50,
    active_trades_limit: 50,
    arbitration_fee_pct: "0.01",
    burn_fee_pct: "0.002",
    chain_fee_pct: "0.003",
    warchest_fee_pct: "0.005",
    trade_expiration_timer: 1200,
    trade_dispute_timer: 3600
  }
};

const updateResult = await cwClient.execute(
  walletAddr,
  contractAddresses.hub,
  updateConfigMsg,
  "auto",
  "Update hub limits to 50"
);
console.log('Update transaction:', updateResult.transactionHash);

// Query the config to verify
console.log('\nQuerying updated hub configuration...');
const configQuery = { config: {} };
const config = await cwClient.queryContractSmart(contractAddresses.hub, configQuery);
console.log('\nHub Configuration:');
console.log(JSON.stringify(config, null, 2));
