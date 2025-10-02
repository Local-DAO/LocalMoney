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

// Step 1: Upload the trade contract
console.log('\n1. Uploading trade contract...');
const tradePath = '../contracts/cosmwasm/artifacts/trade.wasm';
const tradeWasm = fs.readFileSync(tradePath);
const uploadResult = await cwClient.upload(walletAddr, tradeWasm, "auto");
console.log('Trade contract uploaded. Code ID:', uploadResult.codeId);

// Step 2: Instantiate the trade contract
console.log('\n2. Instantiating trade contract...');
const tradeInstantiateMsg = {};
const tradeResult = await cwClient.instantiate(
  walletAddr,
  uploadResult.codeId,
  tradeInstantiateMsg,
  "LocalMoney Trade",
  "auto",
  { admin: walletAddr }
);
console.log('Trade contract instantiated at:', tradeResult.contractAddress);

// Step 3: Register hub with the new trade contract
console.log('\n3. Registering hub with trade contract...');
const hubAddr = process.env.HUB || 'cosmos1sl92yed0xxur0vevtd7e4fz4n9kxyp2vk9dwhh7jnlle4as9cftqua6hlz';
try {
  const registerHubMsg = {
    register_hub: {
      hub_addr: hubAddr
    }
  };
  const registerResult = await cwClient.execute(
    walletAddr,
    tradeResult.contractAddress,
    registerHubMsg,
    "auto",
    "Register hub with trade contract"
  );
  console.log('Hub registered with trade contract. Tx:', registerResult.transactionHash);
} catch (error) {
  console.log('Error registering hub with trade contract:', error.message);
}

// Step 4: Update hub configuration with new trade contract address
console.log('\n4. Updating hub configuration...');
const offerAddr = process.env.OFFER || 'cosmos1h0esllwm83rvce570p7hkxea4uxdt7ges8mruh2dtu0gl9ah0srqy7cyxt';
const priceAddr = process.env.PRICE || 'cosmos1s5ntms0nxghv8gm4s46zhnaq2dc4j8avn6z5nxzcu7ecgswfzuwqqfw0zs';
const profileAddr = process.env.PROFILE || 'cosmos1mktgurawlguwqhnrukf87lq5qcnt7scqwkpm3ps2lczxxz2unvus9h00qq';

const updateConfigMsg = {
  update_config: {
    hub_owner: walletAddr,
    offer_addr: offerAddr,
    trade_addr: tradeResult.contractAddress, // New trade contract
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

const updateResult = await cwClient.execute(
  walletAddr,
  hubAddr,
  updateConfigMsg,
  "auto",
  "Update hub configuration with new trade contract"
);

console.log('Hub configuration updated. Tx:', updateResult.transactionHash);
console.log('Gas used:', updateResult.gasUsed);

// Step 5: Verify the update
console.log('\n5. Verifying hub configuration...');
const configQuery = { config: {} };
const config = await cwClient.queryContractSmart(hubAddr, configQuery);
console.log('\nHub Configuration:');
console.log('- Hub Owner:', config.hub_owner);
console.log('- Trade Contract:', config.trade_addr);
console.log('- Offer Contract:', config.offer_addr);
console.log('- Price Contract:', config.price_addr);
console.log('- Profile Contract:', config.profile_addr);

// Step 6: Update .env file with new trade contract address
console.log('\n6. Updating .env file...');
const envPath = '../app/.env';
let envContent = fs.readFileSync(envPath, 'utf8');
envContent = envContent.replace(/^TRADE=.*$/m, `TRADE=${tradeResult.contractAddress}`);
fs.writeFileSync(envPath, envContent);
console.log('.env file updated with new trade contract address');

console.log('\n✅ Trade contract deployment and hub update completed successfully!');
console.log('\nSummary:');
console.log('- Trade Contract Code ID:', uploadResult.codeId);
console.log('- Trade Contract Address:', tradeResult.contractAddress);
console.log('- Hub Address:', hubAddr);
console.log('- Transaction Hash:', updateResult.transactionHash);