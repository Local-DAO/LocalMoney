/**
 * Initialize Devnet Programs
 *
 * This script initializes the Hub, Offer Counter, Trade Counter, and Price Oracle
 * on Solana Devnet.
 */

import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { DEVNET_PROGRAM_IDS } from '../src/index';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Import IDLs
import hubIdl from '../src/idl/hub.json';
import offerIdl from '../src/idl/offer.json';
import tradeIdl from '../src/idl/trade.json';
import priceOracleIdl from '../src/idl/price_oracle.json';

const { BN } = anchor;

// Load the default Solana keypair
function loadKeypair(): Keypair {
  const keypairPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

async function main() {
  console.log('🔧 Initializing Devnet Programs...\n');

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const keypair = loadKeypair();

  console.log(`Admin wallet: ${keypair.publicKey.toBase58()}`);

  // Check balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL\n`);

  if (balance < 0.1 * 1e9) {
    console.log('⚠️  Low balance. Requesting airdrop...');
    const sig = await connection.requestAirdrop(keypair.publicKey, 2 * 1e9);
    await connection.confirmTransaction(sig);
    console.log('Airdrop received!\n');
  }

  // Create Anchor provider
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  // 1. Initialize Offer Counter
  console.log('📍 Checking Offer counter...');
  try {
    const offerProgram = new anchor.Program(offerIdl as anchor.Idl, provider);

    // Derive offer counter PDA
    const [offerCounterPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('offer_counter')],
      DEVNET_PROGRAM_IDS.OFFER
    );

    console.log(`   Offer counter PDA: ${offerCounterPDA.toBase58()}`);

    // Check if it exists
    const accountInfo = await connection.getAccountInfo(offerCounterPDA);
    if (accountInfo) {
      console.log('✅ Offer counter already initialized');
    } else {
      // Initialize it
      const tx = await (offerProgram.methods as any)
        .initializeCounter()
        .accounts({
          offerCounter: offerCounterPDA,
          admin: keypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Offer counter initialized! Tx: ${tx}`);
    }
  } catch (e: any) {
    console.error('Offer counter init error:', e.message);
  }

  // 2. Initialize Trade Counter
  console.log('\n📍 Checking Trade counter...');
  try {
    const tradeProgram = new anchor.Program(tradeIdl as anchor.Idl, provider);

    // Derive trade counter PDA
    const [tradeCounterPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('trade_counter')],
      DEVNET_PROGRAM_IDS.TRADE
    );

    console.log(`   Trade counter PDA: ${tradeCounterPDA.toBase58()}`);

    // Check if it exists
    const accountInfo = await connection.getAccountInfo(tradeCounterPDA);
    if (accountInfo) {
      console.log('✅ Trade counter already initialized');
    } else {
      // Initialize it
      const tx = await (tradeProgram.methods as any)
        .initializeCounter()
        .accounts({
          counter: tradeCounterPDA,
          admin: keypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Trade counter initialized! Tx: ${tx}`);
    }
  } catch (e: any) {
    console.error('Trade counter init error:', e.message);
  }

  // 3. Initialize Price Oracle Registry (renumbered)
  console.log('\n📍 Checking Price Oracle registry...');
  try {
    const priceOracleProgram = new anchor.Program(priceOracleIdl as anchor.Idl, provider);

    // Derive registry PDA
    const [registryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('price_provider_registry')],
      DEVNET_PROGRAM_IDS.PRICE_ORACLE
    );

    console.log(`   Registry PDA: ${registryPDA.toBase58()}`);

    const accountInfo = await connection.getAccountInfo(registryPDA);
    if (accountInfo) {
      console.log('✅ Price Oracle registry already initialized');
    } else {
      const tx = await (priceOracleProgram.methods as any)
        .initializeRegistry({ maxPriceStaleness: new BN(3600) })
        .accounts({
          registry: registryPDA,
          admin: keypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Price Oracle registry initialized! Tx: ${tx}`);
    }
  } catch (e: any) {
    console.error('Price Oracle init error:', e.message);
  }

  // Fiat to bytes helper - must be 3 bytes to match on-chain program
  function fiatToBytes(fiat: string): number[] {
    const bytes = new Array(3).fill(0);
    for (let i = 0; i < Math.min(fiat.length, 3); i++) {
      bytes[i] = fiat.charCodeAt(i);
    }
    return bytes;
  }

  // 4. Initialize USD price
  console.log('\n📍 Checking USD price...');
  try {
    const priceOracleProgram = new anchor.Program(priceOracleIdl as anchor.Idl, provider);

    const [registryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('price_provider_registry')],
      DEVNET_PROGRAM_IDS.PRICE_ORACLE
    );

    const usdBytes = fiatToBytes('USD');
    const [pricePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('price'), Buffer.from(usdBytes)],
      DEVNET_PROGRAM_IDS.PRICE_ORACLE
    );

    console.log(`   USD Price PDA: ${pricePDA.toBase58()}`);

    const accountInfo = await connection.getAccountInfo(pricePDA);
    if (accountInfo) {
      console.log('✅ USD price already initialized');
    } else {
      const tx = await (priceOracleProgram.methods as any)
        .initializePrice(usdBytes, {
          initialValue: new BN(100_000_000), // 1.00 USD with 8 decimals
          decimals: 8,
          minPrice: new BN(1),
          maxPrice: new BN(1_000_000_000_000),
        })
        .accounts({
          registry: registryPDA,
          price: pricePDA,
          admin: keypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ USD price initialized! Tx: ${tx}`);
    }
  } catch (e: any) {
    console.error('USD price init error:', e.message);
  }

  // 5. Initialize COP price
  console.log('\n📍 Checking COP price...');
  try {
    const priceOracleProgram = new anchor.Program(priceOracleIdl as anchor.Idl, provider);

    const [registryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('price_provider_registry')],
      DEVNET_PROGRAM_IDS.PRICE_ORACLE
    );

    const copBytes = fiatToBytes('COP');
    const [pricePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('price'), Buffer.from(copBytes)],
      DEVNET_PROGRAM_IDS.PRICE_ORACLE
    );

    console.log(`   COP Price PDA: ${pricePDA.toBase58()}`);

    const accountInfo = await connection.getAccountInfo(pricePDA);
    if (accountInfo) {
      console.log('✅ COP price already initialized');
    } else {
      const tx = await (priceOracleProgram.methods as any)
        .initializePrice(copBytes, {
          initialValue: new BN(405000_000_000), // 4050 COP per USD with 8 decimals
          decimals: 8,
          minPrice: new BN(1),
          maxPrice: new BN(100_000_000_000_000),
        })
        .accounts({
          registry: registryPDA,
          price: pricePDA,
          admin: keypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ COP price initialized! Tx: ${tx}`);
    }
  } catch (e: any) {
    console.error('COP price init error:', e.message);
  }

  // 6. Initialize Hub config
  console.log('\n📍 Checking Hub config...');
  try {
    const hubProgram = new anchor.Program(hubIdl as anchor.Idl, provider);

    const [hubConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('hub_config')],
      DEVNET_PROGRAM_IDS.HUB
    );

    console.log(`   Hub config PDA: ${hubConfigPDA.toBase58()}`);

    const accountInfo = await connection.getAccountInfo(hubConfigPDA);
    if (accountInfo) {
      console.log('✅ Hub already initialized');
    } else {
      const tx = await (hubProgram.methods as any)
        .initialize({
          burnFeePct: 50,
          chainFeePct: 100,
          warchestFeePct: 50,
          conversionFeePct: 100,
          arbitratorFeePct: 100,
          minTradeAmount: new BN(1_000_000),
          maxTradeAmount: new BN(100_000_000_000),
          maxActiveOffers: 100,
          maxActiveTrades: 100,
          tradeExpirationTimer: new BN(86400),
          tradeDisputeTimer: new BN(172800),
          offerProgram: DEVNET_PROGRAM_IDS.OFFER,
          tradeProgram: DEVNET_PROGRAM_IDS.TRADE,
          profileProgram: DEVNET_PROGRAM_IDS.PROFILE,
          escrowProgram: DEVNET_PROGRAM_IDS.ESCROW,
          arbitratorProgram: DEVNET_PROGRAM_IDS.ARBITRATOR,
          priceOracleProgram: DEVNET_PROGRAM_IDS.PRICE_ORACLE,
          treasury: keypair.publicKey,
          warchest: keypair.publicKey,
        })
        .accounts({
          hubConfig: hubConfigPDA,
          admin: keypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Hub initialized! Tx: ${tx}`);
    }
  } catch (e: any) {
    console.error('Hub init error:', e.message);
  }

  console.log('\n🎉 Devnet initialization complete!');
}

main().catch(console.error);
