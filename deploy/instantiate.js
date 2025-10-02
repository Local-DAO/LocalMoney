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

// Read code IDs
const codeIds = JSON.parse(fs.readFileSync('../app/tests/fixtures/codeIds.json', 'utf8'));
console.log('Code IDs:', codeIds);

// Instantiate Profile contract first
console.log('Instantiating Profile contract...');
const profileInstantiateMsg = {};
const profileResult = await cwClient.instantiate(
  walletAddr,
  codeIds.profile,
  profileInstantiateMsg,
  "LocalMoney Profile",
  "auto",
  { admin: walletAddr }
);
console.log('Profile contract:', profileResult.contractAddress);

// Instantiate Price contract
console.log('Instantiating Price contract...');
const priceInstantiateMsg = {
  admin_addr: walletAddr,
  price_provider_addr: walletAddr
};
const priceResult = await cwClient.instantiate(
  walletAddr,
  codeIds.price,
  priceInstantiateMsg,
  "LocalMoney Price",
  "auto",
  { admin: walletAddr }
);
console.log('Price contract:', priceResult.contractAddress);

// Instantiate Offer contract
console.log('Instantiating Offer contract...');
const offerInstantiateMsg = {};
const offerResult = await cwClient.instantiate(
  walletAddr,
  codeIds.offer,
  offerInstantiateMsg,
  "LocalMoney Offer",
  "auto",
  { admin: walletAddr }
);
console.log('Offer contract:', offerResult.contractAddress);

// Instantiate Trade contract
console.log('Instantiating Trade contract...');
const tradeInstantiateMsg = {};
const tradeResult = await cwClient.instantiate(
  walletAddr,
  codeIds.trade,
  tradeInstantiateMsg,
  "LocalMoney Trade",
  "auto",
  { admin: walletAddr }
);
console.log('Trade contract:', tradeResult.contractAddress);

// Instantiate Hub contract with all the addresses
console.log('Instantiating Hub contract...');
const hubInstantiateMsg = {
  admin_addr: walletAddr,
  hub_owner: walletAddr,
  offer_addr: offerResult.contractAddress,
  trade_addr: tradeResult.contractAddress,
  price_addr: priceResult.contractAddress,
  profile_addr: profileResult.contractAddress,
  price_provider_addr: walletAddr,
  local_market_addr: walletAddr,
  local_denom: { native: process.env.LOCAL_DENOM || "uatom" },
  chain_fee_collector_addr: walletAddr,
  warchest_addr: walletAddr,
  trade_limit_min: "1",
  trade_limit_max: "100",
  active_offers_limit: 3,
  active_trades_limit: 10,
  arbitration_fee_pct: "0.01",
  burn_fee_pct: "0.002",
  chain_fee_pct: "0.003",
  warchest_fee_pct: "0.005",
  trade_expiration_timer: 1200,
  trade_dispute_timer: 3600
};

const hubResult = await cwClient.instantiate(
  walletAddr,
  codeIds.hub,
  hubInstantiateMsg,
  "LocalMoney Hub",
  "auto",
  { admin: walletAddr }
);
console.log('Hub contract:', hubResult.contractAddress);

// Save contract addresses
const contractAddresses = {
  hub: hubResult.contractAddress,
  offer: offerResult.contractAddress,
  trade: tradeResult.contractAddress,
  price: priceResult.contractAddress,
  profile: profileResult.contractAddress
};

fs.writeFileSync('contract-addresses.json', JSON.stringify(contractAddresses, null, 2));
console.log('\nAll contracts instantiated successfully!');
console.log('\nContract addresses saved to contract-addresses.json:');
console.log(contractAddresses);