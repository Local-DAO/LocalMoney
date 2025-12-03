/**
 * Release escrow as maker (seller)
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
import * as fs from "fs";

const TRADE_PROGRAM_ID = new PublicKey("5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE");
const ESCROW_PROGRAM_ID = new PublicKey("CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ");
const OFFER_PROGRAM_ID = new PublicKey("CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo");
const HUB_PROGRAM_ID = new PublicKey("8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH");
const PROFILE_PROGRAM_ID = new PublicKey("86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5");
const TOKEN_MINT = new PublicKey("DxGBS8nbU9EvQHJ6U5LYqnHTDbNbxoe6vdWbCuaQXnSB");

// Maker keypair - read from test-wallets
const makerSecretStr = fs.readFileSync("/Volumes/Pylon/workspace/localmoney/app/public/test-wallets/maker.json", "utf8");
const makerSecret = JSON.parse(makerSecretStr);
const maker = Keypair.fromSecretKey(new Uint8Array(makerSecret));

// Taker pubkey (recipient of escrow funds for Sell offer)
const takerPubkey = new PublicKey("Fcu81FSmGnwXerKQjCHxRwYYX2F8ftdyt1EVBEJeiqev");

console.log("Maker pubkey:", maker.publicKey.toBase58());
console.log("Taker pubkey:", takerPubkey.toBase58());

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const tradeId = new BN(4);

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

  // Get recipient's token account (taker for Sell offer)
  const recipientTokenAccount = getAssociatedTokenAddressSync(
    TOKEN_MINT,
    takerPubkey
  );
  console.log("Recipient Token Account:", recipientTokenAccount.toBase58());

  // Derive Hub config PDA
  const [hubConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("hub_config")],
    HUB_PROGRAM_ID
  );
  console.log("Hub Config PDA:", hubConfigPda.toBase58());

  // Fetch hub config to get treasury and warchest
  const hubAccountInfo = await connection.getAccountInfo(hubConfigPda);
  if (!hubAccountInfo) {
    throw new Error("Hub config not found");
  }

  // Parse hub config to get treasury and warchest
  // HubConfig layout (after discriminator):
  // bump (1) + admin (32) + offer_program (32) + trade_program (32) + profile_program (32) + escrow_program (32) + arbitrator_program (32) + price_oracle_program (32)
  // + burn_fee_pct (2) + chain_fee_pct (2) + warchest_fee_pct (2) + conversion_fee_pct (2) + arbitrator_fee_pct (2)
  // + min_trade_amount (8) + max_trade_amount (8) + max_active_offers (1) + max_active_trades (1)
  // + trade_expiration_timer (8) + trade_dispute_timer (8)
  // + global_pause (1) + pause_new_offers (1) + pause_new_trades (1) + pause_escrow_funding (1) + pause_escrow_release (1)
  // + treasury (32) + warchest (32)

  // Let's manually calculate offset for treasury:
  // 8 (disc) + 1 (bump) + 32 (admin) + 6*32 (programs) + 5*2 (fees) + 2*8 (amounts) + 2 (active limits) + 2*8 (timers) + 5 (pauses)
  // = 8 + 1 + 32 + 192 + 10 + 16 + 2 + 16 + 5 = 282
  const treasuryOffset = 282;
  const treasuryPubkey = new PublicKey(hubAccountInfo.data.slice(treasuryOffset, treasuryOffset + 32));
  const warchestPubkey = new PublicKey(hubAccountInfo.data.slice(treasuryOffset + 32, treasuryOffset + 64));
  console.log("Treasury:", treasuryPubkey.toBase58());
  console.log("Warchest:", warchestPubkey.toBase58());

  // Treasury token account
  const treasuryTokenAccount = getAssociatedTokenAddressSync(
    TOKEN_MINT,
    treasuryPubkey
  );
  console.log("Treasury Token Account:", treasuryTokenAccount.toBase58());

  // Warchest token account
  const warchestTokenAccount = getAssociatedTokenAddressSync(
    TOKEN_MINT,
    warchestPubkey
  );
  console.log("Warchest Token Account:", warchestTokenAccount.toBase58());

  // Derive buyer and seller profile PDAs
  const [buyerProfilePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), takerPubkey.toBuffer()],
    PROFILE_PROGRAM_ID
  );
  console.log("Buyer Profile PDA:", buyerProfilePda.toBase58());

  const [sellerProfilePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), maker.publicKey.toBuffer()],
    PROFILE_PROGRAM_ID
  );
  console.log("Seller Profile PDA:", sellerProfilePda.toBase58());

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
  const wallet = new anchor.Wallet(maker);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const program = new anchor.Program(idl as any, provider);

  const tx = new Transaction();

  // Check if recipient token account exists, create if not
  const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
  if (!recipientAccountInfo) {
    console.log("Creating recipient token account...");
    const createAtaIx = createAssociatedTokenAccountInstruction(
      maker.publicKey,
      recipientTokenAccount,
      takerPubkey,
      TOKEN_MINT,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    tx.add(createAtaIx);
  }

  // Check if treasury token account exists, create if not
  const treasuryAccountInfo = await connection.getAccountInfo(treasuryTokenAccount);
  if (!treasuryAccountInfo) {
    console.log("Creating treasury token account...");
    const createTreasuryAtaIx = createAssociatedTokenAccountInstruction(
      maker.publicKey,
      treasuryTokenAccount,
      treasuryPubkey,
      TOKEN_MINT,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    tx.add(createTreasuryAtaIx);
  }

  // Check if warchest token account exists, create if not (only if different from treasury)
  if (!warchestPubkey.equals(treasuryPubkey)) {
    const warchestAccountInfo = await connection.getAccountInfo(warchestTokenAccount);
    if (!warchestAccountInfo) {
      console.log("Creating warchest token account...");
      const createWarchestAtaIx = createAssociatedTokenAccountInstruction(
        maker.publicKey,
        warchestTokenAccount,
        warchestPubkey,
        TOKEN_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      tx.add(createWarchestAtaIx);
    }
  } else {
    console.log("Warchest == Treasury, using same token account");
  }

  // Build release_escrow instruction
  console.log("\nBuilding release_escrow instruction...");
  const releaseEscrowIx = await (program.methods as any)
    .releaseEscrow()
    .accounts({
      trade: tradePda,
      releaser: maker.publicKey,
      escrowVault: escrowVaultPda,
      escrowVaultTokenAccount: escrowVaultTokenAccount,
      recipientTokenAccount: recipientTokenAccount,
      treasuryTokenAccount: treasuryTokenAccount,
      warchestTokenAccount: warchestTokenAccount,
      arbitratorTokenAccount: null, // Not disputed
      hubConfig: hubConfigPda,
      buyerProfile: buyerProfilePda,
      sellerProfile: sellerProfilePda,
      offer: offerPda,
      escrowProgram: ESCROW_PROGRAM_ID,
      profileProgram: PROFILE_PROGRAM_ID,
      tradeProgram: TRADE_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  tx.add(releaseEscrowIx);

  // Send transaction
  console.log("Sending transaction...");
  const sig = await provider.sendAndConfirm(tx, [maker]);
  console.log("Transaction signature:", sig);
  console.log("\n🎉 Escrow released successfully! Trade complete!");
}

main().catch(console.error);
