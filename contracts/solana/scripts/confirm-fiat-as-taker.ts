/**
 * Confirm fiat deposit as taker
 */
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import * as fs from "fs";

const TRADE_PROGRAM_ID = new PublicKey("5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE");
const OFFER_PROGRAM_ID = new PublicKey("CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo");

// Taker keypair
const takerSecret = [74,105,145,120,185,143,187,112,215,9,57,180,79,244,187,130,2,214,20,157,90,129,183,11,115,164,149,250,31,151,42,207,217,53,224,224,66,163,148,143,66,226,22,51,233,162,35,28,221,86,101,225,46,127,252,79,213,241,175,149,108,194,66,239];
const taker = Keypair.fromSecretKey(new Uint8Array(takerSecret));

console.log("Taker pubkey:", taker.publicKey.toBase58());

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const tradeId = new BN(4);

  // Derive PDAs
  const [tradePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("trade"), tradeId.toArrayLike(Buffer, "le", 8)],
    TRADE_PROGRAM_ID
  );
  console.log("Trade PDA:", tradePda.toBase58());

  // Fetch trade to get offer ID
  const tradeAccountInfo = await connection.getAccountInfo(tradePda);
  if (!tradeAccountInfo) {
    throw new Error("Trade account not found");
  }

  // Parse trade data to get offer_id (at offset 8+1+8 = 17)
  const offerId = new BN(tradeAccountInfo.data.slice(17, 25), "le");
  console.log("Offer ID:", offerId.toString());

  // Derive offer PDA
  const [offerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("offer"), offerId.toArrayLike(Buffer, "le", 8)],
    OFFER_PROGRAM_ID
  );
  console.log("Offer PDA:", offerPda.toBase58());

  // Load IDL
  const idl = JSON.parse(fs.readFileSync("./target/idl/trade.json", "utf8"));

  // Setup provider
  const wallet = new anchor.Wallet(taker);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const program = new anchor.Program(idl as any, provider);

  // Build confirm_fiat_deposit instruction
  console.log("\nBuilding confirm_fiat_deposit instruction...");
  const confirmFiatIx = await (program.methods as any)
    .confirmFiatDeposit()
    .accounts({
      trade: tradePda,
      offer: offerPda,
      buyer: taker.publicKey,
    })
    .instruction();

  const tx = new Transaction().add(confirmFiatIx);

  // Send transaction
  console.log("Sending transaction...");
  const sig = await provider.sendAndConfirm(tx, [taker]);
  console.log("Transaction signature:", sig);
  console.log("Fiat deposit confirmed successfully!");
}

main().catch(console.error);
