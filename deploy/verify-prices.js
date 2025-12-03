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

const cwClient = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, wallet, {
  broadcastTimeoutMs: 60 * 1000,
  gasPrice: gasPrice
});

// Read contract addresses
const contractAddresses = JSON.parse(fs.readFileSync('contract-addresses-v2.json', 'utf8'));

console.log('Verifying fiat prices in Price contract...\n');

// Test query for various currencies
const currencies = ['COP', 'ARS', 'BRL', 'USD'];

for (const currency of currencies) {
  try {
    const query = { get_fiat_price: { currency } };
    const price = await cwClient.queryContractSmart(contractAddresses.price, query);
    console.log(`${currency}: ${price.usd_price} cents (${(price.usd_price / 100).toFixed(2)} ${currency} per USD)`);
  } catch (err) {
    console.log(`${currency}: Error - ${err.message}`);
  }
}