import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";

const PROFILE_PROGRAM_ID = new PublicKey("86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5");
const ESCROW_PROGRAM_ID = new PublicKey("CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ");
const HUB_PROGRAM_ID = new PublicKey("8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH");
const TOKEN_MINT = new PublicKey("DxGBS8nbU9EvQHJ6U5LYqnHTDbNbxoe6vdWbCuaQXnSB");

const buyer = new PublicKey("Fcu81FSmGnwXerKQjCHxRwYYX2F8ftdyt1EVBEJeiqev");
const seller = new PublicKey("7gG7tH3bY7B3Anc6RmDQHoWgkNUhzXDBaTc55ikqkXxR");

const treasury = new PublicKey("DpL29VP9joipcuLUm3wtTx2LDMA1kRMUr7A9HWuWanQ4");
const warchest = new PublicKey("5j2zTnfsqs2UVYCKY9aTKNkeuaHdZBszCzXKWDpTHZqA");

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  console.log("=== Checking all accounts for release_escrow ===\n");

  // Trade #6
  const tradeId = new anchor.BN(6);

  // Escrow Vault
  const [escrowVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_vault"), tradeId.toArrayLike(Buffer, "le", 8)],
    ESCROW_PROGRAM_ID
  );
  console.log("1. Escrow vault:", escrowVault.toBase58());
  const escrowVaultInfo = await connection.getAccountInfo(escrowVault);
  console.log("   Exists:", escrowVaultInfo ? `YES (${escrowVaultInfo.data.length} bytes, owner: ${escrowVaultInfo.owner.toBase58()})` : "NO");

  // Escrow vault token account
  const escrowVaultAta = getAssociatedTokenAddressSync(TOKEN_MINT, escrowVault, true);
  console.log("2. Escrow vault token account:", escrowVaultAta.toBase58());
  const escrowVaultAtaInfo = await connection.getAccountInfo(escrowVaultAta);
  console.log("   Exists:", escrowVaultAtaInfo ? `YES (${escrowVaultAtaInfo.data.length} bytes)` : "NO");

  // Buyer token account (recipient for Sell offer)
  const buyerAta = getAssociatedTokenAddressSync(TOKEN_MINT, buyer);
  console.log("3. Buyer ATA (recipient):", buyerAta.toBase58());
  const buyerAtaInfo = await connection.getAccountInfo(buyerAta);
  console.log("   Exists:", buyerAtaInfo ? `YES (${buyerAtaInfo.data.length} bytes)` : "NO");

  // Treasury token account
  const treasuryAta = getAssociatedTokenAddressSync(TOKEN_MINT, treasury, true);
  console.log("4. Treasury ATA:", treasuryAta.toBase58());
  const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta);
  console.log("   Exists:", treasuryAtaInfo ? `YES (${treasuryAtaInfo.data.length} bytes)` : "NO");

  // Warchest token account
  const warchestAta = getAssociatedTokenAddressSync(TOKEN_MINT, warchest, true);
  console.log("5. Warchest ATA:", warchestAta.toBase58());
  const warchestAtaInfo = await connection.getAccountInfo(warchestAta);
  console.log("   Exists:", warchestAtaInfo ? `YES (${warchestAtaInfo.data.length} bytes)` : "NO");

  // Hub config
  const [hubConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("hub_config")],
    HUB_PROGRAM_ID
  );
  console.log("6. Hub config:", hubConfig.toBase58());
  const hubConfigInfo = await connection.getAccountInfo(hubConfig);
  console.log("   Exists:", hubConfigInfo ? `YES (${hubConfigInfo.data.length} bytes, owner: ${hubConfigInfo.owner.toBase58()})` : "NO");

  // Buyer profile
  const [buyerProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), buyer.toBuffer()],
    PROFILE_PROGRAM_ID
  );
  console.log("7. Buyer profile:", buyerProfile.toBase58());
  const buyerProfileInfo = await connection.getAccountInfo(buyerProfile);
  console.log("   Exists:", buyerProfileInfo ? `YES (${buyerProfileInfo.data.length} bytes, owner: ${buyerProfileInfo.owner.toBase58()})` : "NO");

  // Seller profile
  const [sellerProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), seller.toBuffer()],
    PROFILE_PROGRAM_ID
  );
  console.log("8. Seller profile:", sellerProfile.toBase58());
  const sellerProfileInfo = await connection.getAccountInfo(sellerProfile);
  console.log("   Exists:", sellerProfileInfo ? `YES (${sellerProfileInfo.data.length} bytes, owner: ${sellerProfileInfo.owner.toBase58()})` : "NO");

  // Check if profile program matches
  console.log("\n=== Program IDs ===");
  console.log("Profile program (expected):", PROFILE_PROGRAM_ID.toBase58());
  if (buyerProfileInfo) {
    console.log("Buyer profile owner:", buyerProfileInfo.owner.toBase58());
    console.log("Match:", buyerProfileInfo.owner.equals(PROFILE_PROGRAM_ID));
  }
}

main();
