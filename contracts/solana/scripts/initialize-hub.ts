/**
 * Initialize Hub Config on devnet
 */
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import * as fs from "fs";

const HUB_PROGRAM_ID = new PublicKey("8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH");
const OFFER_PROGRAM_ID = new PublicKey("CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo");
const TRADE_PROGRAM_ID = new PublicKey("5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE");
const PROFILE_PROGRAM_ID = new PublicKey("86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5");
const ESCROW_PROGRAM_ID = new PublicKey("CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ");
const ARBITRATOR_PROGRAM_ID = new PublicKey("J5BNGJ128bxHuWemwaoGkDqy8DVSvsA7o5kpdy9eDoNe");
const PRICE_ORACLE_PROGRAM_ID = new PublicKey("CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw");

// Admin keypair - use maker as admin for testing
const adminSecretStr = fs.readFileSync("/Volumes/Pylon/workspace/localmoney/app/public/test-wallets/maker.json", "utf8");
const adminSecret = JSON.parse(adminSecretStr);
const admin = Keypair.fromSecretKey(new Uint8Array(adminSecret));

console.log("Admin pubkey:", admin.publicKey.toBase58());

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Derive Hub config PDA
  const [hubConfigPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("hub_config")],
    HUB_PROGRAM_ID
  );
  console.log("Hub Config PDA:", hubConfigPda.toBase58());
  console.log("Bump:", bump);

  // Check if hub config already exists
  const hubAccountInfo = await connection.getAccountInfo(hubConfigPda);
  if (hubAccountInfo) {
    console.log("Hub config already exists!");
    return;
  }

  // Load IDL
  const idl = JSON.parse(fs.readFileSync("./target/idl/hub.json", "utf8"));

  // Setup provider
  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const program = new anchor.Program(idl as any, provider);

  console.log("\nInitializing Hub Config...");

  const initParams = {
    offerProgram: OFFER_PROGRAM_ID,
    tradeProgram: TRADE_PROGRAM_ID,
    profileProgram: PROFILE_PROGRAM_ID,
    escrowProgram: ESCROW_PROGRAM_ID,
    arbitratorProgram: ARBITRATOR_PROGRAM_ID,
    priceOracleProgram: PRICE_ORACLE_PROGRAM_ID,
    // Fee configuration (basis points: 100 = 1%)
    burnFeePct: 0,     // 0% burn
    chainFeePct: 100,  // 1% chain fee
    warchestFeePct: 0, // 0% warchest
    conversionFeePct: 0, // 0% conversion fee
    arbitratorFeePct: 100, // 1% arbitrator fee
    // Trading limits
    minTradeAmount: new BN(1_000_000), // 1 USDC (6 decimals)
    maxTradeAmount: new BN(100_000_000_000), // 100,000 USDC
    maxActiveOffers: 10,
    maxActiveTrades: 5,
    // Timers (in seconds)
    tradeExpirationTimer: new BN(24 * 60 * 60), // 24 hours
    tradeDisputeTimer: new BN(7 * 24 * 60 * 60), // 7 days
    // Treasury addresses (use admin for testing)
    treasury: admin.publicKey,
    warchest: admin.publicKey,
  };

  const sig = await (program.methods as any)
    .initialize(initParams)
    .accounts({
      config: hubConfigPda,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([admin])
    .rpc();

  console.log("Transaction signature:", sig);
  console.log("\n✅ Hub Config initialized successfully!");
}

main().catch(console.error);
