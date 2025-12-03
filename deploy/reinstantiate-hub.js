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

// Contract addresses (keep existing ones)
const offerAddr = 'cosmos1c2lu59jcktxmy5cly7xcsr986vs5eqll9akd98qq7m5e5mmwux2q9pcnhe';
const tradeAddr = 'cosmos1dgcc74cucjp4kjnuhljv5jc4jypgkutxnykdjaayep9xnl0z8w7s09q6xw';
const priceAddr = 'cosmos1g0j2rxejypdkmd020an4vsv4us50sqlpkqjycm37qq38cgd4zgysxqlm2x';
const profileAddr = 'cosmos1pcnwkghflh9m3dmrwlrlgwysg2nzyzpfgujdq6h6ah2g3n3g498sjqvg6l';

// Instantiate new Hub contract
console.log('Instantiating new Hub contract...');
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
  "LocalMoney Hub v2",
  "auto",
  { admin: walletAddr }
);
console.log('New Hub contract:', hubResult.contractAddress);

// Now update the config to trigger registration with sub-contracts
console.log('\nUpdating hub configuration to register with sub-contracts...');
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

try {
  const updateResult = await cwClient.execute(
    walletAddr,
    hubResult.contractAddress,
    updateConfigMsg,
    "auto",
    "Update hub configuration and register with sub-contracts"
  );
  console.log('Update transaction:', updateResult.transactionHash);
} catch (error) {
  console.log('Update config error (might be expected if contracts need to unregister first):', error.message);
}

// Query the config to verify
console.log('\nQuerying hub configuration...');
const configQuery = { config: {} };
try {
  const config = await cwClient.queryContractSmart(hubResult.contractAddress, configQuery);
  console.log('\nHub Configuration:');
  console.log(JSON.stringify(config, null, 2));
  
  // Save the new hub address
  console.log('\n✅ New hub deployed and configured successfully!');
  console.log('New Hub Address:', hubResult.contractAddress);
  
  // Update contract-addresses.json
  const contractAddresses = {
    hub: hubResult.contractAddress,
    offer: offerAddr,
    trade: tradeAddr,
    price: priceAddr,
    profile: profileAddr
  };
  fs.writeFileSync('contract-addresses.json', JSON.stringify(contractAddresses, null, 2));
  console.log('\nContract addresses saved to contract-addresses.json');
} catch (error) {
  console.error('Error querying config:', error.message);
}