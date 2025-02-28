import { AnchorProvider, BN, Idl, Program } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import { TradeStatus } from '@localmoney/solana-sdk';
import toast from 'react-hot-toast';

// Program IDs from environment variables
const OFFER_PROGRAM_ID = process.env.NEXT_PUBLIC_OFFER_PROGRAM_ID || 'FSnCsffRYjRwbpzFCkbwSFtgfSNbxrpYUsq84opqG4wW';
const TRADE_PROGRAM_ID = process.env.NEXT_PUBLIC_TRADE_PROGRAM_ID || '6VXLHER2xPndomqaXWPPUH3733HVmcRMUuU5w9eNVqbZ';
const SOL_TOKEN_MINT = 'So11111111111111111111111111111111111111112';

// Helper function to check token balance and airdrop SOL if needed
const ensureSufficientTokens = async (
  connection: Connection,
  wallet: any,
  tokenMint: PublicKey,
  requiredAmount: BN
): Promise<boolean> => {
  try {
    // Check if this is the SOL token mint
    const isSolToken = tokenMint.toString() === SOL_TOKEN_MINT;
    
    if (isSolToken) {
      // For SOL tokens, check the wallet balance
      const balance = await connection.getBalance(wallet.publicKey);
      const requiredLamports = requiredAmount.toNumber() + 10000000; // Add some extra for fees
      
      console.log(`Current balance: ${balance / 1e9} SOL, Required: ${requiredAmount.toNumber() / 1e9} SOL`);
      
      if (balance < requiredLamports) {
        // If on localnet, we can airdrop SOL
        const isLocalnet = 
          connection.rpcEndpoint.includes('localhost') || 
          connection.rpcEndpoint.includes('127.0.0.1');
        
        if (isLocalnet) {
          console.log(`Airdropping 111 SOL to ${wallet.publicKey.toString()}`);
          const airdropSignature = await connection.requestAirdrop(wallet.publicKey, 111 * 1e9);
          await connection.confirmTransaction(airdropSignature, 'confirmed');
          console.log('Airdrop successful');
          toast.success('Airdropped 111 SOL to your wallet');
          return true;
        } else {
          toast.error(`Insufficient SOL. You need at least ${requiredAmount.toNumber() / 1e9} SOL.`);
          return false;
        }
      }
      return true;
    } else {
      // For other tokens, check the token account balance
      const tokenAccount = await getAssociatedTokenAddress(tokenMint, wallet.publicKey);
      
      try {
        const tokenAccountInfo = await getAccount(connection, tokenAccount);
        const balance = BigInt(tokenAccountInfo.amount.toString());
        
        if (balance < BigInt(requiredAmount.toString())) {
          toast.error(`Insufficient token balance. You need at least ${requiredAmount.toNumber() / 1e9} tokens.`);
          return false;
        }
        return true;
      } catch (error) {
        // If the token account doesn't exist, there are definitely not enough tokens
        toast.error(`Token account not found. Please make sure you have the required tokens.`);
        return false;
      }
    }
  } catch (error) {
    console.error('Error checking token balance:', error);
    toast.error('Failed to check token balance');
    return false;
  }
};

// Trade client factory
export const createTradeClient = async (
  connection: Connection,
  wallet: any
): Promise<any> => {
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
    
    // Make sure the wallet has the required sign methods for Anchor
    if (wallet.keypair && !wallet.signTransaction) {
      console.log('Adding signTransaction methods to wallet');
      wallet = {
        ...wallet,
        signTransaction: async (tx: any) => {
          tx.partialSign(wallet.keypair);
          return tx;
        },
        signAllTransactions: async (txs: any[]) => {
          return txs.map(tx => {
            tx.partialSign(wallet.keypair);
            return tx;
          });
        }
      };
    }
    
    // Create an Anchor provider with proper options
    const provider = new AnchorProvider(
      connection,
      wallet,
      { 
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
        skipPreflight: false
      }
    );
    
    // Load the IDL
    // In a production app, we would import this from the SDK
    let idl;
    
    try {
      // First try to fetch from the blockchain
      idl = await Program.fetchIdl(new PublicKey(TRADE_PROGRAM_ID), provider);
    } catch (error) {
      console.warn('Failed to fetch IDL from the blockchain, trying local file:', error);
    }
    
    // If fetching from the blockchain failed, try to load from the local file
    if (!idl) {
      try {
        // Try to load from the local file in public/idl directory
        const response = await fetch('/idl/trade.json');
        if (response.ok) {
          idl = await response.json();
          console.log('Loaded Trade IDL from local file');
        } else {
          console.error('Failed to load local Trade IDL file');
          toast.error('Failed to load Trade program IDL');
          throw new Error('Failed to load Trade program IDL');
        }
      } catch (fetchError) {
        console.error('Error loading local Trade IDL:', fetchError);
        toast.error('Failed to load Trade program IDL');
        throw new Error('Failed to load Trade program IDL');
      }
    }
    
    if (!idl) {
      console.error('Failed to fetch the Trade program IDL');
      toast.error('Failed to fetch the Trade program IDL');
      throw new Error('Failed to fetch the Trade program IDL');
    }
    
    // Create the client
    return new TradeClient(new PublicKey(TRADE_PROGRAM_ID), provider, idl);
  } catch (error: any) {
    console.error('Error creating Trade client:', error);
    toast.error(error.message || 'Failed to create Trade client');
    throw error;
  }
};

// Mock TradeClient (would be replaced by actual SDK class)
class TradeClient {
  private program: Program;
  private connection: Connection;

  constructor(
    programId: PublicKey,
    provider: AnchorProvider,
    idl: Idl
  ) {
    this.program = new Program(idl, programId, provider);
    this.connection = provider.connection;
  }

  async createTrade(
    taker: any,
    offerPDA: PublicKey,
    offerOwner: PublicKey,
    tokenMint: PublicKey,
    amount: BN,
    price: BN
  ): Promise<PublicKey> {
    try {
      // Check token account balance
      const takerTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        taker.publicKey
      );

      // Create escrow keypair
      const escrowAccount = Keypair.generate();
      
      // Check if the token account exists, if not create it
      let accountExists = false;
      try {
        const accountInfo = await getAccount(this.connection, takerTokenAccount);
        accountExists = true;
        
        // Check if there are enough tokens
        const balance = BigInt(accountInfo.amount.toString());
        if (balance < BigInt(amount.toString())) {
          const isSolToken = tokenMint.toString() === SOL_TOKEN_MINT;
          if (isSolToken) {
            // If this is SOL and we're on localnet, we might need to airdrop
            if (this.connection.rpcEndpoint.includes('localhost') || this.connection.rpcEndpoint.includes('127.0.0.1')) {
              console.log(`Not enough SOL. Current: ${balance.toString()}, Required: ${amount.toString()}`);
              console.log(`Airdropping 111 SOL to ${taker.publicKey.toString()}`);
              const airdropSignature = await this.connection.requestAirdrop(taker.publicKey, 111 * 1e9);
              await this.connection.confirmTransaction(airdropSignature, 'confirmed');
              console.log('Airdrop successful');
            } else {
              throw new Error(`Insufficient SOL balance. Current: ${Number(balance) / 1e9} SOL, Required: ${amount.toNumber() / 1e9} SOL`);
            }
          } else {
            throw new Error(`Insufficient token balance. Current: ${balance.toString()}, Required: ${amount.toString()}`);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("Insufficient")) {
          throw error; // Rethrow balance errors
        }
        console.log('Token account does not exist, will create it');
        accountExists = false;
      }

      // Create the trade PDA
      const [tradePDA] = await PublicKey.findProgramAddress(
        [
          Buffer.from("trade"),
          taker.publicKey.toBuffer(),
          tokenMint.toBuffer(),
        ],
        this.program.programId
      );
      
      // Determine what type of wallet we're dealing with and create proper signers
      let signers = [escrowAccount]; // Always need the escrow account
      
      // For local wallets with keypair, use the keypair directly
      if (taker.keypair) {
        signers.push(taker.keypair);
      } 
      // For wallet adapter that has signTransaction
      else if (taker.signTransaction) {
        signers.push(taker);
      }
      // For other wallet types, we'll need to specify signers differently
      else {
        console.log('Using special wallet signing configuration');
      }

      // If the token account doesn't exist, we need to create it first
      if (!accountExists) {
        // Create a transaction to create the token account
        const createTokenAccountIx = createAssociatedTokenAccountInstruction(
          taker.publicKey,
          takerTokenAccount,
          taker.publicKey,
          tokenMint
        );
        
        // Send the transaction
        const transaction = new Transaction().add(createTokenAccountIx);
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = taker.publicKey;
        
        if (taker.keypair) {
          // For local wallets with keypair
          transaction.sign(taker.keypair);
          const signature = await this.connection.sendRawTransaction(transaction.serialize());
          
          // Wait for confirmation with signature
          console.log('Waiting for token account creation to be confirmed...');
          await this.connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight: (await this.connection.getBlockHeight()) + 150
          }, 'confirmed');
        } else if (taker.signTransaction) {
          // For wallet adapter
          const signedTx = await taker.signTransaction(transaction);
          const signature = await this.connection.sendRawTransaction(signedTx.serialize());
          
          // Wait for confirmation with signature
          console.log('Waiting for token account creation to be confirmed...');
          await this.connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight: (await this.connection.getBlockHeight()) + 150
          }, 'confirmed');
        } else {
          throw new Error('Wallet does not support signing');
        }
      }
      
      // Create the transaction
      await this.program.methods
        .createTrade(amount, price)
        .accounts({
          trade: tradePDA,
          seller: taker.publicKey,
          tokenMint: tokenMint,
          sellerTokenAccount: takerTokenAccount,
          escrowAccount: escrowAccount.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers(signers)
        .rpc();
      
      return tradePDA;
    } catch (error: any) {
      console.error('Error creating trade:', error);
      throw error;
    }
  }

  async acceptTrade(
    tradePDA: PublicKey,
    user: any
  ): Promise<void> {
    await this.program.methods
      .acceptTrade()
      .accounts({
        trade: tradePDA,
        user: user.publicKey,
      })
      .signers([user])
      .rpc();
  }

  async completeTrade(
    tradePDA: PublicKey,
    user: any
  ): Promise<void> {
    const trade = await this.getTrade(tradePDA);
    
    await this.program.methods
      .completeTrade()
      .accounts({
        trade: tradePDA,
        seller: trade.seller,
        buyer: trade.buyer,
        escrowAccount: trade.escrowAccount,
        user: user.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
  }

  async cancelTrade(
    tradePDA: PublicKey,
    user: any
  ): Promise<void> {
    const trade = await this.getTrade(tradePDA);
    
    await this.program.methods
      .cancelTrade()
      .accounts({
        trade: tradePDA,
        user: user.publicKey,
        escrowAccount: trade.escrowAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
  }

  async disputeTrade(
    tradePDA: PublicKey,
    disputer: any
  ): Promise<void> {
    await this.program.methods
      .disputeTrade()
      .accounts({
        trade: tradePDA,
        disputer: disputer.publicKey,
      })
      .signers([disputer])
      .rpc();
  }

  async getTrade(tradePDA: PublicKey): Promise<any> {
    const account = await this.program.account.trade.fetch(tradePDA);
    return {
      seller: account.seller,
      buyer: account.buyer,
      amount: account.amount,
      price: account.price,
      tokenMint: account.tokenMint,
      escrowAccount: account.escrowAccount,
      status: this.convertTradeStatus(account.status),
      createdAt: account.createdAt.toNumber(),
      updatedAt: account.updatedAt.toNumber(),
      bump: account.bump,
    };
  }
  
  async getTradesByUser(userPublicKey: PublicKey): Promise<any[]> {
    // This would fetch all trades and filter by buyer or seller
    let allTrades = [];
    try {
      allTrades = await this.program.account.trade.all();
    } catch (error) {
      console.error('Error fetching all trades:', error);
      return []; // Return empty array if fetching fails completely
    }
    
    // Filter and map trades with additional error handling
    return allTrades
      .filter(account => {
        try {
          const trade = account.account;
          // Check that both buyer and seller exist before comparing
          return (trade.buyer && trade.buyer.equals(userPublicKey)) || 
                (trade.seller && trade.seller.equals(userPublicKey));
        } catch (error) {
          console.warn('Skipping invalid trade account:', error);
          return false; // Skip this account if we can't process it
        }
      })
      .map(account => {
        try {
          const trade = account.account;
          return {
            publicKey: account.publicKey,
            seller: trade.seller,
            buyer: trade.buyer,
            amount: trade.amount,
            price: trade.price,
            tokenMint: trade.tokenMint,
            escrowAccount: trade.escrowAccount,
            status: this.convertTradeStatus(trade.status),
            createdAt: trade.createdAt.toNumber(),
            updatedAt: trade.updatedAt.toNumber(),
            bump: trade.bump,
          };
        } catch (error) {
          console.warn('Error processing trade account:', error);
          return null; // Return null for accounts that can't be processed
        }
      })
      .filter(trade => trade !== null); // Remove null entries
  }

  private convertTradeStatus(status: any): TradeStatus {
    if ('created' in status) return TradeStatus.Created;
    if ('open' in status) return TradeStatus.Open;
    if ('inProgress' in status) return TradeStatus.InProgress;
    if ('completed' in status) return TradeStatus.Completed;
    if ('cancelled' in status) return TradeStatus.Cancelled;
    if ('disputed' in status) return TradeStatus.Disputed;
    throw new Error('Unknown trade status');
  }

  async depositTradeEscrow(
    tradePDA: PublicKey,
    depositor: any,
    depositorTokenAccount: PublicKey,
    escrowAccount: PublicKey,
    amount: BN
  ): Promise<void> {
    try {
      await this.program.methods
        .depositEscrow(amount)
        .accounts({
          trade: tradePDA,
          depositor: depositor.publicKey,
          depositorTokenAccount: depositorTokenAccount,
          escrowAccount: escrowAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([depositor])
        .rpc();
    } catch (error: any) {
      console.error('Error depositing to escrow:', error);
      throw error;
    }
  }
}

// Public API
export const createTrade = async (
  connection: Connection,
  wallet: any,
  offerPDA: PublicKey,
  offerOwner: PublicKey,
  amount: number
): Promise<string | null> => {
  try {
    // Prepare a properly formatted wallet object for Anchor
    let anchorWallet = wallet;
    
    // If this is a local wallet with keypair (like from the localWalletStore)
    if (wallet.keypair) {
      // Create an Anchor compatible wallet using the keypair
      anchorWallet = {
        publicKey: wallet.keypair.publicKey,
        keypair: wallet.keypair,
        // Add the signTransaction method that Anchor expects
        signTransaction: async (tx: any) => {
          tx.partialSign(wallet.keypair);
          return tx;
        },
        signAllTransactions: async (txs: any[]) => {
          return txs.map(tx => {
            tx.partialSign(wallet.keypair);
            return tx;
          });
        }
      };
    }
    
    const client = await createTradeClient(connection, anchorWallet);
    
    // Get the offer details - first try to load from blockchain
    let offerProgram;
    try {
      offerProgram = await Program.fetchIdl(new PublicKey(OFFER_PROGRAM_ID), new AnchorProvider(
        connection,
        anchorWallet,
        { commitment: 'confirmed' }
      ));
    } catch (error) {
      console.warn('Failed to fetch Offer IDL from the blockchain, trying local file:', error);
    }
    
    // If blockchain fetch failed, try to load from local file
    if (!offerProgram) {
      try {
        // Try to load from the local file in public/idl directory
        const response = await fetch('/idl/offer.json');
        if (response.ok) {
          offerProgram = await response.json();
          console.log('Loaded Offer IDL from local file');
        } else {
          console.error('Failed to load local Offer IDL file');
          toast.error('Failed to fetch offer program IDL');
          return null;
        }
      } catch (fetchError) {
        console.error('Error loading local Offer IDL:', fetchError);
        toast.error('Failed to fetch offer program IDL');
        return null;
      }
    }
    
    if (!offerProgram) {
      toast.error('Failed to fetch offer program IDL');
      return null;
    }
    
    const offerClient = new Program(offerProgram, new PublicKey(OFFER_PROGRAM_ID), new AnchorProvider(
      connection,
      anchorWallet,
      { commitment: 'confirmed' }
    ));
    
    const offerAccount = await offerClient.account.offer.fetch(offerPDA);
    
    // Convert amount to lamports (assuming SOL)
    const amountBN = new BN(amount * 1e9); // Convert to lamports
    
    // Check if the wallet has enough tokens and airdrop if needed
    const hasEnoughTokens = await ensureSufficientTokens(
      connection,
      anchorWallet,
      offerAccount.tokenMint,
      amountBN
    );
    
    if (!hasEnoughTokens) {
      toast.error('Insufficient tokens to create this trade');
      return null;
    }
    
    // Create the trade
    const tradePDA = await client.createTrade(
      anchorWallet,
      offerPDA,
      offerOwner,
      offerAccount.tokenMint,
      amountBN,
      offerAccount.pricePerToken
    );
    
    toast.success('Trade created successfully!');
    return tradePDA.toString();
  } catch (error: any) {
    console.error('Error creating trade:', error);
    
    // Parse and display error
    const errorMessage = error.message || 'Failed to create trade';
    toast.error(errorMessage);
    return null;
  }
};

export const getTrade = async (
  connection: Connection,
  wallet: any,
  tradePDA: PublicKey
): Promise<any | null> => {
  try {
    const client = await createTradeClient(connection, wallet);
    const trade = await client.getTrade(tradePDA);
    
    // Convert to a more user-friendly format
    return {
      id: tradePDA.toString(),
      buyer: trade.buyer ? trade.buyer.toString() : null,
      seller: trade.seller.toString(),
      amount: trade.amount.toNumber() / 1e9, // Convert from lamports to SOL
      price: trade.price.toNumber() / 100, // Assuming price is in cents
      status: trade.status,
      createdAt: new Date(trade.createdAt * 1000),
      updatedAt: new Date(trade.updatedAt * 1000)
    };
  } catch (error: any) {
    console.error('Error fetching trade:', error);
    toast.error(error.message || 'Failed to fetch trade details');
    return null;
  }
};

export const getUserTrades = async (
  connection: Connection,
  wallet: any
): Promise<any[]> => {
  try {
    if (!wallet.publicKey) {
      return [];
    }
    
    const client = await createTradeClient(connection, wallet);
    
    try {
      const trades = await client.getTradesByUser(wallet.publicKey);
      
      // Convert to a more user-friendly format
      return trades.map((trade: any) => ({
        id: trade.publicKey.toString(),
        buyer: trade.buyer ? trade.buyer.toString() : null,
        seller: trade.seller ? trade.seller.toString() : null,
        amount: trade.amount.toNumber() / 1e9, // Convert from lamports to SOL
        price: trade.price.toNumber() / 100, // Assuming price is in cents
        status: trade.status,
        createdAt: new Date(trade.createdAt * 1000),
        updatedAt: new Date(trade.updatedAt * 1000)
      }));
    } catch (tradeError: any) {
      console.error('Error in getTradesByUser:', tradeError);
      toast.error('Error loading trades: ' + (tradeError.message || 'Unknown error'));
      return [];
    }
  } catch (error: any) {
    console.error('Error fetching user trades:', error);
    toast.error(error.message || 'Failed to fetch trade history');
    return [];
  }
};

export const acceptTrade = async (
  connection: Connection,
  wallet: any,
  tradePDA: PublicKey
): Promise<boolean> => {
  try {
    const client = await createTradeClient(connection, wallet);
    await client.acceptTrade(tradePDA, wallet);
    toast.success('Trade accepted successfully!');
    return true;
  } catch (error: any) {
    console.error('Error accepting trade:', error);
    toast.error(error.message || 'Failed to accept trade');
    return false;
  }
};

export const completeTrade = async (
  connection: Connection,
  wallet: any,
  tradePDA: PublicKey
): Promise<boolean> => {
  try {
    const client = await createTradeClient(connection, wallet);
    await client.completeTrade(tradePDA, wallet);
    toast.success('Trade completed successfully!');
    return true;
  } catch (error: any) {
    console.error('Error completing trade:', error);
    toast.error(error.message || 'Failed to complete trade');
    return false;
  }
};

export const cancelTrade = async (
  connection: Connection,
  wallet: any,
  tradePDA: PublicKey
): Promise<boolean> => {
  try {
    const client = await createTradeClient(connection, wallet);
    await client.cancelTrade(tradePDA, wallet);
    toast.success('Trade cancelled successfully!');
    return true;
  } catch (error: any) {
    console.error('Error cancelling trade:', error);
    toast.error(error.message || 'Failed to cancel trade');
    return false;
  }
};

export const disputeTrade = async (
  connection: Connection,
  wallet: any,
  tradePDA: PublicKey
): Promise<boolean> => {
  try {
    const client = await createTradeClient(connection, wallet);
    await client.disputeTrade(tradePDA, wallet);
    toast.success('Trade dispute initiated!');
    return true;
  } catch (error: any) {
    console.error('Error disputing trade:', error);
    toast.error(error.message || 'Failed to dispute trade');
    return false;
  }
};

// Export a new function for depositing to escrow separately
export const depositTradeEscrow = async (
  connection: Connection,
  wallet: any,
  tradePDA: PublicKey,
  tokenMint: PublicKey,
  amount: number
): Promise<boolean> => {
  try {
    // Prepare a properly formatted wallet object for Anchor
    let anchorWallet = wallet;
    
    // If this is a local wallet with keypair (like from the localWalletStore)
    if (wallet.keypair) {
      // Create an Anchor compatible wallet using the keypair
      anchorWallet = {
        publicKey: wallet.keypair.publicKey,
        keypair: wallet.keypair,
        // Add the signTransaction method that Anchor expects
        signTransaction: async (tx: any) => {
          tx.partialSign(wallet.keypair);
          return tx;
        },
        signAllTransactions: async (txs: any[]) => {
          return txs.map(tx => {
            tx.partialSign(wallet.keypair);
            return tx;
          });
        }
      };
    }
    
    // Convert amount to lamports (assuming SOL)
    const amountBN = new BN(amount * 1e9); // Convert to lamports
    
    // Check if the wallet has enough tokens and airdrop if needed
    const hasEnoughTokens = await ensureSufficientTokens(
      connection,
      anchorWallet,
      tokenMint,
      amountBN
    );
    
    if (!hasEnoughTokens) {
      toast.error('Insufficient tokens to deposit to escrow');
      return false;
    }
    
    const client = await createTradeClient(connection, anchorWallet);
    
    // Get depositor token account
    const depositorTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      anchorWallet.publicKey
    );
    
    // Fetch the trade to get the escrow account
    const trade = await client.getTrade(tradePDA);
    
    // Deposit to escrow
    await client.depositTradeEscrow(
      tradePDA,
      anchorWallet,
      depositorTokenAccount,
      trade.escrowAccount,
      amountBN
    );
    
    toast.success('Successfully deposited to escrow!');
    return true;
  } catch (error: any) {
    console.error('Error depositing to escrow:', error);
    
    // Parse and display error
    const errorMessage = error.message || 'Failed to deposit to escrow';
    toast.error(errorMessage);
    return false;
  }
}; 