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
console.log('Wallet Address:', walletAddr);

const cwClient = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, wallet, {
  broadcastTimeoutMs: 60 * 1000,
  gasPrice: gasPrice
});

console.log('Deploying fixed offer contract...');

// Upload the fixed offer contract
const wasm = fs.readFileSync('../contracts/cosmwasm/artifacts/offer.wasm');
const uploadResult = await cwClient.upload(walletAddr, wasm, "auto");
console.log('Upload result:', uploadResult);
console.log('New Offer Code ID:', uploadResult.codeId);

// Update the code IDs file
const codeIdsPath = '../app/tests/fixtures/codeIds.json';
const codeIds = JSON.parse(fs.readFileSync(codeIdsPath, 'utf8'));
codeIds.offer_fixed = uploadResult.codeId;
fs.writeFileSync(codeIdsPath, JSON.stringify(codeIds, null, 2), 'utf8');

console.log('\n✅ Fixed offer contract deployed!');
console.log('Code ID:', uploadResult.codeId);
console.log('Transaction Hash:', uploadResult.transactionHash);