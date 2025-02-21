import { AnchorProvider, Idl } from '@project-serum/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { sdkService } from './sdk';
import { config } from '@/config/env';

const PROGRAM_ID = new PublicKey(config.solana.programId);
const RPC_URL = config.solana.rpcUrl;

let idl: Idl;
try {
  // TODO: Load IDL from file or fetch from chain
  idl = require('@localmoney/solana-sdk/idl.json');
} catch (error) {
  console.error('Failed to load IDL:', error);
  throw error;
}

export function initializeSDK() {
  const connection = new Connection(RPC_URL, {
    commitment: 'confirmed',
    wsEndpoint: RPC_URL.replace('https://', 'wss://').replace('http://', 'ws://'),
  });

  const wallet = useAnchorWallet();
  if (!wallet) {
    throw new Error('Wallet not connected');
  }

  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });

  sdkService.setConfig({
    connection,
    programId: PROGRAM_ID,
    provider,
    idl,
  });
} 