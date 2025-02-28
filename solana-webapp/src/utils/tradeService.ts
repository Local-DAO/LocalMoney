import { AnchorProvider, BN, Idl, Program } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount, createSyncNativeInstruction } from '@solana/spl-token';
import { TradeStatus } from '@localmoney/solana-sdk';
import toast from 'react-hot-toast';

// Program IDs from environment variables
const OFFER_PROGRAM_ID = process.env.NEXT_PUBLIC_OFFER_PROGRAM_ID || 'FSnCsffRYjRwbpzFCkbwSFtgfSNbxrpYUsq84opqG4wW';
const TRADE_PROGRAM_ID = process.env.NEXT_PUBLIC_TRADE_PROGRAM_ID || '6VXLHER2xPndomqaXWPPUH3733HVmcRMUuU5w9eNVqbZ';
const SOL_TOKEN_MINT = 'So11111111111111111111111111111111111111112';

// Helper function to check token balance and airdrop SOL if needed
const LAMPORTS_PER_SOL = 1000000000;
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
    let anchorWallet = wallet;
    
    if (wallet.keypair) {
      console.log('Creating Anchor wallet from local wallet with keypair');
      // For local wallets with keypair, create a proper AnchorWallet
      anchorWallet = {
        publicKey: wallet.publicKey,
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
    } else {
      console.log('Using wallet adapter as is (should have signTransaction methods)');
      // For browser wallets via wallet adapter, we assume signTransaction is already defined
      if (!wallet.signTransaction) {
        console.warn('Warning: Wallet missing signTransaction method');
      }
    }
    
    // Create an Anchor provider with proper options
    const provider = new AnchorProvider(
      connection,
      anchorWallet,
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
    console.log("TradeClient initialized with connection:", 
      this.connection ? "Connection available" : "No connection",
      "Provider connection:", provider.connection ? "Available" : "Not available");
  }

  async createTrade(
    maker: any,
    offerPDA: PublicKey,
    offerOwner: PublicKey,
    tokenMint: PublicKey,
    amount: BN,
    price: BN
  ): Promise<PublicKey> {
    try {
      // Check token account balance
      const makerTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        maker.publicKey
      );

      // Create escrow keypair
      const escrowAccount = Keypair.generate();
      
      // Check if the token account exists, if not create it
      let accountExists = false;
      try {
        const accountInfo = await getAccount(this.connection, makerTokenAccount);
        accountExists = true;
        
        // Check if there are enough tokens
        const balance = BigInt(accountInfo.amount.toString());
        if (balance < BigInt(amount.toString())) {
          const isSolToken = tokenMint.toString() === SOL_TOKEN_MINT;
          if (isSolToken) {
            // If this is SOL and we're on localnet, we might need to airdrop
            if (this.connection.rpcEndpoint.includes('localhost') || this.connection.rpcEndpoint.includes('127.0.0.1')) {
              console.log(`Not enough SOL. Current: ${balance.toString()}, Required: ${amount.toString()}`);
              console.log(`Airdropping 111 SOL to ${maker.publicKey.toString()}`);
              const airdropSignature = await this.connection.requestAirdrop(maker.publicKey, 111 * 1e9);
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

      // Create the trade PDA - using proper maker/taker terminology
      const [tradePDA] = await PublicKey.findProgramAddress(
        [
          Buffer.from("trade"),
          maker.publicKey.toBuffer(), // This is the maker in the current context
          tokenMint.toBuffer(),
        ],
        this.program.programId
      );
      
      // Determine what type of wallet we're dealing with and create proper signers
      let signers = [escrowAccount]; // Always need the escrow account
      
      // For local wallets with keypair, use the keypair directly
      if (maker.keypair) {
        signers.push(maker.keypair);
      } 
      // For wallet adapter that has signTransaction
      else if (maker.signTransaction) {
        signers.push(maker);
      }
      // For other wallet types, we'll need to specify signers differently
      else {
        console.log('Using special wallet signing configuration');
      }

      // If the token account doesn't exist, we need to create it first
      if (!accountExists) {
        // Create a transaction to create the token account
        const createTokenAccountIx = createAssociatedTokenAccountInstruction(
          maker.publicKey,
          makerTokenAccount,
          maker.publicKey,
          tokenMint
        );
        
        // Send the transaction
        const transaction = new Transaction().add(createTokenAccountIx);
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = maker.publicKey;
        
        if (maker.keypair) {
          // For local wallets with keypair
          transaction.sign(maker.keypair);
          const signature = await this.connection.sendRawTransaction(transaction.serialize());
          
          // Wait for confirmation with signature
          console.log('Waiting for token account creation to be confirmed...');
          await this.connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight: (await this.connection.getBlockHeight()) + 150
          }, 'confirmed');
        } else if (maker.signTransaction) {
          // For wallet adapter
          const signedTx = await maker.signTransaction(transaction);
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
      
      // Create the transaction - update account names to match new IDL
      await this.program.methods
        .createTrade(amount, price)
        .accounts({
          trade: tradePDA,
          maker: maker.publicKey,
          tokenMint: tokenMint,
          makerTokenAccount: makerTokenAccount, // Updated from sellerTokenAccount to makerTokenAccount
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
    taker: any
  ): Promise<void> {
    await this.program.methods
      .acceptTrade()
      .accounts({
        trade: tradePDA,
        taker: taker.publicKey, // Updated from user to taker
      })
      .signers([taker])
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
        maker: trade.maker, // Updated from seller to maker
        taker: trade.taker, // Updated from buyer to taker
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
        maker: user.publicKey, // Updated from seller to maker
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
      maker: account.maker,  // Updated from seller to maker
      taker: account.taker,  // Updated from buyer to taker
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
    // This would fetch all trades and filter by maker or taker
    let allTrades = [];
    console.log("Fetching trades for user:", userPublicKey.toString());
    
    try {
      // Add extra error handling for account fetching and decoding
      try {
        allTrades = await this.program.account.trade.all();
        console.log("Total trades found:", allTrades.length);
      } catch (decodeError) {
        console.error('Error decoding trade accounts:', decodeError);
        
        // Fallback to fetch accounts without decoding
        const rawAccounts = await this.connection.getProgramAccounts(this.program.programId);
        console.log("Raw accounts fetched:", rawAccounts.length);
        
        // Try to decode each account individually
        allTrades = rawAccounts
          .map(account => {
            try {
              // Manual decoding with error handling
              const decodedAccount = this.program.coder.accounts.decode('Trade', account.account.data);
              return {
                publicKey: account.pubkey,
                account: decodedAccount
              };
            } catch (error) {
              console.warn(`Failed to decode account ${account.pubkey.toString()}`, error);
              return null;
            }
          })
          .filter(account => account !== null);
        
        console.log("Successfully decoded accounts:", allTrades.length);
      }
    } catch (error) {
      console.error('Error fetching all trades:', error);
      return []; // Return empty array if fetching fails completely
    }
    
    // Filter and map trades with additional error handling
    const filteredTrades = allTrades
      .filter(account => {
        try {
          if (!account || !account.account) {
            console.warn('Skipping null account');
            return false;
          }
          
          const trade = account.account;
          // Check if trade object has the required properties
          if (!trade.maker) {
            console.warn('Skipping trade without maker');
            return false;
          }
          
          // Use maker/taker terminology consistently
          const isMaker = trade.maker && trade.maker.equals(userPublicKey);
          const isTaker = trade.taker && trade.taker.equals(userPublicKey);
          console.log("Trade:", account.publicKey.toString(), 
            "Maker:", trade.maker?.toString(), 
            "Taker:", trade.taker?.toString(), 
            "User is maker:", isMaker, 
            "User is taker:", isTaker);
          return isMaker || isTaker;
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
            maker: trade.maker,
            taker: trade.taker,
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
      
    console.log("Filtered trades for user:", filteredTrades.length);
    return filteredTrades;
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
    amount: number
  ): Promise<void> {
    console.log(
      "TradeClient.depositTradeEscrow called",
      "Type of depositor:", typeof depositor,
      "Public key:", depositor.publicKey.toString(),
      "Amount:", amount,
      "Trade PDA:", tradePDA.toString()
    );
    
    // First, fetch the trade to get the escrow account
    console.log("Fetching trade to get escrow account...");
    const trade = await this.getTrade(tradePDA);
    if (!trade || !trade.escrowAccount) {
      throw new Error("Failed to get escrow account from trade");
    }
    
    console.log("Found escrow account:", trade.escrowAccount.toString());
    
    // Define the SOL token mint address (for Wrapped SOL)
    const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
    
    // Create instructions for a proper token-based deposit flow
    const instructions: TransactionInstruction[] = [];
    
    // 1. Get or create the Associated Token Account (ATA) for WSOL
    const depositorTokenAccount = await getAssociatedTokenAddress(
      SOL_TOKEN_MINT,
      depositor.publicKey
    );
    console.log("Using ATA for WSOL:", depositorTokenAccount.toString());
    
    // 2. Check if the token account already exists
    let wsTokenAccount;
    try {
      wsTokenAccount = await getAccount(this.connection, depositorTokenAccount);
      console.log("WSOL account exists with balance:", wsTokenAccount.amount.toString());
    } catch (error) {
      console.log("WSOL account doesn't exist, will create");
      
      // Create the ATA for WSOL
      const createATAIx = createAssociatedTokenAccountInstruction(
        depositor.publicKey,  // Payer
        depositorTokenAccount, // ATA address
        depositor.publicKey,  // Owner
        SOL_TOKEN_MINT        // Mint
      );
      instructions.push(createATAIx);
    }
    
    // 3. Create instruction to wrap SOL into WSOL (fund the token account)
    // We add a little extra to cover rent exemption and account creation
    const wrapSolIx = SystemProgram.transfer({
      fromPubkey: depositor.publicKey,
      toPubkey: depositorTokenAccount,
      lamports: amount
    });
    instructions.push(wrapSolIx);
    
    // 4. We need a sync native instruction to sync the token balance
    const syncNativeIx = createSyncNativeInstruction(depositorTokenAccount);
    instructions.push(syncNativeIx);
    
    // 5. Now prepare the deposit escrow instruction
    const depositEscrowIx = await this.program.methods
      .depositEscrow(new BN(amount))
      .accounts({
        trade: tradePDA,
        escrowAccount: trade.escrowAccount,
        depositor: depositor.publicKey,
        depositorTokenAccount: depositorTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    
    instructions.push(depositEscrowIx);
    
    // 6. Optionally add an instruction to close the token account after the deposit
    // to get SOL back from rent exemption (usually a good practice)
    // Note: We skip this to keep the example simpler, but it's recommended in production
    
    // Get the recent blockhash
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    
    // Create a transaction with all our instructions
    const tx = new Transaction();
    tx.add(...instructions);
    tx.recentBlockhash = blockhash;
    tx.feePayer = depositor.publicKey;
    
    try {
      // MAX_RETRY_ATTEMPTS for blockhash related issues
      const MAX_RETRY_ATTEMPTS = 3;
      let attempt = 0;
      let lastError: any = null;
      
      // Retry loop for handling blockhash issues
      while (attempt < MAX_RETRY_ATTEMPTS) {
        attempt++;
        console.log(`Attempt ${attempt} to deposit to escrow using WSOL flow`);
        
        try {
          // Sign the transaction
          if (depositor.keypair) {
            console.log("Signing transaction with keypair");
            tx.partialSign(depositor.keypair);
          } else if (depositor.signTransaction) {
            console.log("Signing transaction with wallet adapter");
            await depositor.signTransaction(tx);
          } else {
            throw new Error("Wallet does not support transaction signing");
          }
          
          // Send the transaction
          console.log("Sending signed transaction to the network");
          const rawTransaction = tx.serialize();
          const txid = await this.connection.sendRawTransaction(rawTransaction, {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
          });
          
          console.log("Transaction sent with ID:", txid);
          
          // Wait for confirmation with timeout warning
          const timeoutId = setTimeout(() => {
            console.log("Transaction confirmation taking longer than expected (15s)...");
          }, 15000);
          
          // Wait for confirmation
          const confirmation = await this.connection.confirmTransaction({
            blockhash,
            lastValidBlockHeight,
            signature: txid
          }, 'confirmed');
          
          // Clear the timeout
          clearTimeout(timeoutId);
          
          // Check if confirmed successfully
          if (confirmation.value.err) {
            console.error("Transaction confirmed but had an error:", confirmation.value.err);
            throw new Error(`Transaction error: ${JSON.stringify(confirmation.value.err)}`);
          }
          
          console.log("Transaction confirmed successfully!");
          return; // Success, exit the retry loop
          
        } catch (error: any) {
          lastError = error;
          console.error(`Attempt ${attempt} failed:`, error);
          
          // Only retry for specific errors related to blockhash or signatures
          if (error.message && (
              error.message.includes('blockhash') || 
              error.message.includes('signature') ||
              error.message.includes('timeout')
          )) {
            // Wait a bit before retrying
            if (attempt < MAX_RETRY_ATTEMPTS) {
              console.log(`Waiting before retry attempt ${attempt + 1}...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Get a fresh blockhash for the next attempt
              const { blockhash: newBlockhash } = await this.connection.getLatestBlockhash('confirmed');
              console.log(`Got fresh blockhash for retry: ${newBlockhash.substring(0, 8)}...`);
            }
          } else {
            // For other errors, don't retry
            break;
          }
        }
      }
      
      // If we get here, all attempts failed
      throw lastError || new Error("Failed to deposit after multiple attempts");
      
    } catch (error) {
      console.error("TradeClient.depositTradeEscrow error:", error);
      throw error; // Re-throw to be handled by the caller
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
    
    // Create the trade using proper maker terminology (wallet is the maker)
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
      maker: trade.maker.toString(),
      taker: trade.taker ? trade.taker.toString() : null,
      amount: trade.amount.toNumber() / 1e9, // Convert from lamports to SOL
      price: trade.price.toNumber() / 100, // Assuming price is in cents
      status: trade.status,
      createdAt: new Date(trade.createdAt * 1000),
      updatedAt: new Date(trade.updatedAt * 1000),
      escrowAccount: trade.escrowAccount,
      tokenMint: trade.tokenMint
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
    console.log("getUserTrades called - wallet:", wallet.publicKey?.toString());
    
    if (!wallet.publicKey) {
      console.log("No wallet public key found");
      return [];
    }
    
    const client = await createTradeClient(connection, wallet);
    console.log("Trade client created successfully");
    
    try {
      const trades = await client.getTradesByUser(wallet.publicKey);
      console.log("Raw trades fetched:", trades.length);
      
      // Convert to a more user-friendly format
      const formattedTrades = trades.map((trade: any) => {
        const result = {
          id: trade.publicKey.toString(),
          maker: trade.maker ? trade.maker.toString() : null,
          taker: trade.taker ? trade.taker.toString() : null,
          amount: trade.amount.toNumber() / 1e9, // Convert from lamports to SOL
          price: trade.price.toNumber() / 100, // Assuming price is in cents
          status: trade.status,
          createdAt: new Date(trade.createdAt * 1000),
          updatedAt: new Date(trade.updatedAt * 1000)
        };
        console.log("Formatted trade:", result);
        return result;
      });
      
      console.log("Returning formatted trades:", formattedTrades.length);
      return formattedTrades;
    } catch (fetchError: any) {
      console.error('Error fetching trades from client:', fetchError);
      toast.error(fetchError.message || 'Failed to load trades');
      return [];
    }
  } catch (error: any) {
    console.error('Error in getUserTrades:', error);
    toast.error(error.message || 'Failed to fetch user trades');
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
    await client.acceptTrade(tradePDA, wallet); // wallet becomes the taker
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
    await client.completeTrade(tradePDA, wallet); // Either maker or taker can complete
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
    await client.cancelTrade(tradePDA, wallet); // Only maker can cancel
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
    await client.disputeTrade(tradePDA, wallet); // Either maker or taker can dispute
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
  console.log(`Starting deposit of ${amount} SOL for trade ${tradePDA.toString()}`);
  console.log(`Using wallet type: ${wallet.keypair ? 'Local wallet with keypair' : 'Browser wallet'}`);
  
  try {
    // Prepare a properly formatted wallet object for Anchor
    const walletForAnchor = wallet.keypair ? {
      publicKey: wallet.publicKey,
      signTransaction: async (tx: Transaction) => {
        tx.partialSign(wallet.keypair);
        return tx;
      },
      signAllTransactions: async (txs: Transaction[]) => {
        txs.forEach(tx => tx.partialSign(wallet.keypair));
        return txs;
      },
      keypair: wallet.keypair
    } : wallet;
    
    console.log(`Deposit wallet public key: ${walletForAnchor.publicKey.toString()}`);
    if (walletForAnchor.keypair) {
      console.log(`Local wallet keypair details - Secret key length: ${walletForAnchor.keypair.secretKey.length}`);
    }
    
    // Convert SOL amount to lamports
    const lamports = LAMPORTS_PER_SOL * amount;
    console.log(`Depositing ${lamports} lamports (${amount} SOL)`);
    
    // Check if wallet has sufficient tokens for deposit
    const balance = await connection.getBalance(walletForAnchor.publicKey);
    if (balance < lamports + 5000) { // Adding buffer for tx fee
      console.error(`Insufficient balance. Required: ${lamports + 5000}, Available: ${balance}`);
      toast.error(`Insufficient balance. You need at least ${amount + 0.000005} SOL`);
      return false;
    }
    
    // Create a trade client
    const tradeClient = await createTradeClient(connection, walletForAnchor);
    console.log("Trade client created successfully");
    
    // Using our full WSOL flow (create ATA, wrap SOL, deposit, etc.)
    console.log(`Initiating WSOL-based deposit flow for trade: ${tradePDA.toString()}`);
    console.log(`This will create a token account if needed, wrap SOL, and deposit to escrow`);
    
    await tradeClient.depositTradeEscrow(tradePDA, walletForAnchor, lamports);
    
    console.log("Deposit to escrow completed successfully");
    toast.success("Deposit to escrow completed!");
    return true;
    
  } catch (error: any) {
    console.error("Error in depositTradeEscrow:", error);
    
    // Handle specific Solana errors
    if (error.message?.includes("blockhash")) {
      console.error("Transaction blockhash expired or invalid");
      toast.error("Transaction timed out. Please try again.");
    } 
    else if (error.message?.includes("0x1") || error.message?.includes("custom program error")) {
      console.error("Program validation error:", error);
      toast.error("Transaction rejected by program: Account validation failed. Check that you are the correct participant for this trade.");
    }
    else if (error.message?.includes("insufficient funds")) {
      console.error("Insufficient funds for transaction");
      toast.error("Insufficient funds to complete transaction");
    }
    else if (error.message?.includes("Invalid signer")) {
      console.error("Invalid signer error:", error);
      toast.error("Invalid wallet for signing this transaction");
    }
    else if (error.message?.includes("not recognized as a program")) {
      console.error("Program ID error:", error);
      toast.error("Contract program not found on this network");
    }
    else {
      // Generic error
      toast.error(error.message || "Failed to deposit to escrow");
    }
    
    return false;
  }
}; 