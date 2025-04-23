#!/usr/bin/env ts-node
/**
 * Setup script for LocalMoney test environment
 * 
 * This script:
 * 1. Checks if a local validator is running
 * 2. Airdrops SOL to test accounts
 * 3. Builds and deploys all programs (unless --no-build flag is used)
 * 4. Initializes the hub configuration
 */

import * as anchor from "@coral-xyz/anchor";
import { execSync } from "child_process";
import { Keypair, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const skipBuild = args.includes("--no-build");

// Constants
const AIRDROP_AMOUNT = parseInt(process.env.AIRDROP_AMOUNT || "100");

// Create keyfiles directory if it doesn't exist
const keyfilesDir = path.join(__dirname, "../.keypairs");
if (!fs.existsSync(keyfilesDir)) {
  fs.mkdirSync(keyfilesDir, { recursive: true });
}

// Generate or load test accounts
function getOrCreateKeypair(name: string): Keypair {
  const keypairPath = path.join(keyfilesDir, `${name}.json`);
  let keypair: Keypair;
  
  if (fs.existsSync(keypairPath)) {
    const keypairBuffer = fs.readFileSync(keypairPath, "utf-8");
    const keypairData = JSON.parse(keypairBuffer);
    keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } else {
    keypair = Keypair.generate();
    fs.writeFileSync(keypairPath, JSON.stringify(Array.from(keypair.secretKey)));
  }
  
  return keypair;
}

// Main function
async function main() {
  try {
    console.log("Setting up LocalMoney test environment...");
    
    // Check if validator is running
    const connection = new Connection("http://localhost:8899", "confirmed");
    try {
      await connection.getGenesisHash();
      console.log("✅ Local validator is running");
    } catch (err) {
      console.error("❌ Local validator not running. Please start it with 'solana-test-validator'");
      process.exit(1);
    }
    
    // Generate key pairs for test accounts
    const admin = getOrCreateKeypair("admin");
    const maker = getOrCreateKeypair("maker");
    const taker = getOrCreateKeypair("taker");
    const arbitrator = getOrCreateKeypair("arbitrator");
    
    console.log("Generated test keypairs:");
    console.log(`Admin: ${admin.publicKey.toString()}`);
    console.log(`Maker: ${maker.publicKey.toString()}`);
    console.log(`Taker: ${taker.publicKey.toString()}`);
    console.log(`Arbitrator: ${arbitrator.publicKey.toString()}`);
    
    // Airdrop SOL to test accounts
    console.log("\nAirdropping SOL to test accounts...");
    
    const accounts = [
      { name: "Admin", keypair: admin },
      { name: "Maker", keypair: maker },
      { name: "Taker", keypair: taker },
      { name: "Arbitrator", keypair: arbitrator }
    ];
    
    for (const account of accounts) {
      try {
        const signature = await connection.requestAirdrop(
          account.keypair.publicKey,
          AIRDROP_AMOUNT * LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(signature);
        console.log(`✅ Airdropped ${AIRDROP_AMOUNT} SOL to ${account.name}`);
      } catch (err) {
        console.error(`❌ Failed to airdrop to ${account.name}:`, err);
      }
    }
    
    // Build and deploy programs (skip if --no-build flag is used)
    if (!skipBuild) {
      console.log("\nBuilding and deploying programs...");
      
      try {
        // Specify localnet cluster for build
        execSync("anchor build --provider.cluster localnet", { stdio: "inherit" });
        console.log("✅ Build completed");
      } catch (err) {
        console.error("❌ Build failed:", err);
        process.exit(1);
      }
      
      try {
        // Specify localnet cluster for deploy
        execSync("anchor deploy --provider.cluster localnet", { stdio: "inherit" });
        console.log("✅ Deployment completed");
      } catch (err) {
        console.error("❌ Deployment failed:", err);
        process.exit(1);
      }
    } else {
      console.log("\n⏩ Skipping build and deploy as requested with --no-build flag");
      console.log("   Make sure programs have been built and deployed previously!");
    }
    
    // Initialize hub configuration
    console.log("\nInitializing hub configuration...");
    // Note: This is just notifying that this step needs to be done via tests
    console.log("Hub initialization should be done via the integration tests");
    
    console.log("\n✅ Test environment setup complete!");
    console.log("You can now run 'npm run test:integration' to run the integration tests");
    
  } catch (err) {
    console.error("❌ Setup failed:", err);
    process.exit(1);
  }
}

main(); 