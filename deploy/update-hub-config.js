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

// Contract addresses from .env
const hubAddr = process.env.HUB || 'cosmos1sl92yed0xxur0vevtd7e4fz4n9kxyp2vk9dwhh7jnlle4as9cftqua6hlz';
const offerAddr = process.env.OFFER || 'cosmos1h0esllwm83rvce570p7hkxea4uxdt7ges8mruh2dtu0gl9ah0srqy7cyxt';
const tradeAddr = process.env.TRADE || 'cosmos198n38wgqmvgx7re6sczzs8md349dw88rngy9rfzn4xwktjzqkjnqnds7qh';
const priceAddr = process.env.PRICE || 'cosmos1s5ntms0nxghv8gm4s46zhnaq2dc4j8avn6z5nxzcu7ecgswfzuwqqfw0zs';
const profileAddr = process.env.PROFILE || 'cosmos1mktgurawlguwqhnrukf87lq5qcnt7scqwkpm3ps2lczxxz2unvus9h00qq';

// Update hub configuration
console.log('Updating hub configuration...');
const updateConfigMsg = {
  update_config: {
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
    trade_limit_min: "0",
    trade_limit_max: "10000000000",
    active_offers_limit: 3,
    active_trades_limit: 10,
    arbitration_fee_pct: "0",
    burn_fee_pct: "0",
    chain_fee_pct: "0",
    warchest_fee_pct: "0",
    trade_expiration_timer: 1200,
    trade_dispute_timer: 3600
  }
};

const result = await cwClient.execute(
  walletAddr,
  hubAddr,
  updateConfigMsg,
  "auto",
  "Update hub configuration"
);

console.log('Transaction hash:', result.transactionHash);
console.log('Gas used:', result.gasUsed);
console.log('\nHub configuration updated successfully!');

// Now query the config to verify
console.log('\nQuerying hub configuration...');
const configQuery = { config: {} };
const config = await cwClient.queryContractSmart(hubAddr, configQuery);
console.log('\nHub Configuration:');
console.log(JSON.stringify(config, null, 2));