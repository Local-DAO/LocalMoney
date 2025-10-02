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

// New trade contract address from previous deployment
const newTradeAddr = 'cosmos1t64c2kuvfcegu950m54tjxsn30pvunt7c4xsxy2nj0syjeushvws4qwgdy';
const hubAddr = process.env.HUB || 'cosmos1sl92yed0xxur0vevtd7e4fz4n9kxyp2vk9dwhh7jnlle4as9cftqua6hlz';
const offerAddr = process.env.OFFER || 'cosmos1h0esllwm83rvce570p7hkxea4uxdt7ges8mruh2dtu0gl9ah0srqy7cyxt';
const priceAddr = process.env.PRICE || 'cosmos1s5ntms0nxghv8gm4s46zhnaq2dc4j8avn6z5nxzcu7ecgswfzuwqqfw0zs';
const profileAddr = process.env.PROFILE || 'cosmos1mktgurawlguwqhnrukf87lq5qcnt7scqwkpm3ps2lczxxz2unvus9h00qq';

console.log('Updating hub configuration with new trade contract...');
console.log('New Trade Contract:', newTradeAddr);

const updateConfigMsg = {
  update_config: {
    hub_owner: walletAddr,
    offer_addr: offerAddr,
    trade_addr: newTradeAddr, // New trade contract
    price_addr: priceAddr,
    profile_addr: profileAddr,
    price_provider_addr: walletAddr,
    local_market_addr: walletAddr,
    local_denom: { native: process.env.LOCAL_DENOM || "uatom" },
    chain_fee_collector_addr: walletAddr,
    warchest_addr: walletAddr,
    trade_limit_min: "0",
    trade_limit_max: "10000000000",
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

try {
  const updateResult = await cwClient.execute(
    walletAddr,
    hubAddr,
    updateConfigMsg,
    "auto",
    "Update hub configuration with new trade contract"
  );

  console.log('Hub configuration updated successfully!');
  console.log('Transaction hash:', updateResult.transactionHash);
  console.log('Gas used:', updateResult.gasUsed);
} catch (error) {
  console.error('Error updating hub configuration:', error.message);
  process.exit(1);
}

// Verify the update
console.log('\nVerifying hub configuration...');
const configQuery = { config: {} };
const config = await cwClient.queryContractSmart(hubAddr, configQuery);
console.log('\nHub Configuration:');
console.log('- Hub Owner:', config.hub_owner);
console.log('- Trade Contract:', config.trade_addr);
console.log('- Offer Contract:', config.offer_addr);
console.log('- Price Contract:', config.price_addr);
console.log('- Profile Contract:', config.profile_addr);

// Update .env file with new trade contract address
console.log('\nUpdating .env file...');
const envPath = '../app/.env';
let envContent = fs.readFileSync(envPath, 'utf8');
envContent = envContent.replace(/^TRADE=.*$/m, `TRADE=${newTradeAddr}`);
fs.writeFileSync(envPath, envContent);
console.log('.env file updated with new trade contract address');

console.log('\n✅ Hub update completed successfully!');
console.log('\nSummary:');
console.log('- Trade Contract Address:', newTradeAddr);
console.log('- Hub Address:', hubAddr);