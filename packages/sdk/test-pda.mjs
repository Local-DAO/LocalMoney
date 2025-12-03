import { Connection, PublicKey } from '@solana/web3.js';
import pkg from '@coral-xyz/anchor';
const { Program, AnchorProvider, BN } = pkg;

const OFFER_PROGRAM_ID = new PublicKey('CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo');

// Test with different PDA derivations
function getOfferPDA_v1(offerId, programId) {
  // Using string seed "offer"
  return PublicKey.findProgramAddressSync(
    [Buffer.from('offer'), offerId.toArrayLike(Buffer, 'le', 8)],
    programId
  );
}

async function main() {
  console.log('Testing PDA derivations...\n');

  for (let i = 0; i <= 3; i++) {
    const offerId = new BN(i);
    const [pda1] = getOfferPDA_v1(offerId, OFFER_PROGRAM_ID);

    console.log('Offer ID ' + i + ':');
    console.log('  PDA: ' + pda1.toBase58());
    console.log();
  }
}

main().catch(console.error);
