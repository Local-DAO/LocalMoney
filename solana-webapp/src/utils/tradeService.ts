import { AnchorProvider, BN, Idl, Program } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction, createSyncNativeInstruction } from '@solana/spl-token';
import { TradeStatus } from '@localmoney/solana-sdk';
import toast from 'react-hot-toast';
import { Wallet } from '@project-serum/anchor/dist/cjs/provider';

// Define the Trade interface locally since it's not exported from the SDK
interface Trade {
  publicKey?: PublicKey;
  maker: PublicKey;
  taker: PublicKey | null;
  amount: BN;
  price: BN;
  tokenMint: PublicKey;
  escrowAccount: PublicKey;
  status: TradeStatus;
  createdAt: number;
  updatedAt: number;
  bump: number;
}

// Define a type for the possible wallet methods
type WalletMethod = 'signTransaction' | 'sign' | 'signAndSendTransaction' | '_signTransaction' | 'sendTransaction';

// Define a wallet interface that has at least a publicKey
interface WalletWithPublicKey {
  publicKey: PublicKey;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  // Add keypair property that might exist on some wallet implementations
  keypair?: Keypair;
  // Use a more specific index signature for wallet methods
  [methodName: string]: unknown;
}

// Create a wrapper that implements the Anchor Wallet interface for browser wallets
class BrowserWalletAdapter implements Wallet {
  constructor(private wallet: WalletWithPublicKey, private fallbackConnection: Connection) {
    if (!wallet.publicKey) {
      throw new Error("Wallet has no publicKey");
    }
  }

  get publicKey(): PublicKey {
    return this.wallet.publicKey;
  }

  // Attempt to sign a transaction even if no standard sign method exists
  private async tryUnsafeSignTransaction(tx: Transaction): Promise<Transaction> {
    console.log("Attempting unsafe transaction signing...");
    console.log("Wallet public key:", this.wallet.publicKey.toString());
    
    // Check if wallet has a keypair property (direct access to the keypair)
    if ('keypair' in this.wallet && this.wallet.keypair) {
      console.log("Found keypair property in wallet, using it directly for signing");
      try {
        // Add recent blockhash if not present
        if (!tx.recentBlockhash) {
          console.log("Adding recent blockhash to transaction");
          const { blockhash } = await this.fallbackConnection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;
        }
        
        // Make sure the transaction has the correct feePayer
        if (!tx.feePayer) {
          console.log("Setting fee payer to wallet public key");
          tx.feePayer = this.wallet.publicKey;
        }
        
        // Sign the transaction with the keypair
        console.log("Signing transaction with wallet keypair");
        tx.partialSign(this.wallet.keypair);
        
        // Check if the signature was added
        const signatures = tx.signatures.filter(sig => sig.signature !== null);
        console.log("Transaction now has", signatures.length, "signatures");
        
        if (signatures.length > 0) {
          console.log("Successfully signed transaction with keypair");
          return tx;
        } else {
          console.log("Failed to add signature using keypair");
        }
      } catch (e) {
        console.error("Error signing with keypair:", e);
      }
    }
    
    // Check if this wallet is a LocalWalletAdapter from our custom implementation
    const isLocalWalletAdapter = Object.getPrototypeOf(this.wallet).constructor.name === 'LocalWalletAdapter';
    if (isLocalWalletAdapter) {
      console.log("Detected LocalWalletAdapter, attempting to use its native method");
      try {
        // Define a more specific type for the LocalWalletAdapter's signTransaction method
        interface LocalWalletWithSignMethod extends WalletWithPublicKey {
          signTransaction: (tx: Transaction) => Promise<Transaction>;
        }
        
        // For LocalWalletAdapter, we know the implementation has a signTransaction method
        // that directly uses keypair.sign() which should work
        return await (this.wallet as LocalWalletWithSignMethod).signTransaction(tx);
      } catch (e) {
        console.error("Failed to use LocalWalletAdapter's signTransaction:", e);
      }
    }
    
    // Try all possible sign methods that might exist on wallet adapters
    const possibleSignMethods: WalletMethod[] = [
      'signTransaction',
      'sign',
      'signAndSendTransaction',
      '_signTransaction',
      'sendTransaction'
    ];
    
    // First ensure the transaction has the necessary fields
    // Add recent blockhash if not present
    if (!tx.recentBlockhash) {
      console.log("Adding recent blockhash to transaction");
      const { blockhash } = await this.fallbackConnection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
    }
    
    // Make sure the transaction has the correct feePayer
    if (!tx.feePayer) {
      console.log("Setting fee payer to wallet public key");
      tx.feePayer = this.wallet.publicKey;
    }

    // Check if the transaction already has signatures
    const existingSignatures = tx.signatures.filter(sig => sig.signature !== null);
    console.log("Transaction already has", existingSignatures.length, "signatures");
    
    for (const method of possibleSignMethods) {
      if (typeof this.wallet[method] === 'function') {
        try {
          console.log(`Trying wallet method: ${method}`);
          
          const result = await this.wallet[method](tx);
          console.log(`Result from ${method}:`, result ? "success" : "null/undefined");
          
          if (result instanceof Transaction) {
            // Check if the transaction now has signatures
            const newSignatures = result.signatures.filter(sig => sig.signature !== null);
            console.log("Transaction now has", newSignatures.length, "signatures");
            
            if (newSignatures.length > existingSignatures.length) {
              console.log(`Successfully signed transaction with ${method}`);
              return result;
            } else {
              console.log(`Method ${method} didn't add signatures`);
            }
          } else {
            console.log(`Method ${method} didn't return a Transaction:`, result);
          }
        } catch (e) {
          console.error(`Failed with method ${method}:`, e);
        }
      }
    }
    
    // If all else fails, return the original transaction
    console.warn("All signing methods failed, returning unsigned transaction");
    return tx;
  }

  async signTransaction(tx: Transaction): Promise<Transaction> {
    // Log detailed information about the wallet object for debugging
    console.log("Wallet object type:", Object.prototype.toString.call(this.wallet));
    console.log("Available wallet methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(this.wallet))
      .filter(prop => typeof this.wallet[prop] === 'function')
      .join(', '));
    
    // Check for the signTransaction method more carefully
    const hasSignTransactionMethod = 
      this.wallet.signTransaction !== undefined && 
      typeof this.wallet.signTransaction === 'function';
    
    if (!hasSignTransactionMethod) {
      console.warn("Standard signTransaction method not found, trying unsafe methods");
      return this.tryUnsafeSignTransaction(tx);
    }
    
    try {
      console.log("Using standard signTransaction method");
      // Since we've checked that signTransaction exists and is a function, we can safely call it
      return await (this.wallet.signTransaction as (tx: Transaction) => Promise<Transaction>)(tx);
    } catch (error) {
      console.error("Error using standard signTransaction method:", error);
      return this.tryUnsafeSignTransaction(tx);
    }
  }

  async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    if (!this.wallet.signAllTransactions) {
      // Try to sign each transaction individually
      console.warn("signAllTransactions not available, signing each transaction individually");
      return Promise.all(txs.map(tx => this.signTransaction(tx)));
    }
    
    try {
      return await this.wallet.signAllTransactions(txs);
    } catch (error) {
      console.error("Error using standard signAllTransactions method:", error);
      return Promise.all(txs.map(tx => this.signTransaction(tx)));
    }
  }
}

// Program IDs from environment variables
const TRADE_PROGRAM_ID = process.env.NEXT_PUBLIC_TRADE_PROGRAM_ID || '2ebQZghoJAExZ64eUuw5xq7GVycibtsyA2yPKgfNSYNj';
const PRICE_PROGRAM_ID = process.env.NEXT_PUBLIC_PRICE_PROGRAM_ID || 'BGuwRibtPCCLCo98AFDk6C3QUPS2VHBkTRyDgkCrySfG';
const PROFILE_PROGRAM_ID = process.env.NEXT_PUBLIC_PROFILE_PROGRAM_ID || '8FJf3ymGwZ2ctUP85QRCsE2kMcuQY5Eu7X3dyXr7XakD';
const SOL_TOKEN_MINT = 'So11111111111111111111111111111111111111112';

// Helper function to check token balance and airdrop SOL if needed
const LAMPORTS_PER_SOL = 1000000000;
const ensureSufficientTokens = async (
  connection: Connection,
  wallet: WalletWithPublicKey,
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
          const airdropSignature = await connection.requestAirdrop(wallet.publicKey, 111 * LAMPORTS_PER_SOL);
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
      } catch {
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
  wallet: WalletWithPublicKey
): Promise<TradeClient> => {
  // Validate wallet has necessary methods
  if (!wallet) {
    throw new Error("Wallet is undefined");
  }
  
  if (!wallet.publicKey) {
    throw new Error("Wallet has no publicKey");
  }
  
  // Log wallet capabilities for debugging
  console.log("Wallet capabilities:", {
    hasPublicKey: !!wallet.publicKey,
    hasSignTransaction: typeof wallet.signTransaction === 'function',
    hasSignAllTransactions: typeof wallet.signAllTransactions === 'function',
    walletType: wallet.constructor?.name || 'unknown'
  });
  
  // Create browser-specific wallet adapter with connection for blockhash lookup
  const walletAdapter = new BrowserWalletAdapter(wallet, connection);
  
  // Create provider with the wallet adapter
  const provider = new AnchorProvider(
    connection, 
    walletAdapter, 
    { 
      commitment: 'confirmed', 
      preflightCommitment: 'confirmed',
      skipPreflight: false
    }
  );
  
  // Log provider details
  console.log("Created AnchorProvider:", {
    hasWallet: !!provider.wallet,
    walletPublicKey: provider.wallet.publicKey.toString()
  });
  
  const programId = new PublicKey(TRADE_PROGRAM_ID);
  
  // Fetch the IDL
  let idl;
  try {
    idl = await Program.fetchIdl(programId, provider);
    if (!idl) {
      console.log("IDL not found on chain, fetching from local file...");
      idl = await (await fetch('/idl/trade.json')).json();
    }
  } catch (error) {
    console.error("Error fetching IDL:", error);
    console.log("Falling back to local IDL file...");
    idl = await (await fetch('/idl/trade.json')).json();
  }
  
  if (!idl) {
    throw new Error("Failed to load IDL from chain or local file");
  }
  
  console.log("IDL loaded successfully:", {
    name: idl.name,
    instructions: idl.instructions?.length || 0
  });
  
  return new TradeClient(programId, provider, idl);
};

// Type to represent the status variants from Anchor
type TradeStatusVariant = {
  created?: Record<string, never>;
  open?: Record<string, never>;
  inProgress?: Record<string, never>;
  completed?: Record<string, never>;
  cancelled?: Record<string, never>;
  disputed?: Record<string, never>;
};

// Real TradeClient implementation based on SDK
class TradeClient {
  private program: Program;
  private connection: Connection;
  private wallet: Wallet;
  private provider: AnchorProvider;

  constructor(programId: PublicKey, provider: AnchorProvider, idl: Idl) {
    if (!idl.instructions || !idl.instructions.some(i => i.name === "createTrade")) {
      throw new Error("IDL is missing createTrade instruction");
    }

    this.provider = provider;
    this.connection = provider.connection;
    this.wallet = provider.wallet;
    
    // Use provider directly when creating the program
    this.program = new Program(idl, programId, this.provider);
    
    if (!this.program.methods?.createTrade) {
      throw new Error("Program initialized but createTrade method is missing");
    }
    
    console.log("TradeClient initialized with provider wallet:", this.wallet.publicKey.toString());
  }

  async createTrade(
    wallet: WalletWithPublicKey,
    tokenMint: PublicKey,
    makerTokenAccount: PublicKey,
    escrowAccount: Keypair,
    amount: BN,
    price: BN
  ): Promise<PublicKey> {
    if (!this.program.methods?.createTrade) {
      throw new Error("createTrade method is not available");
    }

    if (!wallet.publicKey) {
      throw new Error("Wallet public key is not available");
    }
    
    console.log("Creating trade with wallet:", wallet.publicKey.toString());
    console.log("Provider wallet:", this.wallet.publicKey.toString());
    
    // Check properties of the wallet object to diagnose issues
    console.log("Wallet object properties:", Object.getOwnPropertyNames(wallet));
    console.log("Wallet has signTransaction:", wallet.signTransaction !== undefined);
    console.log("Wallet has keypair:", wallet.keypair !== undefined);
    
    if (wallet.signTransaction) {
      console.log("signTransaction type:", typeof wallet.signTransaction);
    } else {
      console.log("Wallet does not have signTransaction method");
    }
    
    // Check if we can access the wallet prototype
    try {
      const protoProps = Object.getOwnPropertyNames(Object.getPrototypeOf(wallet));
      console.log("Wallet prototype properties:", protoProps);
    } catch (e) {
      console.log("Could not access wallet prototype:", e);
    }

    // Check if the wallet is the same as the provider wallet
    const isProviderWallet = wallet.publicKey.equals(this.wallet.publicKey);
    if (!isProviderWallet) {
      console.warn("Warning: The wallet public key doesn't match the provider wallet public key");
      console.warn("This may cause signature verification failures if the instruction requires the maker to sign");
    }

    const [tradePDA] = await PublicKey.findProgramAddress(
      [Buffer.from("trade"), wallet.publicKey.toBuffer(), tokenMint.toBuffer()],
      this.program.programId
    );
    
    console.log("Generated trade PDA:", tradePDA.toString());
    console.log("Starting transaction...");

    try {
      // Create the method call but don't execute it yet
      const method = this.program.methods
        .createTrade(amount, price)
        .accounts({
          trade: tradePDA,
          maker: wallet.publicKey,
          tokenMint,
          makerTokenAccount,
          escrowAccount: escrowAccount.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([escrowAccount]);
      
      // Special case for wallets with keypair but no signTransaction method
      if ('keypair' in wallet && wallet.keypair && !wallet.signTransaction) {
        console.log("Using wallet with keypair directly for transaction");
        
        // Get the transaction object
        const transaction = await method.transaction();
        
        // Set recent blockhash
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        // Sign with keypair directly
        console.log("Signing transaction with direct keypair access");
        transaction.partialSign(escrowAccount, wallet.keypair);
        
        // Send and confirm
        const serializedTx = transaction.serialize();
        console.log("Transaction serialized successfully with", transaction.signatures.length, "signatures");
        
        const txId = await this.connection.sendRawTransaction(serializedTx);
        await this.connection.confirmTransaction(txId, 'confirmed');
        console.log("Transaction confirmed with ID:", txId);
        
        console.log("Transaction completed successfully");
        return tradePDA;
      }
      // If we're not using the provider's wallet, we need a custom approach
      else if (!isProviderWallet) {
        console.log("Using custom transaction signing approach since wallet doesn't match provider");
        
        // Get the transaction object
        const transaction = await method.transaction();
        
        // Set recent blockhash
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        // Add escrow account signature
        transaction.partialSign(escrowAccount);
        console.log("Transaction partially signed with escrow account");
        
        // Wrap in try-catch to provide better error diagnostics
        try {
          if (!wallet.signTransaction) {
            console.error("Wallet does not have signTransaction method!");
            
            // Try to use the provider's wallet as a fallback
            console.log("Attempting to use provider's wallet as a fallback...");
            const signedTx = await this.wallet.signTransaction(transaction);
            console.log("Successfully signed with provider wallet");
            
            // Send and confirm
            const txId = await this.connection.sendRawTransaction(signedTx.serialize());
            await this.connection.confirmTransaction(txId, 'confirmed');
            console.log("Transaction confirmed with ID:", txId);
          } else {
            // Sign with the provided wallet
            console.log("About to sign transaction with provided wallet");
            const signedTx = await wallet.signTransaction(transaction);
            console.log("Transaction signed by wallet");
            
            // Check that we have the required signatures
            const sigCount = signedTx.signatures.filter(sig => sig.signature !== null).length;
            console.log(`Transaction has ${sigCount} signatures`);
            
            // Send and confirm
            const txId = await this.connection.sendRawTransaction(signedTx.serialize());
            await this.connection.confirmTransaction(txId, 'confirmed');
            console.log("Transaction confirmed with ID:", txId);
          }
        } catch (signError) {
          console.error("Error during transaction signing:", signError);
          
          // As a last resort, try a direct approach
          console.log("Trying direct transaction approach...");
          const txId = await this.sendRawTransaction(transaction, [escrowAccount]);
          console.log("Transaction sent with ID:", txId);
          await this.connection.confirmTransaction(txId, 'confirmed');
        }
      } else {
        // Use the Anchor Program's normal flow which uses the provider's wallet
        console.log("Using Anchor program's standard approach with provider wallet");
        await method.rpc();
        console.log("Anchor transaction completed");
      }
      
      console.log("Transaction completed successfully");
      return tradePDA;
    } catch (error) {
      console.error("Error in createTrade transaction:", error);
      throw error;
    }
  }

  // Helper method to send a transaction with multiple signers
  private async sendRawTransaction(transaction: Transaction, signers: Keypair[]): Promise<string> {
    // Add the signers
    transaction.partialSign(...signers);
    
    if (this.wallet.signTransaction) {
      const signed = await this.wallet.signTransaction(transaction);
      console.log("Transaction signed by wallet adapter");
      return await this.connection.sendRawTransaction(signed.serialize());
    } else {
      console.warn("Wallet adapter lacks signTransaction, but continuing with partial signatures only");
      return await this.connection.sendRawTransaction(transaction.serialize());
    }
  }

  async acceptTrade(
    tradePDA: PublicKey,
    taker: WalletWithPublicKey
  ): Promise<void> {
    if (!taker.publicKey) {
      throw new Error("Taker public key is not available");
    }
    
    await this.program.methods
      .acceptTrade()
      .accounts({
        trade: tradePDA,
        taker: taker.publicKey,
      })
      .signers([])
      .rpc();
  }

  async completeTrade(
    tradePDA: PublicKey,
    maker: WalletWithPublicKey,
    taker: WalletWithPublicKey,
    escrowAccount: PublicKey,
    takerTokenAccount: PublicKey,
    priceOracle: PublicKey,
    takerProfile: PublicKey,
    makerProfile: PublicKey
  ): Promise<void> {
    if (!maker.publicKey || !taker.publicKey) {
      throw new Error("Maker or taker public key is not available");
    }
    
    await this.program.methods
      .completeTrade()
      .accounts({
        trade: tradePDA,
        maker: maker.publicKey,
        taker: taker.publicKey,
        escrowAccount,
        takerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        priceOracle,
        priceProgram: new PublicKey(PRICE_PROGRAM_ID),
        takerProfile,
        makerProfile,
        profileProgram: new PublicKey(PROFILE_PROGRAM_ID),
      })
      .signers([])
      .rpc();
  }

  async cancelTrade(
    tradePDA: PublicKey,
    maker: WalletWithPublicKey,
    escrowAccount: PublicKey,
    makerTokenAccount: PublicKey
  ): Promise<void> {
    if (!maker.publicKey) {
      throw new Error("Maker public key is not available");
    }
    
    await this.program.methods
      .cancelTrade()
      .accounts({
        trade: tradePDA,
        maker: maker.publicKey,
        escrowAccount,
        makerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([])
      .rpc();
  }

  async disputeTrade(
    tradePDA: PublicKey,
    disputer: WalletWithPublicKey
  ): Promise<void> {
    if (!disputer.publicKey) {
      throw new Error("Disputer public key is not available");
    }
    
    await this.program.methods
      .disputeTrade()
      .accounts({
        trade: tradePDA,
        disputer: disputer.publicKey,
      })
      .signers([])
      .rpc();
  }

  async getTrade(tradePDA: PublicKey): Promise<Trade> {
    const account = await this.program.account.trade.fetch(tradePDA);
    return {
      publicKey: tradePDA,
      maker: account.maker,
      taker: account.taker,
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

  async findTradeAddress(
    maker: PublicKey,
    tokenMint: PublicKey
  ): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from("trade"),
        maker.toBuffer(),
        tokenMint.toBuffer(),
      ],
      this.program.programId
    );
  }

  async depositEscrow(
    tradePDA: PublicKey,
    depositor: WalletWithPublicKey,
    depositorTokenAccount: PublicKey,
    escrowAccount: PublicKey,
    amount: BN
  ): Promise<void> {
    if (!depositor.publicKey) {
      throw new Error("Depositor public key is not available");
    }

    console.log("Depositing to escrow with depositor:", depositor.publicKey.toString());
    console.log("Provider wallet:", this.wallet.publicKey.toString());
    console.log("Depositor has keypair:", depositor.keypair !== undefined);

    // Check if the depositor is the same as the provider wallet
    const isProviderWallet = depositor.publicKey.equals(this.wallet.publicKey);
    if (!isProviderWallet) {
      console.warn("Warning: The depositor public key doesn't match the provider wallet public key");
      console.warn("This may cause signature verification failures if the instruction requires the depositor to sign");
    }

    console.log("Deposit details:", {
      tradePDA: tradePDA.toString(),
      depositorTokenAccount: depositorTokenAccount.toString(),
      escrowAccount: escrowAccount.toString(),
      amount: amount.toString()
    });

    try {
      // Create the method call but don't execute it yet
      const method = this.program.methods
        .depositEscrow(amount)
        .accounts({
          trade: tradePDA,
          escrowAccount: escrowAccount,
          depositor: depositor.publicKey,
          depositorTokenAccount: depositorTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([]);
      
      // Special case for wallets with keypair but no signTransaction method
      if ('keypair' in depositor && depositor.keypair && !depositor.signTransaction) {
        console.log("Using depositor wallet with keypair directly for transaction");
        
        // Get the transaction object
        const transaction = await method.transaction();
        
        // Set recent blockhash
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = depositor.publicKey;
        
        // Sign with keypair directly
        console.log("Signing deposit transaction with direct keypair access");
        transaction.partialSign(depositor.keypair);
        
        // Send and confirm
        const serializedTx = transaction.serialize();
        console.log("Deposit transaction serialized successfully with", transaction.signatures.length, "signatures");
        
        const txId = await this.connection.sendRawTransaction(serializedTx);
        await this.connection.confirmTransaction(txId, 'confirmed');
        console.log("Deposit transaction confirmed with ID:", txId);
      }
      // If we're not using the provider's wallet, we need a custom approach
      else if (!isProviderWallet && depositor.signTransaction) {
        console.log("Using custom transaction signing approach since depositor doesn't match provider");
        
        // Get the transaction object
        const transaction = await method.transaction();
        
        // Set recent blockhash
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = depositor.publicKey;
        
        // Sign with the depositor wallet
        const signedTx = await depositor.signTransaction(transaction);
        
        // Send and confirm
        const txId = await this.connection.sendRawTransaction(signedTx.serialize());
        await this.connection.confirmTransaction(txId, 'confirmed');
        console.log("Deposit transaction confirmed with ID:", txId);
      } else {
        // Use the Anchor Program's normal flow which uses the provider's wallet
        await method.rpc();
      }
      
      console.log("Deposit completed successfully");
    } catch (error) {
      console.error("Error in depositEscrow transaction:", error);
      throw error;
    }
  }

  async getTradesByUser(userPublicKey: PublicKey): Promise<Trade[]> {
    try {
      console.log(`Searching for trades involving user: ${userPublicKey.toString()}`);
      
      // Get all accounts owned by our program
      const accounts = await this.connection.getProgramAccounts(this.program.programId, {
        commitment: 'confirmed',
        filters: [
          {
            dataSize: 8 + 32 + (1 + 32) + 8 + 8 + 32 + 32 + 1 + 8 + 8 + 1, // Size of Trade account
          }
        ]
      });
      
      console.log(`Found ${accounts.length} total accounts owned by the program`);
      
      const trades: Trade[] = [];
      
      for (const account of accounts) {
        try {
          // Fetch and decode each account
          console.log(`Checking account: ${account.pubkey.toString()}`);
          const accountInfo = await this.program.account.trade.fetch(account.pubkey);
          
          console.log(`Account data:`, {
            maker: accountInfo.maker.toString(),
            taker: accountInfo.taker ? accountInfo.taker.toString() : null,
          });
          
          // Check if this trade belongs to the user
          const makerPubkey = accountInfo.maker as PublicKey;
          const takerPubkey = accountInfo.taker as PublicKey | null;
          
          const isMaker = makerPubkey.equals(userPublicKey);
          const isTaker = takerPubkey && takerPubkey.equals(userPublicKey);
          
          console.log(`Is maker: ${isMaker}, Is taker: ${isTaker}`);
          
          if (isMaker || isTaker) {
            console.log(`Found matching trade: ${account.pubkey.toString()}`);
            const trade: Trade = {
              publicKey: account.pubkey,
              maker: makerPubkey,
              taker: takerPubkey,
              amount: accountInfo.amount as BN,
              price: accountInfo.price as BN,
              tokenMint: accountInfo.tokenMint as PublicKey,
              escrowAccount: accountInfo.escrowAccount as PublicKey,
              status: this.convertTradeStatus(accountInfo.status),
              createdAt: (accountInfo.createdAt as BN).toNumber(),
              updatedAt: (accountInfo.updatedAt as BN).toNumber(),
              bump: accountInfo.bump as number,
            };
            trades.push(trade);
          }
        } catch (error) {
          console.error(`Error processing account ${account.pubkey.toString()}:`, error);
        }
      }
      
      console.log(`Returning ${trades.length} trades for user ${userPublicKey.toString()}`);
      return trades;
    } catch (error) {
      console.error("Error in getTradesByUser:", error);
      return []; // Return empty array on error
    }
  }

  private convertTradeStatus(status: TradeStatusVariant): TradeStatus {
    if ('created' in status) return TradeStatus.Created;
    if ('open' in status) return TradeStatus.Open;
    if ('inProgress' in status) return TradeStatus.InProgress;
    if ('completed' in status) return TradeStatus.Completed;
    if ('cancelled' in status) return TradeStatus.Cancelled;
    if ('disputed' in status) return TradeStatus.Disputed;
    throw new Error('Unknown trade status');
  }
}

// Properly type the trade return type
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

// Public API functions
// These exposed functions are simplified wrappers around the client methods
export const createTrade = async (
  connection: Connection,
  wallet: WalletWithPublicKey,
  tokenMint: PublicKey,
  amount: number,
  price: number
): Promise<string | null> => {
  try {
    console.log("createTrade called with params:", {
      tokenMint: tokenMint ? tokenMint.toString() : 'undefined',
      amount,
      price,
      walletPublicKey: wallet?.publicKey ? wallet.publicKey.toString() : 'undefined'
    });
    
    // Validate inputs
    if (!connection) {
      console.error("Cannot create trade with undefined connection");
      throw new Error("Invalid connection");
    }
    
    if (!wallet || !wallet.publicKey) {
      console.error("Cannot create trade with undefined wallet or wallet without publicKey");
      throw new Error("Invalid wallet");
    }
    
    if (!tokenMint) {
      console.error("Cannot create trade with undefined tokenMint");
      throw new Error("Invalid token mint");
    }
    
    const client = await createTradeClient(connection, wallet);
    console.log("Trade client created successfully");
    
    // Convert amount and price to BN
    const amountBN = new BN(amount);
    const priceBN = new BN(price);
    
    // Check if user has enough tokens
    const hasEnoughTokens = await ensureSufficientTokens(
      connection,
      wallet,
      tokenMint,
      amountBN
    );
    
    if (!hasEnoughTokens) {
      toast.error('Insufficient token balance for trade');
      return null;
    }
    
    // Get or create token account
    console.log("Getting associated token address");
    const makerTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );
    
    // Check if we're using SOL token
    const isSolToken = tokenMint.toString() === SOL_TOKEN_MINT;
    
    if (isSolToken) {
      // For SOL tokens, we need to check if the ATA exists and create it if needed
      console.log("Using SOL token, checking if associated token account exists");
      
      try {
        // Try to get the account, if it fails with AccountNotFoundError, create it
        await getAccount(connection, makerTokenAccount);
        console.log("SOL token account already exists");
      } catch (error: unknown) {
        // Type guard to check if error has name property
        if (error && typeof error === 'object' && 'name' in error && error.name === 'TokenAccountNotFoundError') {
          console.log("SOL token account does not exist, creating it...");
          
          // Create the transaction to create the associated token account
          const transaction = new Transaction();
          
          // Add instruction to create associated token account
          transaction.add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey, // payer
              makerTokenAccount, // associated token account address
              wallet.publicKey, // owner
              tokenMint // mint
            )
          );
          
          // Add instruction to wrap SOL
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: makerTokenAccount,
              lamports: amountBN.toNumber() // Transfer the amount needed for the trade
            })
          );
          
          // Add instruction to sync native
          transaction.add(
            createSyncNativeInstruction(makerTokenAccount)
          );
          
          // Set recent blockhash
          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = wallet.publicKey;
          
          // Sign and send the transaction
          if ('keypair' in wallet && wallet.keypair) {
            console.log("Signing token account creation with wallet keypair");
            // Use the keypair directly
            transaction.sign(wallet.keypair);
            const serializedTx = transaction.serialize();
            const txId = await connection.sendRawTransaction(serializedTx);
            await connection.confirmTransaction(txId, 'confirmed');
            console.log("Token account created with ID:", txId);
          } else if (wallet.signTransaction) {
            console.log("Signing token account creation with wallet.signTransaction");
            const signedTx = await wallet.signTransaction(transaction);
            const txId = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(txId, 'confirmed');
            console.log("Token account created with ID:", txId);
          } else {
            // No way to sign, abort
            console.error("Cannot create token account - no way to sign transactions");
            toast.error('Failed to create token account. No signing method available.');
            return null;
          }
          
          // Wait a little to ensure the token account is recognized
          console.log("Waiting for token account to be recognized...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // Some other error occurred
          console.error("Error checking token account:", error);
          throw error;
        }
      }
    }
    
    // Create escrow account
    console.log("Generating escrow account keypair");
    const escrowAccount = Keypair.generate();
    
    // Create the trade
    console.log("Creating trade via client");
    const tradePDA = await client.createTrade(
      wallet,
      tokenMint,
      makerTokenAccount,
      escrowAccount,
      amountBN,
      priceBN
    );
    
    console.log("Trade created with PDA:", tradePDA.toString());
    
    // Deposit tokens to escrow
    console.log("Depositing to escrow");
    await client.depositEscrow(
      tradePDA,
      wallet,
      makerTokenAccount,
      escrowAccount.publicKey,
      amountBN
    );
    
    console.log("Trade and escrow deposit completed successfully");
    return tradePDA.toString();
  } catch (error) {
    console.error("Error in createTrade:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.error(`Failed to create trade: ${errorMessage}`);
    return null;
  }
};

export const getTrade = async (
  connection: Connection,
  wallet: WalletWithPublicKey,
  tradePDA: PublicKey
): Promise<TradeInfo | null> => {
  try {
    const client = await createTradeClient(connection, wallet);
    const trade = await client.getTrade(tradePDA);
    
    // Format the trade data for the UI
    return {
      id: trade.publicKey?.toString() || tradePDA.toString(),
      maker: trade.maker.toString(),
      taker: trade.taker ? trade.taker.toString() : null,
      amount: trade.amount.toNumber(),
      price: trade.price.toNumber(),
      tokenMint: trade.tokenMint.toString(),
      escrowAccount: trade.escrowAccount.toString(),
      status: trade.status,
      createdAt: new Date(trade.createdAt * 1000),
      updatedAt: new Date(trade.updatedAt * 1000),
    };
  } catch (error) {
    console.error('Error getting trade:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.error(errorMessage || 'Failed to get trade');
    return null;
  }
};

export const getUserTrades = async (
  connection: Connection,
  wallet: WalletWithPublicKey
): Promise<TradeInfo[]> => {
  try {
    if (!wallet || !wallet.publicKey) {
      console.error('Wallet not properly configured for getUserTrades');
      return [];
    }
    
    const client = await createTradeClient(connection, wallet);
    const trades = await client.getTradesByUser(wallet.publicKey);
    
    // Format the trades for the UI
    return trades.map(trade => ({
      id: trade.publicKey?.toString() || 'unknown-id',
      maker: trade.maker.toString(),
      taker: trade.taker ? trade.taker.toString() : null,
      amount: trade.amount.toNumber(),
      price: trade.price.toNumber(),
      tokenMint: trade.tokenMint.toString(),
      escrowAccount: trade.escrowAccount.toString(),
      status: trade.status,
      createdAt: new Date(trade.createdAt * 1000),
      updatedAt: new Date(trade.updatedAt * 1000),
    }));
  } catch (error) {
    console.error('Error getting user trades:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.error(errorMessage || 'Failed to get user trades');
    return [];
  }
};

export const acceptTrade = async (
  connection: Connection,
  wallet: WalletWithPublicKey,
  tradePDA: PublicKey
): Promise<boolean> => {
  try {
    const client = await createTradeClient(connection, wallet);
    await client.acceptTrade(tradePDA, wallet);
    toast.success('Trade accepted successfully');
    return true;
  } catch (error) {
    console.error('Error accepting trade:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.error(errorMessage || 'Failed to accept trade');
    return false;
  }
};

export const completeTrade = async (
  connection: Connection,
  wallet: WalletWithPublicKey,
  tradePDA: PublicKey,
  maker: PublicKey,
  taker: PublicKey,
  escrowAccount: PublicKey,
  takerTokenAccount: PublicKey,
  priceOracle: PublicKey,
  takerProfile: PublicKey,
  makerProfile: PublicKey
): Promise<boolean> => {
  try {
    const client = await createTradeClient(connection, wallet);
    await client.completeTrade(
      tradePDA,
      { publicKey: maker },
      { publicKey: taker },
      escrowAccount,
      takerTokenAccount,
      priceOracle,
      takerProfile,
      makerProfile
    );
    toast.success('Trade completed successfully');
    return true;
  } catch (error) {
    console.error('Error completing trade:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.error(errorMessage || 'Failed to complete trade');
    return false;
  }
};

export const cancelTrade = async (
  connection: Connection,
  wallet: WalletWithPublicKey,
  tradePDA: PublicKey,
  escrowAccount: PublicKey,
  makerTokenAccount: PublicKey
): Promise<boolean> => {
  try {
    const client = await createTradeClient(connection, wallet);
    await client.cancelTrade(tradePDA, wallet, escrowAccount, makerTokenAccount);
    toast.success('Trade cancelled successfully');
    return true;
  } catch (error) {
    console.error('Error cancelling trade:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.error(errorMessage || 'Failed to cancel trade');
    return false;
  }
};

export const disputeTrade = async (
  connection: Connection,
  wallet: WalletWithPublicKey,
  tradePDA: PublicKey
): Promise<boolean> => {
  try {
    const client = await createTradeClient(connection, wallet);
    await client.disputeTrade(tradePDA, wallet);
    toast.success('Trade disputed successfully');
    return true;
  } catch (error) {
    console.error('Error disputing trade:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.error(errorMessage || 'Failed to dispute trade');
    return false;
  }
};

export const depositTradeEscrow = async (
  connection: Connection,
  wallet: WalletWithPublicKey,
  tradePDA: PublicKey,
  tokenMint: PublicKey,
  amount: number
): Promise<boolean> => {
  try {
    const client = await createTradeClient(connection, wallet);
    
    // Convert amount to BN
    const amountBN = new BN(amount);
    
    // Check if user has enough tokens
    const hasEnoughTokens = await ensureSufficientTokens(
      connection,
      wallet,
      tokenMint,
      amountBN
    );
    
    if (!hasEnoughTokens) {
      toast.error('Insufficient token balance for deposit');
      return false;
    }
    
    // Get trade details to get escrow account
    const trade = await client.getTrade(tradePDA);
    
    // Get token account
    const depositorTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );
    
    // Deposit tokens to escrow
    await client.depositEscrow(
      tradePDA,
      wallet,
      depositorTokenAccount,
      trade.escrowAccount,
      amountBN
    );
    
    toast.success('Tokens deposited to escrow successfully');
    return true;
  } catch (error) {
    console.error('Error depositing to escrow:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.error(errorMessage || 'Failed to deposit to escrow');
    return false;
  }
}; 