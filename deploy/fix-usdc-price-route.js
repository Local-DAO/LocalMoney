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

// Register price route for USDC with a direct swap simulation to itself (1:1)
const registerMessage = {
  "register_price_route_for_denom": {
    "denom": { "native": "usdc" },  // Adjust this to match your actual USDC denom
    "route": [{
      "pool_id": "1",  // You may need to adjust this to a valid pool ID
      "token_out_denom": "usdc"
    }]
  }
};

console.log('Registering price route for USDC...');
console.log('Message:', JSON.stringify(registerMessage, null, 2));

try {
  const registerResult = await cwClient.execute(
    walletAddr,
    contractAddresses.price,
    registerMessage,
    "auto",
    "Register price route for USDC"
  );
  console.log('Registration transaction:', registerResult.transactionHash);
  console.log('\n✅ USDC price route registered successfully!');
} catch (error) {
  console.error('Failed to register price route:', error);
}