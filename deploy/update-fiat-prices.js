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

console.log('Updating fiat prices in Price contract...');
const updatePricesMsg = {
  update_prices: [
    { currency: "COP", usd_price: "482182", updated_at: 0 },
    { currency: "ARS", usd_price: "31259", updated_at: 0 },
    { currency: "BRL", usd_price: "540", updated_at: 0 }
  ]
};

const updateResult = await cwClient.execute(
  walletAddr,
  contractAddresses.price,
  updatePricesMsg,
  "auto",
  "Update fiat prices"
);
console.log('Update transaction:', updateResult.transactionHash);

// Test query for COP price
console.log('\nQuerying COP/USD exchange rate...');
const copQuery = { get_fiat_price: { currency: "COP" } };
const copPrice = await cwClient.queryContractSmart(contractAddresses.price, copQuery);
console.log('COP Price:', copPrice);

console.log('\n✅ Fiat prices updated successfully!');
