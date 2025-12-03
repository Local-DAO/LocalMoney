/**
 * Fund escrow as taker (workaround for inverted contract logic)
 * The deployed contract expects taker to fund for Sell offers, which is wrong
 * but we need to work around it for testing
 */
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";

const TRADE_PROGRAM_ID = new PublicKey("5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE");
const ESCROW_PROGRAM_ID = new PublicKey("CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ");
const OFFER_PROGRAM_ID = new PublicKey("CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo");
// Token used in Trade #5 (DxGBS8nbU9EvQHJ6U5LYqnHTDbNbxoe6vdWbCuaQXnSB)
const TOKEN_MINT = new PublicKey("DxGBS8nbU9EvQHJ6U5LYqnHTDbNbxoe6vdWbCuaQXnSB");

// Taker keypair
const takerSecret = [74,105,145,120,185,143,187,112,215,9,57,180,79,244,187,130,2,214,20,157,90,129,183,11,115,164,149,250,31,151,42,207,217,53,224,224,66,163,148,143,66,226,22,51,233,162,35,28,221,86,101,225,46,127,252,79,213,241,175,149,108,194,66,239];
const taker = Keypair.fromSecretKey(new Uint8Array(takerSecret));

console.log("Taker pubkey:", taker.publicKey.toBase58());

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const tradeId = new BN(5); // Trade #5 is in RequestAccepted state

  // Derive PDAs
  const [tradePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("trade"), tradeId.toArrayLike(Buffer, "le", 8)],
    TRADE_PROGRAM_ID
  );
  console.log("Trade PDA:", tradePda.toBase58());

  const [escrowVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_vault"), tradeId.toArrayLike(Buffer, "le", 8)],
    ESCROW_PROGRAM_ID
  );
  console.log("Escrow Vault PDA:", escrowVaultPda.toBase58());

  // Get escrow vault's token account (ATA)
  const escrowVaultTokenAccount = getAssociatedTokenAddressSync(
    TOKEN_MINT,
    escrowVaultPda,
    true // allowOwnerOffCurve
  );
  console.log("Escrow Vault Token Account (ATA):", escrowVaultTokenAccount.toBase58());

  // Get funder's token account
  const funderTokenAccount = getAssociatedTokenAddressSync(
    TOKEN_MINT,
    taker.publicKey
  );
  console.log("Funder Token Account:", funderTokenAccount.toBase58());

  // Fetch trade to get offer ID
  const tradeAccountInfo = await connection.getAccountInfo(tradePda);
  if (!tradeAccountInfo) {
    throw new Error("Trade account not found");
  }

  // Parse trade data to get offer_id (at offset 8+1+8 = 17, which is after discriminator, bump, and id)
  const offerId = new BN(tradeAccountInfo.data.slice(17, 25), "le");
  console.log("Offer ID:", offerId.toString());

  // Derive offer PDA
  const [offerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("offer"), offerId.toArrayLike(Buffer, "le", 8)],
    OFFER_PROGRAM_ID
  );
  console.log("Offer PDA:", offerPda.toBase58());

  // Load IDL
  const fs = await import("fs");
  const idl = JSON.parse(fs.readFileSync("./target/idl/trade.json", "utf8"));

  // Setup provider
  const wallet = new anchor.Wallet(taker);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const program = new anchor.Program(idl as any, provider);

  const tx = new Transaction();

  // Check if escrow vault ATA exists, create if not
  const escrowVaultAccountInfo = await connection.getAccountInfo(escrowVaultTokenAccount);
  if (!escrowVaultAccountInfo) {
    console.log("Creating escrow vault ATA...");
    const createAtaIx = createAssociatedTokenAccountInstruction(
      taker.publicKey,
      escrowVaultTokenAccount,
      escrowVaultPda,
      TOKEN_MINT,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    tx.add(createAtaIx);
  }

  // Build fund_escrow instruction
  // OLD IDL accounts (6 accounts, no CPI):
  // trade, funder, funder_token_account, escrow_vault, offer, token_program
  const fundEscrowIx = await (program.methods as any)
    .fundEscrow()
    .accounts({
      trade: tradePda,
      funder: taker.publicKey,
      funderTokenAccount: funderTokenAccount,
      escrowVault: escrowVaultTokenAccount, // The token account, not the state PDA
      offer: offerPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  tx.add(fundEscrowIx);

  // Send transaction
  console.log("\nSending transaction...");
  const sig = await provider.sendAndConfirm(tx, [taker]);
  console.log("Transaction signature:", sig);
  console.log("Escrow funded successfully!");
}

main().catch(console.error);
