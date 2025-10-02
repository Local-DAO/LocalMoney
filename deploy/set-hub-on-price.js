import dotenv from 'dotenv';
dotenv.config();

import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";

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
const priceAddr = 'cosmos1g0j2rxejypdkmd020an4vsv4us50sqlpkqjycm37qq38cgd4zgysxqlm2x';
const hubAddr = 'cosmos1ars7lex2nenmxhdu8wfc0r7ux64kp4h37t4l2hxuft65qaszg27qneg6uw';

// Register hub address on price contract
console.log('Registering hub address on price contract...');
const setHubMsg = {
  register_hub: {
    hub_addr: hubAddr
  }
};

const result = await cwClient.execute(
  walletAddr,
  priceAddr,
  setHubMsg,
  "auto",
  "Set hub address on price contract"
);

console.log('Transaction hash:', result.transactionHash);
console.log('Gas used:', result.gasUsed);
console.log('Hub address set successfully on price contract!');