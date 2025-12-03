import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";

// Program IDs from Anchor.toml
const TRADE_PROGRAM_ID = new PublicKey("5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE");
const ESCROW_PROGRAM_ID = new PublicKey("CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ");
const HUB_PROGRAM_ID = new PublicKey("8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH");
const PROFILE_PROGRAM_ID = new PublicKey("86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5");
const OFFER_PROGRAM_ID = new PublicKey("CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo");

const TOKEN_MINT = new PublicKey("DxGBS8nbU9EvQHJ6U5LYqnHTDbNbxoe6vdWbCuaQXnSB");
const treasury = new PublicKey("DpL29VP9joipcuLUm3wtTx2LDMA1kRMUr7A9HWuWanQ4");
const warchest = new PublicKey("5j2zTnfsqs2UVYCKY9aTKNkeuaHdZBszCzXKWDpTHZqA");

// Trade #7
const TRADE_ID = new anchor.BN(7);
const buyer = new PublicKey("Fcu81FSmGnwXerKQjCHxRwYYX2F8ftdyt1EVBEJeiqev");
const seller = new PublicKey("7gG7tH3bY7B3Anc6RmDQHoWgkNUhzXDBaTc55ikqkXxR");

// Load maker (seller) keypair to sign
const makerSecret = JSON.parse(fs.readFileSync("/Volumes/Pylon/workspace/localmoney/app/public/test-wallets/maker.json", "utf8"));
const maker = Keypair.fromSecretKey(new Uint8Array(makerSecret));

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load IDL
  const idl = JSON.parse(fs.readFileSync("./target/idl/trade.json", "utf8"));

  console.log("=== Debug release_escrow ===\n");
  console.log("Maker (releaser):", maker.publicKey.toBase58());
  console.log("Seller:", seller.toBase58());
  console.log("Match:", maker.publicKey.equals(seller));

  // Derive all PDAs
  const [tradePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("trade"), TRADE_ID.toArrayLike(Buffer, "le", 8)],
    TRADE_PROGRAM_ID
  );
  console.log("\nTrade PDA:", tradePda.toBase58());

  const [escrowVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_vault"), TRADE_ID.toArrayLike(Buffer, "le", 8)],
    ESCROW_PROGRAM_ID
  );
  console.log("Escrow vault:", escrowVault.toBase58());

  const escrowVaultTokenAccount = getAssociatedTokenAddressSync(TOKEN_MINT, escrowVault, true);
  console.log("Escrow vault ATA:", escrowVaultTokenAccount.toBase58());

  // Buyer is the recipient for Sell offer
  const recipientTokenAccount = getAssociatedTokenAddressSync(TOKEN_MINT, buyer);
  console.log("Recipient ATA (buyer):", recipientTokenAccount.toBase58());

  const treasuryTokenAccount = getAssociatedTokenAddressSync(TOKEN_MINT, treasury, true);
  console.log("Treasury ATA:", treasuryTokenAccount.toBase58());

  const warchestTokenAccount = getAssociatedTokenAddressSync(TOKEN_MINT, warchest, true);
  console.log("Warchest ATA:", warchestTokenAccount.toBase58());

  const [hubConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("hub_config")],
    HUB_PROGRAM_ID
  );
  console.log("Hub config:", hubConfig.toBase58());

  const [buyerProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), buyer.toBuffer()],
    PROFILE_PROGRAM_ID
  );
  console.log("Buyer profile:", buyerProfile.toBase58());

  const [sellerProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), seller.toBuffer()],
    PROFILE_PROGRAM_ID
  );
  console.log("Seller profile:", sellerProfile.toBase58());

  // Get offer ID from trade
  const tradeInfo = await connection.getAccountInfo(tradePda);
  if (!tradeInfo) {
    console.log("Trade not found!");
    return;
  }
  const offerId = tradeInfo.data.slice(17, 25).readBigUInt64LE();
  console.log("Offer ID:", offerId.toString());

  const [offerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("offer"), new anchor.BN(offerId.toString()).toArrayLike(Buffer, "le", 8)],
    OFFER_PROGRAM_ID
  );
  console.log("Offer PDA:", offerPda.toBase58());

  // Create anchor provider and program
  const wallet = new anchor.Wallet(maker);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new anchor.Program(idl as any, provider);

  console.log("\n=== Building transaction ===");

  const accounts = {
    trade: tradePda,
    releaser: maker.publicKey,
    escrowVault,
    escrowVaultTokenAccount,
    recipientTokenAccount,
    treasuryTokenAccount,
    warchestTokenAccount,
    arbitratorTokenAccount: null,
    hubConfig,
    buyerProfile,
    sellerProfile,
    offer: offerPda,
    escrowProgram: ESCROW_PROGRAM_ID,
    profileProgram: PROFILE_PROGRAM_ID,
    tradeProgram: TRADE_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
  };

  console.log("\nAccounts:");
  Object.entries(accounts).forEach(([key, value]) => {
    if (value) {
      console.log(`  ${key}: ${value.toString()}`);
    } else {
      console.log(`  ${key}: null`);
    }
  });

  try {
    console.log("\n=== Sending transaction ===");
    const tx = await (program.methods as any)
      .releaseEscrow()
      .accounts(accounts)
      .rpc();

    console.log("\nSuccess! Transaction:", tx);
  } catch (e: any) {
    console.log("\nError:", e.message);
    if (e.logs) {
      console.log("\nTransaction logs:");
      e.logs.forEach((log: string, i: number) => console.log(`  ${i}: ${log}`));
    }
  }
}

main();
