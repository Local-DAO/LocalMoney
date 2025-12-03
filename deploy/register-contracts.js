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
const hubAddr = 'cosmos1ars7lex2nenmxhdu8wfc0r7ux64kp4h37t4l2hxuft65qaszg27qneg6uw';
const offerAddr = 'cosmos1c2lu59jcktxmy5cly7xcsr986vs5eqll9akd98qq7m5e5mmwux2q9pcnhe';
const tradeAddr = 'cosmos1dgcc74cucjp4kjnuhljv5jc4jypgkutxnykdjaayep9xnl0z8w7s09q6xw';
const profileAddr = 'cosmos1pcnwkghflh9m3dmrwlrlgwysg2nzyzpfgujdq6h6ah2g3n3g498sjqvg6l';

// Register hub with offer contract
console.log('Registering hub with offer contract...');
try {
  const registerHubOfferMsg = {
    register_hub: {
      hub_addr: hubAddr
    }
  };
  const offerResult = await cwClient.execute(
    walletAddr,
    offerAddr,
    registerHubOfferMsg,
    "auto",
    "Register hub with offer contract"
  );
  console.log('Offer contract registered. Tx:', offerResult.transactionHash);
} catch (error) {
  console.log('Error registering hub with offer contract:', error.message);
}

// Register hub with trade contract
console.log('Registering hub with trade contract...');
try {
  const registerHubTradeMsg = {
    register_hub: {
      hub_addr: hubAddr
    }
  };
  const tradeResult = await cwClient.execute(
    walletAddr,
    tradeAddr,
    registerHubTradeMsg,
    "auto",
    "Register hub with trade contract"
  );
  console.log('Trade contract registered. Tx:', tradeResult.transactionHash);
} catch (error) {
  console.log('Error registering hub with trade contract:', error.message);
}

// Register hub with profile contract
console.log('Registering hub with profile contract...');
try {
  const registerHubProfileMsg = {
    register_hub: {
      hub_addr: hubAddr
    }
  };
  const profileResult = await cwClient.execute(
    walletAddr,
    profileAddr,
    registerHubProfileMsg,
    "auto",
    "Register hub with profile contract"
  );
  console.log('Profile contract registered. Tx:', profileResult.transactionHash);
} catch (error) {
  console.log('Error registering hub with profile contract:', error.message);
}

console.log('All contracts registered with hub!');