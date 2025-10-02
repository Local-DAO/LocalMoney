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

// Contract addresses from previous instantiation
const profileAddr = 'cosmos1pcnwkghflh9m3dmrwlrlgwysg2nzyzpfgujdq6h6ah2g3n3g498sjqvg6l';
const priceAddr = 'cosmos1g0j2rxejypdkmd020an4vsv4us50sqlpkqjycm37qq38cgd4zgysxqlm2x';
const offerAddr = 'cosmos1c2lu59jcktxmy5cly7xcsr986vs5eqll9akd98qq7m5e5mmwux2q9pcnhe';
const tradeAddr = 'cosmos1dgcc74cucjp4kjnuhljv5jc4jypgkutxnykdjaayep9xnl0z8w7s09q6xw';

// Instantiate Hub contract with all the addresses
console.log('Instantiating Hub contract...');
const hubInstantiateMsg = {
  admin_addr: walletAddr,
  hub_owner: walletAddr,
  offer_addr: offerAddr,
  trade_addr: tradeAddr,
  price_addr: priceAddr,
  profile_addr: profileAddr,
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
  offer: offerAddr,
  trade: tradeAddr,
  price: priceAddr,
  profile: profileAddr
};

fs.writeFileSync('contract-addresses.json', JSON.stringify(contractAddresses, null, 2));
console.log('\nHub contract instantiated successfully!');
console.log('\nAll contract addresses saved to contract-addresses.json:');
console.log(contractAddresses);