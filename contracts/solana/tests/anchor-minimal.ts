import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Connection, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import { PROGRAM_IDS } from "./config";
import * as fs from 'fs';
import * as path from 'path';

describe("LocalMoney Anchor Minimal Test", () => {
  // Create a connection to the local validator
  const connection = new Connection("http://localhost:8899", "confirmed");
  
  // Create a wallet for testing
  const wallet = new anchor.Wallet(Keypair.generate());
  
  // Create a provider manually rather than using environment variables
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );
  
  // Set the provider globally
  anchor.setProvider(provider);

  // Get program ID
  const hubProgramId = PROGRAM_IDS.hub;
  
  // Check if IDL file exists
  const idlPath = path.join(__dirname, "..", "target", "idl", "hub.json");
  const idlExists = fs.existsSync(idlPath);
  
  // Skip entire suite if IDL doesn't exist
  before(function() {
    if (!idlExists) {
      console.log("Hub IDL not found at", idlPath);
      console.log("Skipping all tests. Make sure to build with 'anchor build' first.");
      this.skip();
    }
  });
  
  // Only try to load and use the IDL if it exists
  let hubProgram;
  if (idlExists) {
    const hubIdl = require(idlPath);
    hubProgram = new anchor.Program(hubIdl, hubProgramId, provider);
  }

  // Create test account
  const admin = anchor.web3.Keypair.generate();

  // Calculate hub PDA
  const [hubPda, hubBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("hub")],
    hubProgramId
  );

  // Before hook to airdrop SOL to admin
  before(async function() {
    // Skip if we already skipped due to missing IDL
    if (!idlExists) return;
    
    // Airdrop SOL to admin
    const airdropSig = await provider.connection.requestAirdrop(
      admin.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);
    console.log(`Airdropped 2 SOL to admin: ${admin.publicKey.toString()}`);
    
    // Also airdrop to the wallet used in the provider
    const walletAirdropSig = await provider.connection.requestAirdrop(
      wallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(walletAirdropSig);
    console.log(`Airdropped 2 SOL to wallet: ${wallet.publicKey.toString()}`);
  });

  it("Initialize hub", async function() {
    console.log("Initializing hub...");

    try {
      // Initialize hub
      await hubProgram.methods
        .initialize({
          commissionBps: 100, // 1% fee
          arbitratorCut: 50   // 50% of fee to arbitrator
        })
        .accounts({
          admin: admin.publicKey,
          hub: hubPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      // Fetch the hub account
      const hubAccount = await hubProgram.account.hub.fetch(hubPda);
      
      // Verify config
      assert.equal(hubAccount.config.commissionBps, 100, "Hub commission should be 100 bps");
      assert.equal(hubAccount.config.arbitratorCut, 50, "Arbitrator cut should be 50%");
      
      console.log("✅ Hub initialized successfully");
    } catch (error) {
      console.error("Error interacting with hub program:", error);
      throw error;
    }
  });
}); 