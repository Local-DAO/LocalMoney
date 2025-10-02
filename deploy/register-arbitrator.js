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
const tradeAddr = process.env.TRADE || 'cosmos1dgcc74cucjp4kjnuhljv5jc4jypgkutxnykdjaayep9xnl0z8w7s09q6xw';

// Available fiat currencies from app/src/utils/fiats-config.json
const fiatCurrencies = [
  'USD', 'ARS', 'BRL', 'CAD', 'CLP', 'COP', 
  'EUR', 'GBP', 'MXN', 'NGN', 'THB', 'VES',
  'IDR', 'MYR', 'PHP', 'SGD', 'VND'
];

// Encryption key for the arbitrator (you may want to generate a unique one)
const encryptionKey = process.env.ARBITRATOR_ENCRYPTION_KEY || 'arbitrator_public_encryption_key';

console.log('\nRegistering admin as arbitrator for all fiat currencies...');
console.log('Trade contract:', tradeAddr);
console.log('Fiat currencies:', fiatCurrencies.join(', '));
console.log('----------------------------------------\n');

let successCount = 0;
let failedCurrencies = [];

for (const fiat of fiatCurrencies) {
  console.log(`Registering arbitrator for ${fiat}...`);
  
  try {
    const newArbitratorMsg = {
      new_arbitrator: {
        arbitrator: walletAddr,
        fiat: fiat,
        encryption_key: encryptionKey
      }
    };
    
    const result = await cwClient.execute(
      walletAddr,
      tradeAddr,
      newArbitratorMsg,
      "auto",
      `Register arbitrator for ${fiat}`
    );
    
    console.log(`✅ ${fiat} registered. Tx: ${result.transactionHash}`);
    successCount++;
  } catch (error) {
    console.log(`❌ Error registering arbitrator for ${fiat}: ${error.message}`);
    failedCurrencies.push(fiat);
  }
}

console.log('\n----------------------------------------');
console.log(`Registration complete!`);
console.log(`✅ Successfully registered: ${successCount}/${fiatCurrencies.length} currencies`);

if (failedCurrencies.length > 0) {
  console.log(`❌ Failed currencies: ${failedCurrencies.join(', ')}`);
}

// Query arbitrators to verify registration
console.log('\n----------------------------------------');
console.log('Verifying arbitrator registrations...\n');

for (const fiat of fiatCurrencies) {
  if (!failedCurrencies.includes(fiat)) {
    try {
      const arbitratorQuery = {
        arbitrator: {
          arbitrator: walletAddr,
          fiat: fiat
        }
      };
      
      const arbitratorInfo = await cwClient.queryContractSmart(tradeAddr, arbitratorQuery);
      console.log(`${fiat}: Verified ✅`);
    } catch (error) {
      console.log(`${fiat}: Not found or query failed ⚠️`);
    }
  }
}

console.log('\n✨ Arbitrator registration script completed!');