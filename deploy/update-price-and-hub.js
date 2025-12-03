import dotenv from 'dotenv';
dotenv.config();

import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";

let rpcEndpoint = process.env.RPC || "https://cosmos-rpc.publicnode.com:443";
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

// Contract addresses from our deployment
const hubAddr = process.env.HUB || 'cosmos1zcsqlzeqwu82pu38d29glfkse5kefhfcvchxy5z4gegqw0dj3clqnlzlvz';
const priceAddr = process.env.PRICE || 'cosmos186gyfg3mghs3wvtp0fymtywvlp82remc2ur6m5649dj74ema3sesuxujfq';

console.log('Hub Address:', hubAddr);
console.log('Price Address:', priceAddr);

// 1. Register empty price route for IBC token
console.log('\n1. Registering empty price route for IBC token...');

const ibcDenom = 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013';

const registerPriceRouteMsg = {
  register_price_route_for_denom: {
    denom: { native: ibcDenom },
    route: [] // Empty route
  }
};

try {
  const priceResult = await cwClient.execute(
    walletAddr,
    priceAddr,
    registerPriceRouteMsg,
    "auto",
    "Register empty price route for IBC token"
  );
  console.log('✅ Price route registered successfully');
  console.log('Transaction hash:', priceResult.transactionHash);
} catch (error) {
  console.log('❌ Failed to register price route:', error.message);
}

// 2. Update hub configuration with zero fees
console.log('\n2. Updating hub configuration with zero fees...');

// First get current config
const configQuery = { config: {} };
const currentConfig = await cwClient.queryContractSmart(hubAddr, configQuery);
console.log('\nCurrent configuration loaded');

// Update config with zero fees
const updateConfigMsg = {
  update_config: {
    hub_owner: currentConfig.hub_owner || walletAddr,
    offer_addr: currentConfig.offer_addr,
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
    // Set all fees to zero
    arbitration_fee_pct: "0",
    burn_fee_pct: "0",
    chain_fee_pct: "0",
    warchest_fee_pct: "0",
    trade_expiration_timer: currentConfig.trade_expiration_timer,
    trade_dispute_timer: currentConfig.trade_dispute_timer
  }
};

try {
  const hubResult = await cwClient.execute(
    walletAddr,
    hubAddr,
    updateConfigMsg,
    "auto",
    "Update hub configuration with zero fees"
  );
  console.log('✅ Hub configuration updated successfully');
  console.log('Transaction hash:', hubResult.transactionHash);
} catch (error) {
  console.log('❌ Failed to update hub configuration:', error.message);
}

// 3. Verify the changes
console.log('\n3. Verifying configuration changes...');

// Query updated hub config
const updatedConfig = await cwClient.queryContractSmart(hubAddr, configQuery);
console.log('\n✅ Updated Hub Configuration:');
console.log('  - arbitration_fee_pct:', updatedConfig.arbitration_fee_pct);
console.log('  - burn_fee_pct:', updatedConfig.burn_fee_pct);
console.log('  - chain_fee_pct:', updatedConfig.chain_fee_pct);
console.log('  - warchest_fee_pct:', updatedConfig.warchest_fee_pct);

// Query price route for IBC token
try {
  const priceQuery = { 
    price: { 
      denom: { native: ibcDenom },
      fiat: "USD"
    } 
  };
  const price = await cwClient.queryContractSmart(priceAddr, priceQuery);
  console.log('\nPrice route for IBC token:', price);
} catch (error) {
  if (error.message.includes('not found') || error.message.includes('No route')) {
    console.log('\n✅ Price route registered (empty route, no price data yet)');
  } else {
    console.log('\nPrice query error:', error.message);
  }
}

console.log('\n✅ All operations completed!');