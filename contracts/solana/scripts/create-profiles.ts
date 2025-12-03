import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";

const PROFILE_PROGRAM_ID = new PublicKey("86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5");

// Maker keypair
const makerSecret = [248,94,213,164,112,141,139,195,31,7,238,176,139,182,63,237,115,70,133,153,137,122,246,198,248,154,75,64,132,28,6,155,99,52,222,44,194,173,83,248,207,130,85,70,8,27,127,6,243,155,174,154,114,14,21,83,116,0,197,59,151,154,252,158];
// Taker keypair
const takerSecret = [74,105,145,120,185,143,187,112,215,9,57,180,79,244,187,130,2,214,20,157,90,129,183,11,115,164,149,250,31,151,42,207,217,53,224,224,66,163,148,143,66,226,22,51,233,162,35,28,221,86,101,225,46,127,252,79,213,241,175,149,108,194,66,239];

const maker = Keypair.fromSecretKey(new Uint8Array(makerSecret));
const taker = Keypair.fromSecretKey(new Uint8Array(takerSecret));

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load profile IDL
  const idl = JSON.parse(fs.readFileSync("./target/idl/profile.json", "utf8"));

  console.log("Creating profiles...");
  console.log("Maker:", maker.publicKey.toBase58());
  console.log("Taker:", taker.publicKey.toBase58());

  // Create profiles for both
  const users: [string, Keypair][] = [["Maker", maker], ["Taker", taker]];

  for (const [name, user] of users) {
    const wallet = new anchor.Wallet(user);
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = new anchor.Program(idl as any, provider);

    const [profilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), user.publicKey.toBuffer()],
      PROFILE_PROGRAM_ID
    );

    // Check if profile exists
    const profileInfo = await connection.getAccountInfo(profilePda);
    if (profileInfo) {
      console.log(`${name} profile already exists at:`, profilePda.toBase58());
      continue;
    }

    console.log(`Creating ${name} profile at:`, profilePda.toBase58());

    try {
      const tx = await (program.methods as any)
        .createProfile({
          contactInfo: `@${name.toLowerCase()}_test`,
          encryptionKey: "",
        })
        .accounts({
          profile: profilePda,
          user: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();
      console.log(`${name} profile created, tx:`, tx);
    } catch (e: any) {
      console.log(`${name} profile creation failed:`, e.message);
    }
  }
}

main();
