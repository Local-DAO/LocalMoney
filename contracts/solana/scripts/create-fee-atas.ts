import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";

const TOKEN_MINT = new PublicKey("DxGBS8nbU9EvQHJ6U5LYqnHTDbNbxoe6vdWbCuaQXnSB");
const treasury = new PublicKey("DpL29VP9joipcuLUm3wtTx2LDMA1kRMUr7A9HWuWanQ4");
const warchest = new PublicKey("5j2zTnfsqs2UVYCKY9aTKNkeuaHdZBszCzXKWDpTHZqA");

// Maker keypair to pay for ATA creation
const makerSecret = JSON.parse(fs.readFileSync("../app/public/test-wallets/maker.json", "utf8"));
const maker = Keypair.fromSecretKey(new Uint8Array(makerSecret));

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  console.log("Creating fee ATAs...");
  console.log("Payer:", maker.publicKey.toBase58());

  const tx = new Transaction();

  // Treasury ATA
  const treasuryAta = getAssociatedTokenAddressSync(TOKEN_MINT, treasury, true);
  console.log("Treasury ATA:", treasuryAta.toBase58());
  const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta);
  if (!treasuryAtaInfo) {
    console.log("Creating Treasury ATA...");
    tx.add(
      createAssociatedTokenAccountInstruction(
        maker.publicKey,
        treasuryAta,
        treasury,
        TOKEN_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  } else {
    console.log("Treasury ATA already exists");
  }

  // Warchest ATA
  const warchestAta = getAssociatedTokenAddressSync(TOKEN_MINT, warchest, true);
  console.log("Warchest ATA:", warchestAta.toBase58());
  const warchestAtaInfo = await connection.getAccountInfo(warchestAta);
  if (!warchestAtaInfo) {
    console.log("Creating Warchest ATA...");
    tx.add(
      createAssociatedTokenAccountInstruction(
        maker.publicKey,
        warchestAta,
        warchest,
        TOKEN_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  } else {
    console.log("Warchest ATA already exists");
  }

  if (tx.instructions.length > 0) {
    const sig = await connection.sendTransaction(tx, [maker]);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("Transaction signature:", sig);
    console.log("ATAs created successfully!");
  } else {
    console.log("No ATAs to create");
  }
}

main();
