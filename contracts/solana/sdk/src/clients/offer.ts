import { Program, AnchorProvider, Idl, BN } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { Offer, OfferStatus, OfferType, OfferWithPublicKey } from '../types';
import { WalletAdapter, createWalletAdapter, hasKeypair } from '../walletAdapter';

export class OfferClient {
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

  /**
   * Create a new offer
   * 
   * @param makerWallet The maker's wallet (either keypair or wallet signer)
   * @param tokenMint The token mint public key
   * @param pricePerToken The price per token
   * @param minAmount The minimum amount
   * @param maxAmount The maximum amount
   * @param offerType The offer type (buy or sell)
   * @returns The offer PDA
   */
  async createOffer(
    makerWallet: Keypair | WalletAdapter,
    tokenMint: PublicKey,
    pricePerToken: BN,
    minAmount: BN,
    maxAmount: BN,
    offerType: OfferType
  ): Promise<string> {
    console.log("makerWallet type:", typeof makerWallet);
    console.log("makerWallet instanceof Keypair:", makerWallet instanceof Keypair);
    
    // Check if the wallet has a keypair
    const hasKeypair = !!(makerWallet instanceof Keypair || (makerWallet as any)._keypair);
    console.log("hasKeypair result:", hasKeypair);
    
    let makerPublicKey: PublicKey;
    
    if (makerWallet instanceof Keypair) {
      makerPublicKey = makerWallet.publicKey;
    } else {
      console.log("WalletAdapter detected");
      console.log("WalletAdapter properties:", Object.keys((makerWallet as any)));
      makerPublicKey = (makerWallet as WalletAdapter).publicKey;
    }
    
    // Ensure makerPublicKey is a PublicKey instance
    if (!(makerPublicKey instanceof PublicKey)) {
      makerPublicKey = new PublicKey(makerPublicKey);
    }
    
    console.log("makerPublicKey:", makerPublicKey.toString());
    console.log("makerPublicKey instanceof PublicKey:", makerPublicKey instanceof PublicKey);
    
    try {
      // Find the offer PDA
      const [offerPDA, _] = await this.findOfferAddress(
        makerPublicKey,
        tokenMint,
        offerType,
        minAmount,
        maxAmount
      );
      
      console.log("offerPDA:", offerPDA.toString());
      
      // Convert offerType to the format expected by the Anchor program
      const offerTypeArg = { [offerType === OfferType.Buy ? 'buy' : 'sell']: {} };
      
      // Create the transaction
      const tx = await this.program.methods
        .createOffer(
          pricePerToken,
          minAmount,
          maxAmount,
          offerTypeArg
        )
        .accounts({
          offer: offerPDA,
          maker: makerPublicKey,
          tokenMint: tokenMint,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .transaction();
      
      // Set the recentBlockhash for the transaction
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.feePayer = makerPublicKey;
      
      // Sign and send the transaction
      let txid: string;
      
      if (makerWallet instanceof Keypair) {
        // For Keypair, use partialSign directly
        tx.partialSign(makerWallet);
        txid = await this.connection.sendRawTransaction(tx.serialize());
      } else {
        // Create a wallet adapter if needed
        const makerAdapter = createWalletAdapter(makerWallet);
        const signedTx = await makerAdapter.signTransaction(tx);
        txid = await this.connection.sendRawTransaction(signedTx.serialize());
      }
      
      await this.connection.confirmTransaction(txid);
      return txid;
    } catch (error) {
      console.error("Error in createOffer:", error);
      throw error;
    }
  }

  /**
   * Update an offer
   * 
   * @param offerPDA The offer PDA
   * @param makerWallet The maker's wallet (either keypair or wallet signer)
   * @param price The updated price per token
   * @param minAmount The updated minimum amount
   * @param maxAmount The updated maximum amount
   * @returns The transaction ID
   */
  async updateOffer(
    offerPDA: PublicKey,
    makerWallet: Keypair | WalletAdapter,
    price?: BN,
    minAmount?: BN,
    maxAmount?: BN
  ): Promise<string> {
    let makerPublicKey: PublicKey;
    
    if (makerWallet instanceof Keypair) {
      makerPublicKey = makerWallet.publicKey;
    } else {
      makerPublicKey = (makerWallet as WalletAdapter).publicKey;
    }
    
    // Ensure makerPublicKey is a PublicKey instance
    if (!(makerPublicKey instanceof PublicKey)) {
      makerPublicKey = new PublicKey(makerPublicKey);
    }
    
    try {
      // Create the transaction
      const tx = await this.program.methods
        .updateOffer(
          price || null,
          minAmount || null,
          maxAmount || null
        )
        .accounts({
          offer: offerPDA,
          maker: makerPublicKey,
        })
        .transaction();
      
      // Set the recentBlockhash for the transaction
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.feePayer = makerPublicKey;
      
      // Sign and send the transaction
      let txid: string;
      
      if (makerWallet instanceof Keypair) {
        // For Keypair, use partialSign directly
        tx.partialSign(makerWallet);
        txid = await this.connection.sendRawTransaction(tx.serialize());
      } else {
        // Create a wallet adapter if needed
        const makerAdapter = createWalletAdapter(makerWallet);
        const signedTx = await makerAdapter.signTransaction(tx);
        txid = await this.connection.sendRawTransaction(signedTx.serialize());
      }
      
      await this.connection.confirmTransaction(txid);
      return txid;
    } catch (error) {
      console.error("Error in updateOffer:", error);
      throw error;
    }
  }

  /**
   * Pause an offer
   * 
   * @param offerPDA The offer PDA
   * @param makerWallet The maker's wallet (either keypair or wallet signer)
   */
  async pauseOffer(
    offerPDA: PublicKey,
    makerWallet: Keypair | WalletAdapter
  ): Promise<string> {
    let makerPublicKey: PublicKey;
    
    if (makerWallet instanceof Keypair) {
      makerPublicKey = makerWallet.publicKey;
    } else {
      makerPublicKey = (makerWallet as WalletAdapter).publicKey;
    }
    
    // Ensure makerPublicKey is a PublicKey instance
    if (!(makerPublicKey instanceof PublicKey)) {
      makerPublicKey = new PublicKey(makerPublicKey);
    }
    
    try {
      // Create the transaction
      const tx = await this.program.methods
        .pauseOffer()
        .accounts({
          offer: offerPDA,
          maker: makerPublicKey,
        })
        .transaction();
      
      // Set the recentBlockhash for the transaction
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.feePayer = makerPublicKey;
      
      // Sign and send the transaction
      let txid: string;
      
      if (makerWallet instanceof Keypair) {
        // For Keypair, use partialSign directly
        tx.partialSign(makerWallet);
        txid = await this.connection.sendRawTransaction(tx.serialize());
      } else {
        // Create a wallet adapter if needed
        const makerAdapter = createWalletAdapter(makerWallet);
        const signedTx = await makerAdapter.signTransaction(tx);
        txid = await this.connection.sendRawTransaction(signedTx.serialize());
      }
      
      await this.connection.confirmTransaction(txid);
      return txid;
    } catch (error) {
      console.error("Error in pauseOffer:", error);
      throw error;
    }
  }

  /**
   * Resume an offer
   * 
   * @param offerPDA The offer PDA
   * @param makerWallet The maker's wallet (either keypair or wallet signer)
   */
  async resumeOffer(
    offerPDA: PublicKey,
    makerWallet: Keypair | WalletAdapter
  ): Promise<string> {
    let makerPublicKey: PublicKey;
    
    if (makerWallet instanceof Keypair) {
      makerPublicKey = makerWallet.publicKey;
    } else {
      makerPublicKey = (makerWallet as WalletAdapter).publicKey;
    }
    
    // Ensure makerPublicKey is a PublicKey instance
    if (!(makerPublicKey instanceof PublicKey)) {
      makerPublicKey = new PublicKey(makerPublicKey);
    }
    
    try {
      // Create the transaction
      const tx = await this.program.methods
        .resumeOffer()
        .accounts({
          offer: offerPDA,
          maker: makerPublicKey,
        })
        .transaction();
      
      // Set the recentBlockhash for the transaction
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.feePayer = makerPublicKey;
      
      // Sign and send the transaction
      let txid: string;
      
      if (makerWallet instanceof Keypair) {
        // For Keypair, use partialSign directly
        tx.partialSign(makerWallet);
        txid = await this.connection.sendRawTransaction(tx.serialize());
      } else {
        // Create a wallet adapter if needed
        const makerAdapter = createWalletAdapter(makerWallet);
        const signedTx = await makerAdapter.signTransaction(tx);
        txid = await this.connection.sendRawTransaction(signedTx.serialize());
      }
      
      await this.connection.confirmTransaction(txid);
      return txid;
    } catch (error) {
      console.error("Error in resumeOffer:", error);
      throw error;
    }
  }

  /**
   * Close an offer
   * 
   * @param offerPDA The offer PDA
   * @param makerWallet The maker's wallet (either keypair or wallet signer)
   */
  async closeOffer(
    offerPDA: PublicKey,
    makerWallet: Keypair | WalletAdapter
  ): Promise<string> {
    let makerPublicKey: PublicKey;
    
    if (makerWallet instanceof Keypair) {
      makerPublicKey = makerWallet.publicKey;
    } else {
      makerPublicKey = (makerWallet as WalletAdapter).publicKey;
    }
    
    // Ensure makerPublicKey is a PublicKey instance
    if (!(makerPublicKey instanceof PublicKey)) {
      makerPublicKey = new PublicKey(makerPublicKey);
    }
    
    try {
      // Create the transaction
      const tx = await this.program.methods
        .closeOffer()
        .accounts({
          offer: offerPDA,
          maker: makerPublicKey,
        })
        .transaction();
      
      // Set the recentBlockhash for the transaction
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.feePayer = makerPublicKey;
      
      // Sign and send the transaction
      let txid: string;
      
      if (makerWallet instanceof Keypair) {
        // For Keypair, use partialSign directly
        tx.partialSign(makerWallet);
        txid = await this.connection.sendRawTransaction(tx.serialize());
      } else {
        // Create a wallet adapter if needed
        const makerAdapter = createWalletAdapter(makerWallet);
        const signedTx = await makerAdapter.signTransaction(tx);
        txid = await this.connection.sendRawTransaction(signedTx.serialize());
      }
      
      await this.connection.confirmTransaction(txid);
      return txid;
    } catch (error) {
      console.error("Error in closeOffer:", error);
      throw error;
    }
  }

  async getOffer(offerPDA: PublicKey): Promise<Offer> {
    const account = await this.program.account.offer.fetch(offerPDA);
    return {
      publicKey: offerPDA,
      maker: account.maker as PublicKey,
      tokenMint: account.tokenMint as PublicKey,
      pricePerToken: account.pricePerToken as BN,
      minAmount: account.minAmount as BN,
      maxAmount: account.maxAmount as BN,
      offerType: this.convertOfferType(account.offerType),
      status: this.convertOfferStatus(account.status),
      createdAt: (account.createdAt as BN).toNumber(),
      updatedAt: (account.updatedAt as BN).toNumber(),
    };
  }

  async findOfferAddress(
    maker: PublicKey, 
    tokenMint: PublicKey, 
    offerType: OfferType, 
    minAmount: BN, 
    maxAmount: BN
  ): Promise<[PublicKey, number]> {
    // Convert offer type to u8 (0 for Buy, 1 for Sell) - matches Rust to_u8()
    const offerTypeByte = Buffer.alloc(1);
    offerTypeByte.writeUInt8(offerType === OfferType.Buy ? 0 : 1, 0);
    
    // Convert amounts to little-endian bytes to match to_le_bytes() in Rust
    const minAmountBuffer = Buffer.alloc(8);
    minAmountBuffer.writeBigUInt64LE(BigInt(minAmount.toString()), 0);
    
    const maxAmountBuffer = Buffer.alloc(8);
    maxAmountBuffer.writeBigUInt64LE(BigInt(maxAmount.toString()), 0);
    
    return await PublicKey.findProgramAddress(
      [
        Buffer.from("offer"), 
        maker.toBuffer(),
        tokenMint.toBuffer(),
        offerTypeByte,
        minAmountBuffer,
        maxAmountBuffer
      ],
      this.program.programId
    );
  }

  /**
   * Get all offers from the program
   * @returns Array of offers with their public keys
   */
  async getAllOffers(): Promise<OfferWithPublicKey[]> {
    try {
      const accounts = await this.program.account.offer.all();
      
      return accounts.map(({ publicKey, account }) => {
        try {
          if (!account) {
            console.warn(`Account data is null for offer ${publicKey.toString()}`);
            return null;
          }

          // Safely convert the account data
          const offer: Offer = {
            publicKey,
            maker: new PublicKey(account.maker),
            tokenMint: new PublicKey(account.tokenMint),
            pricePerToken: new BN(account.pricePerToken.toString()),
            minAmount: new BN(account.minAmount.toString()),
            maxAmount: new BN(account.maxAmount.toString()),
            offerType: this.convertOfferType(account.offerType),
            status: this.convertOfferStatus(account.status),
            createdAt: new BN(account.createdAt.toString()).toNumber(),
            updatedAt: new BN(account.updatedAt.toString()).toNumber(),
          };
          
          return {
            ...offer,
            publicKey,
            account: offer
          } as OfferWithPublicKey;
        } catch (error) {
          console.error(`Error processing offer ${publicKey.toString()}:`, error);
          return null;
        }
      }).filter((offer): offer is OfferWithPublicKey => offer !== null);
    } catch (error) {
      console.error("Error in getAllOffers:", error);
      throw error;
    }
  }

  /**
   * Get all offers for a user
   * @param makerPubkey The maker's public key
   * @returns Array of offers created by the user
   */
  async getOffersByUser(makerPubkey: PublicKey): Promise<OfferWithPublicKey[]> {
    const accounts = await this.program.account.offer.all([{
      memcmp: {
        offset: 8, // After the discriminator
        bytes: makerPubkey.toBase58()
      }
    }]);
    
    return accounts.map(({ publicKey, account }) => {
      const offer: Offer = {
        publicKey,
        maker: account.maker as PublicKey,
        tokenMint: account.tokenMint as PublicKey,
        pricePerToken: account.pricePerToken as BN,
        minAmount: account.minAmount as BN,
        maxAmount: account.maxAmount as BN,
        offerType: this.convertOfferType(account.offerType),
        status: this.convertOfferStatus(account.status),
        createdAt: (account.createdAt as BN).toNumber(),
        updatedAt: (account.updatedAt as BN).toNumber(),
      };
      
      return {
        ...offer,
        publicKey,
        account: offer
      };
    });
  }

  private convertOfferStatus(status: any): OfferStatus {
    if ('active' in status) return OfferStatus.Active;
    if ('paused' in status) return OfferStatus.Paused;
    if ('closed' in status) return OfferStatus.Closed;
    throw new Error('Unknown offer status');
  }

  private convertOfferType(type: any): OfferType {
    if ('buy' in type) return OfferType.Buy;
    if ('sell' in type) return OfferType.Sell;
    throw new Error('Unknown offer type');
  }

  async unpauseOffer(
    offerPDA: PublicKey,
    makerWallet: Keypair | WalletAdapter
  ): Promise<string> {
    let makerPublicKey: PublicKey;
    
    if (makerWallet instanceof Keypair) {
      makerPublicKey = makerWallet.publicKey;
    } else {
      makerPublicKey = (makerWallet as WalletAdapter).publicKey;
    }
    
    // Ensure makerPublicKey is a PublicKey instance
    if (!(makerPublicKey instanceof PublicKey)) {
      makerPublicKey = new PublicKey(makerPublicKey);
    }
    
    try {
      // Create the transaction
      const tx = await this.program.methods
        .unpauseOffer()
        .accounts({
          offer: offerPDA,
          maker: makerPublicKey,
        })
        .transaction();
      
      // Set the recentBlockhash for the transaction
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.feePayer = makerPublicKey;
      
      // Sign and send the transaction
      let txid: string;
      
      if (makerWallet instanceof Keypair) {
        // For Keypair, use partialSign instead of sign
        tx.partialSign(makerWallet);
        txid = await this.connection.sendRawTransaction(tx.serialize());
      } else if ((makerWallet as any)._keypair) {
        // For WalletAdapter with _keypair property, extract the keypair and use partialSign
        const keypair = (makerWallet as any)._keypair;
        tx.partialSign(keypair);
        txid = await this.connection.sendRawTransaction(tx.serialize());
      } else {
        // For other WalletAdapter types
        if (typeof (makerWallet as WalletAdapter).signAndSendTransaction === 'function') {
          const { signature } = await (makerWallet as WalletAdapter).signAndSendTransaction(tx);
          txid = signature;
        } else if (typeof (makerWallet as WalletAdapter).signTransaction === 'function') {
          const signedTx = await (makerWallet as WalletAdapter).signTransaction(tx);
          txid = await this.connection.sendRawTransaction(signedTx.serialize());
        } else {
          throw new Error("Wallet does not support transaction signing");
        }
      }
      
      await this.connection.confirmTransaction(txid);
      return txid;
    } catch (error) {
      console.error("Error in unpauseOffer:", error);
      throw error;
    }
  }
} 