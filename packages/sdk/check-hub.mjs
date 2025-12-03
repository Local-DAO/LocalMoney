import { Connection, PublicKey } from '@solana/web3.js';
import pkg from '@coral-xyz/anchor';
const { Program, AnchorProvider, BN } = pkg;
import hubIdl from './src/idl/hub.json' with { type: 'json' };

const HUB_PROGRAM_ID = new PublicKey('8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH');

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const provider = new AnchorProvider(connection, null, { commitment: 'confirmed' });
  const program = new Program(hubIdl, provider);
  
  const [hubConfigPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('hub_config')],
    HUB_PROGRAM_ID
  );
  
  console.log('Hub Config PDA:', hubConfigPDA.toBase58());
  
  try {
    const hubConfig = await program.account.hubConfig.fetch(hubConfigPDA);
    console.log('Hub Config:');
    console.log('  Admin:', hubConfig.admin.toBase58());
    console.log('  Min Trade Amount:', hubConfig.minTradeAmount.toString());
    console.log('  Max Trade Amount:', hubConfig.maxTradeAmount.toString());
    console.log('  Trade Expiration Timer:', hubConfig.tradeExpirationTimer.toString());
    console.log('  Max Active Trades:', hubConfig.maxActiveTrades.toString());
    console.log('  Global Pause:', hubConfig.globalPause);
    console.log('  Pause New Trades:', hubConfig.pauseNewTrades);
    console.log('  Pause New Offers:', hubConfig.pauseNewOffers);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main().catch(console.error);
