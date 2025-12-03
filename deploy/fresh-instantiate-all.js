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
console.log('\n1. Instantiating Profile contract...');
const profileInstantiateMsg = {};
const profileResult = await cwClient.instantiate(
  walletAddr,
  codeIds.profile,
  profileInstantiateMsg,
  "LocalMoney Profile v2",
  "auto",
  { admin: walletAddr }
);
console.log('Profile contract:', profileResult.contractAddress);

// Instantiate Price contract
console.log('\n2. Instantiating Price contract...');
const priceInstantiateMsg = {
  admin_addr: walletAddr,
  price_provider_addr: walletAddr
};
const priceResult = await cwClient.instantiate(
  walletAddr,
  codeIds.price,
  priceInstantiateMsg,
  "LocalMoney Price v2",
  "auto",
  { admin: walletAddr }
);
console.log('Price contract:', priceResult.contractAddress);

// Instantiate Offer contract
console.log('\n3. Instantiating Offer contract...');
const offerInstantiateMsg = {};
const offerResult = await cwClient.instantiate(
  walletAddr,
  codeIds.offer,
  offerInstantiateMsg,
  "LocalMoney Offer v2",
  "auto",
  { admin: walletAddr }
);
console.log('Offer contract:', offerResult.contractAddress);

// Instantiate Trade contract
console.log('\n4. Instantiating Trade contract...');
const tradeInstantiateMsg = {};
const tradeResult = await cwClient.instantiate(
  walletAddr,
  codeIds.trade,
  tradeInstantiateMsg,
  "LocalMoney Trade v2",
  "auto",
  { admin: walletAddr }
);
console.log('Trade contract:', tradeResult.contractAddress);

// Instantiate Hub contract with all the addresses
console.log('\n5. Instantiating Hub contract...');
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
  active_offers_limit: 50,
  active_trades_limit: 50,
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
  "LocalMoney Hub v2",
  "auto",
  { admin: walletAddr }
);
console.log('Hub contract:', hubResult.contractAddress);

// Now update the config to trigger registration with sub-contracts
console.log('\n6. Updating hub configuration to register with sub-contracts...');
const updateConfigMsg = {
  update_config: {
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
  }
};

const updateResult = await cwClient.execute(
  walletAddr,
  hubResult.contractAddress,
  updateConfigMsg,
  "auto",
  "Update hub configuration and register with sub-contracts"
);
console.log('Update transaction:', updateResult.transactionHash);

// Query the config to verify
console.log('\n7. Querying hub configuration...');
const configQuery = { config: {} };
const config = await cwClient.queryContractSmart(hubResult.contractAddress, configQuery);
console.log('\nHub Configuration:');
console.log(JSON.stringify(config, null, 2));

// Save contract addresses
const contractAddresses = {
  hub: hubResult.contractAddress,
  offer: offerResult.contractAddress,
  trade: tradeResult.contractAddress,
  price: priceResult.contractAddress,
  profile: profileResult.contractAddress
};

fs.writeFileSync('contract-addresses-v2.json', JSON.stringify(contractAddresses, null, 2));
console.log('\n✅ All contracts instantiated and configured successfully!');
console.log('\nContract addresses saved to contract-addresses-v2.json:');
console.log(contractAddresses);