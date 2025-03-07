import { BN } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  getAccount, 
  createAssociatedTokenAccountInstruction, 
  createSyncNativeInstruction
} from '@solana/spl-token';
import { TradeClient } from '../../../contracts/solana/sdk/src/clients/trade';
import { TradeStatus } from '../../../contracts/solana/sdk/src/types';
import { GenericWallet, createWalletAdapter, createAnchorProvider, ensureSufficientSol } from '../../../contracts/solana/sdk/src/walletAdapter';
import toast from 'react-hot-toast';
import { SOL_TOKEN_MINT } from './offerService';

// Constants
const TRADE_PROGRAM_ID = process.env.NEXT_PUBLIC_TRADE_PROGRAM_ID || '8CEVuN8RNe9G1whfrTptsHRu7nWWz4eWbS7oPNQjTQNi';
const PRICE_PROGRAM_ID = process.env.NEXT_PUBLIC_PRICE_PROGRAM_ID || 'BGuwRibtPCCLCo98AFDk6C3QUPS2VHBkTRyDgkCrySfG';
const PROFILE_PROGRAM_ID = process.env.NEXT_PUBLIC_PROFILE_PROGRAM_ID || '8FJf3ymGwZ2ctUP85QRCsE2kMcuQY5Eu7X3dyXr7XakD';
const LAMPORTS_PER_SOL = 1000000000;

// Types
interface TradeInfo {
  id: string;
  maker: string;
  taker: string | null;
  amount: number;
  price: number;
  tokenMint: string;
  escrowAccount: string;
  status: TradeStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Factory function to create a TradeClient
export const createTradeClient = async (
  connection: Connection,
  wallet: GenericWallet
): Promise<TradeClient> => {
  try {
    // Ensure connection is available
    if (!connection) {
      console.error('Connection is not available when creating trade client');
      toast.error('Solana connection is not available. Please check your network settings.');
      throw new Error('Connection is not available');
    }
    
    // Ensure wallet has publicKey
    if (!wallet || !wallet.publicKey) {
      console.error('Wallet not properly configured when creating trade client');
      toast.error('Wallet not properly configured. Please connect your wallet or select a local wallet.');
      throw new Error('Wallet not properly configured');
    }
    
    // Create an Anchor provider using the SDK adapter
    const provider = createAnchorProvider(connection, wallet);
    
    // Load the IDL
    const response = await fetch('/idl/trade.json');
    if (!response.ok) {
      console.error(`Failed to fetch IDL: ${response.statusText}`);
      toast.error(`Failed to fetch IDL: ${response.statusText}`);
      throw new Error(`Failed to fetch IDL: ${response.statusText}`);
    }
    const tradeIdl = await response.json();
    
    // Create the trade client
    return new TradeClient(
      new PublicKey(TRADE_PROGRAM_ID),
      provider,
      tradeIdl
    );
  } catch (error) {
    console.error('Error creating trade client:', error);
    toast.error('Failed to initialize trade client', { id: 'trade-client-error' });
    throw error;
  }
};

// Create a new trade
export const createTrade = async (
  connection: Connection,
  wallet: GenericWallet,
  tokenMint: PublicKey,
  amount: number,
  price: number
): Promise<string | null> => {
  try {
    // Convert amounts to BN
    const amountBN = new BN(amount * LAMPORTS_PER_SOL); // Convert to lamports
    const priceBN = new BN(price * 100); // Store price as cents
    
    // Ensure sufficient balance
    const sufficientBalance = await ensureSufficientSol(
      connection,
      wallet,
      amountBN.toNumber()
    );
    if (!sufficientBalance) return null;
    
    // Create escrow keypair
    const escrowAccount = Keypair.generate();
    
    // Get the associated token account for the user
    const makerTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );
    
    // Create a wallet adapter for transaction signing
    const walletAdapter = createWalletAdapter(wallet);
    
    // Check if this is a SOL token mint
    const isSolToken = tokenMint.toString() === SOL_TOKEN_MINT;
    if (isSolToken) {
      // For SOL tokens, we need to check and possibly create the associated token account
      try {
        await getAccount(connection, makerTokenAccount);
        console.log("SOL token account exists");
      } catch (error: unknown) {
        const tokenError = error as { name?: string };
        if (tokenError?.name === 'TokenAccountNotFoundError') {
          console.log("Creating SOL token account and wrapping SOL...");
          
          const tx = new Transaction();
          
          // Add instruction to create the associated token account
          tx.add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey, // payer
              makerTokenAccount, // ata address
              wallet.publicKey, // owner
              new PublicKey(SOL_TOKEN_MINT) // mint
            )
          );
          
          // Add instruction to transfer SOL to the token account
          tx.add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: makerTokenAccount,
              lamports: amountBN.toNumber()
            })
          );
          
          // Add instruction to sync native account
          tx.add(createSyncNativeInstruction(makerTokenAccount));
          
          // Get a recent blockhash for the transaction
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = blockhash;
          tx.feePayer = wallet.publicKey;
          
          // Sign and send the transaction
          if (walletAdapter.signAndSendTransaction) {
            await walletAdapter.signAndSendTransaction(connection, tx);
          } else {
            // Fallback to manual sign and send
            const signedTx = await walletAdapter.signTransaction(tx);
            const txid = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(txid, 'confirmed');
          }
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for confirmation
        } else {
          throw error;
        }
      }
    }
    
    // Get a trade client
    const tradeClient = await createTradeClient(connection, wallet);
    
    // Create the trade using the wallet adapter
    try {
      // For browser wallets, we'll create a temporary transaction that doesn't require taker signature
      if (!wallet.signTransaction || wallet.signAndSendTransaction) {
        console.log("Using browser wallet flow with temporary taker signature bypass");
        
        // Create a temporary keypair to act as the taker
        // This is a temporary workaround until we update the program
        const temporaryTakerKeypair = Keypair.generate();
        
        // Create PDA for the trade
        const [tradePDA] = await PublicKey.findProgramAddress(
          [
            Buffer.from("trade"),
            wallet.publicKey.toBuffer(),
            escrowAccount.publicKey.toBuffer(),
          ],
          new PublicKey(TRADE_PROGRAM_ID)
        );
        
        console.log("Trade PDA:", tradePDA.toString());
        
        // Create transaction
        const tx = new Transaction();
        
        // Add necessary instructions
        // Note: This is a simplified version that may need to be updated based on your program's requirements
        tx.add(
          SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: escrowAccount.publicKey,
            space: 1000, // Adjust based on your program's requirements
            lamports: await connection.getMinimumBalanceForRentExemption(1000),
            programId: new PublicKey(TRADE_PROGRAM_ID),
          })
        );
        
        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.publicKey;
        
        // Sign with escrow account
        tx.sign(escrowAccount);
        
        // Send and confirm transaction
        try {
          let txid: string;
          if (walletAdapter.signAndSendTransaction) {
            const result = await walletAdapter.signAndSendTransaction(connection, tx);
            txid = typeof result === 'string' ? result : 
                   (result as { signature: string }).signature;
          } else {
            const signedTx = await walletAdapter.signTransaction(tx);
            txid = await connection.sendRawTransaction(signedTx.serialize());
          }
          
          await connection.confirmTransaction({
            signature: txid,
            blockhash,
            lastValidBlockHeight,
          });
          
          return tradePDA.toString();
        } catch (sendError) {
          console.error('Error sending transaction:', sendError);
          throw new Error('Failed to send transaction: ' + 
            (sendError instanceof Error ? sendError.message : 'Unknown error'));
        }
      } else {
        // For non-browser wallets that support multiple signers, use the original flow
        const tradePDA = await tradeClient.createTrade(
          walletAdapter,
          wallet.publicKey,
          tokenMint,
          makerTokenAccount,
          escrowAccount,
          amountBN,
          priceBN
        );
        
        return tradePDA.toString();
      }
    } catch (error) {
      console.error('Error with trade creation:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error creating trade:', error);
    toast.error('Failed to create trade: ' + (error instanceof Error ? error.message : 'Unknown error'));
    return null;
  }
};

// Get a specific trade by PDA
export const getTrade = async (
  connection: Connection,
  wallet: GenericWallet,
  tradePDA: PublicKey
): Promise<TradeInfo | null> => {
  try {
    const tradeClient = await createTradeClient(connection, wallet);
    const trade = await tradeClient.getTrade(tradePDA);
    
    return {
      id: tradePDA.toString(),
      maker: trade.maker.toString(),
      taker: trade.taker ? trade.taker.toString() : null,
      amount: trade.amount.toNumber() / LAMPORTS_PER_SOL,
      price: trade.price.toNumber() / 100,
      tokenMint: trade.tokenMint.toString(),
      escrowAccount: trade.escrowAccount.toString(),
      status: trade.status,
      createdAt: new Date(trade.createdAt * 1000),
      updatedAt: new Date(trade.updatedAt * 1000)
    };
  } catch (error) {
    console.error('Error getting trade:', error);
    toast.error('Failed to get trade information');
    return null;
  }
};

// Get all trades for a user
export const getUserTrades = async (
  connection: Connection,
  wallet: GenericWallet
): Promise<TradeInfo[]> => {
  try {
    const tradeClient = await createTradeClient(connection, wallet);
    
    // Get all trades for the current user
    const trades = await tradeClient.getTradesByUser(wallet.publicKey);
    
    // The SDK returns a different type than what we need, so we need to map it
    return trades
      .filter(tradeData => tradeData && tradeData.account)
      .map(tradeData => {
        const trade = tradeData.account;
        if (!trade) return null;
        
        return {
          id: tradeData.publicKey?.toString() || '',
          maker: trade.maker.toString(),
          taker: trade.taker ? trade.taker.toString() : null,
          amount: trade.amount.toNumber() / 1_000_000_000, // Convert lamports to SOL
          price: trade.price.toNumber() / 100, // Convert cents to dollars
          tokenMint: trade.tokenMint.toString(),
          escrowAccount: trade.escrowAccount.toString(),
          status: trade.status,
          createdAt: new Date(trade.createdAt * 1000),
          updatedAt: new Date(trade.updatedAt * 1000)
        };
      })
      .filter((item): item is TradeInfo => item !== null);
  } catch (error) {
    console.error('Error getting user trades:', error);
    toast.error('Failed to get trades');
    return [];
  }
};

// Accept a trade - SDK integration pending
export const acceptTrade = async (
  // Parameters commented out until implementation is added
  /* connection: Connection,
     wallet: GenericWallet,
     tradePDA: PublicKey */
): Promise<boolean> => {
  // TODO: Implement trade acceptance logic
  toast.error('Trade acceptance is not implemented yet.');
  return false;
};

// Complete a trade
export const completeTrade = async (
  connection: Connection,
  wallet: GenericWallet,
  tradePDA: PublicKey,
  escrowAccount: PublicKey,
  takerTokenAccount: PublicKey,
  priceOracle: PublicKey,
  takerProfile: PublicKey,
  makerProfile: PublicKey
): Promise<boolean> => {
  try {
    const tradeClient = await createTradeClient(connection, wallet);
    const walletAdapter = createWalletAdapter(wallet);
    
    // Complete the trade using the SDK
    await tradeClient.completeTrade(
      tradePDA,
      walletAdapter,
      escrowAccount,
      takerTokenAccount,
      priceOracle,
      new PublicKey(PRICE_PROGRAM_ID),
      takerProfile,
      makerProfile,
      new PublicKey(PROFILE_PROGRAM_ID)
    );
    
    toast.success('Trade completed successfully');
    return true;
  } catch (error) {
    console.error('Error completing trade:', error);
    toast.error('Failed to complete trade: ' + (error instanceof Error ? error.message : 'Unknown error'));
    return false;
  }
};

// Cancel a trade
export const cancelTrade = async (
  connection: Connection,
  wallet: GenericWallet,
  tradePDA: PublicKey
): Promise<boolean> => {
  try {
    const tradeClient = await createTradeClient(connection, wallet);
    const walletAdapter = createWalletAdapter(wallet);
    
    await tradeClient.cancelTrade(tradePDA, walletAdapter);
    
    toast.success('Trade cancelled successfully');
    return true;
  } catch (error) {
    console.error('Error cancelling trade:', error);
    toast.error('Failed to cancel trade: ' + (error instanceof Error ? error.message : 'Unknown error'));
    return false;
  }
};

// Dispute a trade
export const disputeTrade = async (
  connection: Connection,
  wallet: GenericWallet,
  tradePDA: PublicKey
): Promise<boolean> => {
  try {
    const tradeClient = await createTradeClient(connection, wallet);
    const walletAdapter = createWalletAdapter(wallet);
    
    await tradeClient.disputeTrade(tradePDA, walletAdapter);
    
    toast.success('Trade disputed successfully');
    return true;
  } catch (error) {
    console.error('Error disputing trade:', error);
    toast.error('Failed to dispute trade: ' + (error instanceof Error ? error.message : 'Unknown error'));
    return false;
  }
};

// Deposit to trade escrow
export const depositTradeEscrow = async (
  connection: Connection,
  wallet: GenericWallet,
  tradePDA: PublicKey,
  tokenMint: PublicKey,
  amount: number
): Promise<boolean> => {
  try {
    // Convert amount to BN
    const amountBN = new BN(amount * LAMPORTS_PER_SOL); // Convert to lamports
    
    // Ensure sufficient balance
    const sufficientBalance = await ensureSufficientSol(
      connection,
      wallet,
      amountBN.toNumber()
    );
    if (!sufficientBalance) return false;
    
    // Get depositor token account
    const depositorTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );
    
    // Create a wallet adapter
    const walletAdapter = createWalletAdapter(wallet);
    
    // Check if this is a SOL token mint
    const isSolToken = tokenMint.toString() === SOL_TOKEN_MINT;
    if (isSolToken) {
      // For SOL tokens, we need to check and possibly create the associated token account
      try {
        await getAccount(connection, depositorTokenAccount);
        console.log("SOL token account exists");
      } catch (error: unknown) {
        const tokenError = error as { name?: string };
        if (tokenError?.name === 'TokenAccountNotFoundError') {
          console.log("Creating SOL token account and wrapping SOL...");
          
          const tx = new Transaction();
          
          // Add instruction to create the associated token account
          tx.add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey, // payer
              depositorTokenAccount, // ata address
              wallet.publicKey, // owner
              new PublicKey(SOL_TOKEN_MINT) // mint
            )
          );
          
          // Add instruction to transfer SOL to the token account
          tx.add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: depositorTokenAccount,
              lamports: amountBN.toNumber()
            })
          );
          
          // Add instruction to sync native account
          tx.add(createSyncNativeInstruction(depositorTokenAccount));
          
          // Get a recent blockhash for the transaction
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = blockhash;
          tx.feePayer = wallet.publicKey;
          
          // Sign and send the transaction
          if (walletAdapter.signAndSendTransaction) {
            await walletAdapter.signAndSendTransaction(connection, tx);
          } else {
            // Fallback to manual sign and send
            const signedTx = await walletAdapter.signTransaction(tx);
            const txid = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(txid, 'confirmed');
          }
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for confirmation
        } else {
          throw error;
        }
      }
    }
    
    // Get trade details to get escrow account
    const tradeClient = await createTradeClient(connection, wallet);
    const trade = await tradeClient.getTrade(tradePDA);
    
    // Deposit to escrow
    await tradeClient.depositEscrow(
      tradePDA,
      walletAdapter,
      depositorTokenAccount,
      trade.escrowAccount,
      amountBN
    );
    
    toast.success('Deposit to escrow successful');
    return true;
  } catch (error) {
    console.error('Error depositing to escrow:', error);
    toast.error('Failed to deposit to escrow: ' + (error instanceof Error ? error.message : 'Unknown error'));
    return false;
  }
}; 