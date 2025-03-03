import { AnchorProvider, BN, Program, Wallet } from '@project-serum/anchor';
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  VersionedTransaction,
  TransactionSignature,
  SystemProgram
} from '@solana/web3.js';

/**
 * Interface for wallet signers that provide signing capabilities
 */
export interface WalletSigner {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
}

/**
 * Generic wallet interface that may or may not have a keypair
 * This helps support wallets from different providers
 */
export interface GenericWallet {
  publicKey: PublicKey;
  keypair?: Keypair;
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  sendTransaction?: (transaction: Transaction) => Promise<string>;
}

/**
 * Extended wallet adapter interface that provides additional methods
 */
export interface WalletAdapter extends WalletSigner {
  // Method to sign and send a transaction in one step
  signAndSendTransaction?: (connection: Connection, transaction: Transaction) => Promise<TransactionSignature>;
}

/**
 * Creates a wallet adapter from a keypair or generic wallet
 * @param wallet Keypair or generic wallet
 * @returns A wallet adapter that can be used with Anchor
 */
export function createWalletAdapter(wallet: GenericWallet | Keypair): WalletAdapter {
  if (!wallet) {
    throw new Error('No wallet provided');
  }

  // If it's a Keypair
  if (wallet instanceof Keypair) {
    return {
      publicKey: wallet.publicKey,
      async signTransaction(tx: Transaction): Promise<Transaction> {
        tx.partialSign(wallet);
        return tx;
      },
      async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
        return txs.map(tx => {
          tx.partialSign(wallet);
          return tx;
        });
      },
      async signAndSendTransaction(connection: Connection, transaction: Transaction): Promise<TransactionSignature> {
        // Get a recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        transaction.partialSign(wallet);
        const rawTransaction = transaction.serialize();
        const signature = await connection.sendRawTransaction(rawTransaction);
        await connection.confirmTransaction(signature, 'confirmed');
        return signature;
      }
    };
  }

  // If it has a keypair property
  if ((wallet as GenericWallet).keypair) {
    return {
      publicKey: wallet.publicKey,
      async signTransaction(tx: Transaction): Promise<Transaction> {
        tx.partialSign((wallet as GenericWallet).keypair!);
        return tx;
      },
      async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
        return txs.map(tx => {
          tx.partialSign((wallet as GenericWallet).keypair!);
          return tx;
        });
      },
      async signAndSendTransaction(connection: Connection, transaction: Transaction): Promise<TransactionSignature> {
        // Get a recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        transaction.partialSign((wallet as GenericWallet).keypair!);
        const rawTransaction = transaction.serialize();
        const signature = await connection.sendRawTransaction(rawTransaction);
        await connection.confirmTransaction(signature, 'confirmed');
        return signature;
      }
    };
  }
  
  // If it has a _keypair property (NodeWallet from Anchor)
  if ((wallet as any)._keypair) {
    return {
      publicKey: wallet.publicKey,
      async signTransaction(tx: Transaction): Promise<Transaction> {
        // Ensure we have a valid Keypair instance
        let keypair: Keypair;
        if ((wallet as any)._keypair instanceof Keypair) {
          keypair = (wallet as any)._keypair;
        } else {
          // If _keypair is not a Keypair, try to convert it to one
          try {
            keypair = Keypair.fromSecretKey(
              Uint8Array.from((wallet as any)._keypair.secretKey)
            );
          } catch (error) {
            console.error("Error creating keypair:", error);
            throw new Error("Failed to create keypair from wallet: Invalid keypair format");
          }
        }
        
        tx.partialSign(keypair);
        return tx;
      },
      async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
        // Ensure we have a valid Keypair instance
        let keypair: Keypair;
        if ((wallet as any)._keypair instanceof Keypair) {
          keypair = (wallet as any)._keypair;
        } else {
          // If _keypair is not a Keypair, try to convert it to one
          try {
            keypair = Keypair.fromSecretKey(
              Uint8Array.from((wallet as any)._keypair.secretKey)
            );
          } catch (error) {
            console.error("Error creating keypair:", error);
            throw new Error("Failed to create keypair from wallet: Invalid keypair format");
          }
        }
        
        return txs.map(tx => {
          tx.partialSign(keypair);
          return tx;
        });
      },
      async signAndSendTransaction(connection: Connection, transaction: Transaction): Promise<TransactionSignature> {
        // Get a recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        // Ensure we have a valid Keypair instance
        let keypair: Keypair;
        if ((wallet as any)._keypair instanceof Keypair) {
          keypair = (wallet as any)._keypair;
        } else {
          // If _keypair is not a Keypair, try to convert it to one
          try {
            keypair = Keypair.fromSecretKey(
              Uint8Array.from((wallet as any)._keypair.secretKey)
            );
          } catch (error) {
            console.error("Error creating keypair:", error);
            throw new Error("Failed to create keypair from wallet: Invalid keypair format");
          }
        }
        
        transaction.partialSign(keypair);
        const rawTransaction = transaction.serialize();
        const signature = await connection.sendRawTransaction(rawTransaction);
        await connection.confirmTransaction(signature, 'confirmed');
        return signature;
      }
    };
  }

  // Otherwise, it must be a generic wallet with signing methods
  const genericWallet = wallet as GenericWallet;
  
  if (!genericWallet.signTransaction) {
    throw new Error('Wallet does not implement signTransaction');
  }

  if (!genericWallet.signAllTransactions) {
    throw new Error('Wallet does not implement signAllTransactions');
  }

  const adapter: WalletAdapter = {
    publicKey: genericWallet.publicKey,
    signTransaction: genericWallet.signTransaction,
    signAllTransactions: genericWallet.signAllTransactions,
  };

  // Add signAndSendTransaction if sendTransaction is available
  if (genericWallet.sendTransaction) {
    adapter.signAndSendTransaction = async (connection: Connection, transaction: Transaction): Promise<TransactionSignature> => {
      const signedTx = await genericWallet.signTransaction!(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
      return signature;
    };
  }

  return adapter;
}

/**
 * Check if a wallet adapter has a keypair
 * @param adapter WalletAdapter to check
 * @returns true if the adapter has a keypair
 */
export function hasKeypair(adapter: WalletAdapter | GenericWallet | Keypair): boolean {
  // If it's directly a Keypair instance
  if (adapter instanceof Keypair) {
    return true;
  }
  
  // Check if it has a keypair property
  if ((adapter as any).keypair) {
    return true;
  }
  
  // Check if it has a _keypair property (NodeWallet from Anchor)
  if ((adapter as any)._keypair) {
    return true;
  }
  
  return false;
}

/**
 * Get a helpful error message for operations requiring a keypair
 * @param operation The operation that requires a keypair
 * @returns User-friendly error message
 */
export function getKeypairRequiredErrorMessage(operation: string): string {
  return `This ${operation} requires a keypair which browser wallets do not expose. ` +
         `Please use a local wallet for this operation.`;
}

/**
 * Creates an Anchor Provider from a wallet and connection
 * @param connection Solana connection
 * @param wallet Wallet (with or without keypair)
 * @returns Anchor Provider
 */
export function createAnchorProvider(connection: Connection, wallet: GenericWallet): AnchorProvider {
  const adapter = createWalletAdapter(wallet);
  return new AnchorProvider(
    connection,
    adapter as Wallet,
    { commitment: 'confirmed' }
  );
}

/**
 * Send and confirm a transaction
 * @param connection Solana connection
 * @param transaction Transaction to send
 * @param wallet Wallet to sign with
 * @returns Transaction signature
 */
export async function sendAndConfirmTransaction(
  connection: Connection,
  transaction: Transaction,
  wallet: GenericWallet
): Promise<TransactionSignature> {
  const adapter = createWalletAdapter(wallet);
  
  if (adapter.signAndSendTransaction) {
    return await adapter.signAndSendTransaction(connection, transaction);
  }
  
  const signedTx = await adapter.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

/**
 * Ensures that a wallet has sufficient SOL for a transaction
 * Will airdrop SOL on localnet if needed
 * @param connection Solana connection
 * @param wallet Wallet to check
 * @param lamports Amount of lamports to ensure (default 10000000 - 0.01 SOL)
 * @returns true if sufficient SOL is available
 */
export async function ensureSufficientSol(
  connection: Connection,
  wallet: GenericWallet,
  lamports: number = 10000000
): Promise<boolean> {
  try {
    if (!wallet.publicKey) {
      console.error('Wallet does not have a public key');
      return false;
    }

    // Check current balance
    const balance = await connection.getBalance(wallet.publicKey);
    
    // If sufficient balance, return true
    if (balance >= lamports) {
      return true;
    }
    
    console.log(`Insufficient SOL balance: ${balance / 1e9} SOL, needed ${lamports / 1e9} SOL`);
    
    // Check if we're on localnet
    const genesisHash = await connection.getGenesisHash();
    const isLocalnet = !genesisHash.startsWith('5eykt'); // Mainnet and other public nets start with this
    
    if (isLocalnet) {
      console.log('On localnet, attempting to airdrop SOL...');
      try {
        // Calculate how much SOL to request (up to 2 SOL per airdrop)
        const requestLamports = Math.min(2 * 1e9, lamports * 2);
        
        // Request airdrop
        const signature = await connection.requestAirdrop(wallet.publicKey, requestLamports);
        await connection.confirmTransaction(signature, 'confirmed');
        
        // Check if we got the SOL
        const newBalance = await connection.getBalance(wallet.publicKey);
        console.log(`New balance after airdrop: ${newBalance / 1e9} SOL`);
        return newBalance >= lamports;
      } catch (error) {
        console.error('Failed to airdrop SOL:', error);
        return false;
      }
    } else {
      console.log('Not on localnet, cannot airdrop SOL');
      return false;
    }
  } catch (error) {
    console.error('Error checking SOL balance:', error);
    return false;
  }
} 