import { BN } from '@project-serum/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { OfferClient } from '../../../contracts/solana/sdk/src/clients/offer';
import { OfferStatus, OfferWithPublicKey, OfferType } from '../../../contracts/solana/sdk/src/types';
import { GenericWallet, createWalletAdapter, createAnchorProvider, ensureSufficientSol } from '../../../contracts/solana/sdk/src/walletAdapter';
import toast from 'react-hot-toast';

// The publicKey of SOL (Native Token) - used for documentation and reference
// For offers with SOL as the currency, use this mint address
export const SOL_TOKEN_MINT = 'So11111111111111111111111111111111111111112';

// Interface for offer info returned to frontend
interface OfferInfo {
  id: string;
  publicKey: string;
  owner: string;
  currencyMint: string;
  price: number;
  status: OfferStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creates an OfferClient instance for interacting with the Offer program
 * @param connection Solana connection object
 * @param wallet GenericWallet implementation that follows the wallet interface
 * @returns OfferClient instance
 */
export const createOfferClient = async (
  connection: Connection,
  wallet: GenericWallet
): Promise<OfferClient> => {
  try {
    // Ensure connection is available
    if (!connection) {
      console.error('Connection is not available when creating offer client');
      toast.error('Solana connection is not available. Please check your network settings.');
      throw new Error('Connection is not available');
    }
    
    // Ensure wallet has publicKey
    if (!wallet || !wallet.publicKey) {
      console.error('Wallet not properly configured when creating offer client');
      toast.error('Wallet not properly configured. Please connect your wallet or select a local wallet.');
      throw new Error('Wallet not properly configured');
    }
    
    // Create an Anchor provider using the SDK adapter
    const provider = createAnchorProvider(connection, wallet);
    
    // Load the IDL - use absolute URL to ensure it's found
    const response = await fetch('/idl/offer.json', {
      cache: 'no-store', // Don't cache the response
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch IDL: ${response.statusText}`);
      toast.error(`Failed to fetch IDL: ${response.statusText}`);
      throw new Error(`Failed to fetch IDL: ${response.statusText}`);
    }
    
    // Parse the IDL JSON
    const offerIdl = await response.json();
    
    // Create the offer client
    return new OfferClient(
      new PublicKey(process.env.NEXT_PUBLIC_OFFER_PROGRAM_ID || '9gwnRq5iRoUkYHCJpR2BLLtrZUCuK8ifvwL8EJLsT7RL'),
      provider,
      offerIdl
    );
  } catch (error) {
    console.error('Error creating offer client:', error);
    toast.error('Failed to initialize offer client', { id: 'offer-client-error' });
    throw error;
  }
};

/**
 * Creates a new offer
 * @param connection Solana connection object
 * @param wallet GenericWallet implementation 
 * @param price Price in the currency (in currency's smallest unit)
 * @param minAmount Minimum amount of SOL for the trade
 * @param maxAmount Maximum amount of SOL for the trade
 * @param offerType Type of offer (buy/sell)
 * @returns PublicKey of the created offer or null if failed
 */
export const createOffer = async (
  connection: Connection,
  wallet: GenericWallet,
  price: number,
  minAmount: number,
  maxAmount: number,
  offerType: OfferType
): Promise<string | null> => {
  try {
    // Convert price to BN - store as cents
    const priceBN = new BN(price * 100);
    
    // Convert min/max amounts to BN
    const minAmountBN = new BN(minAmount * 1_000_000_000); // Convert SOL to lamports
    const maxAmountBN = new BN(maxAmount * 1_000_000_000); // Convert SOL to lamports
    
    // Always use SOL token mint for now
    const tokenMint = new PublicKey(SOL_TOKEN_MINT);
    
    // Ensure sufficient SOL for transaction
    const sufficientBalance = await ensureSufficientSol(connection, wallet);
    if (!sufficientBalance) return null;
    
    // Create a wallet adapter for transaction signing
    const walletAdapter = createWalletAdapter(wallet);
    
    // Get an offer client
    const offerClient = await createOfferClient(connection, wallet);
    
    // Create the offer using the wallet adapter
    try {
      // Call the SDK method with the correct parameters
      const offerPDA = await offerClient.createOffer(
        walletAdapter,
        tokenMint,
        priceBN,
        minAmountBN,
        maxAmountBN,
        offerType
      );
      
      toast.success('Offer created successfully');
      return offerPDA.toString();
    } catch (error) {
      if (error instanceof Error && error.message.includes('keypair')) {
        toast.error("This operation requires a wallet with a keypair for signing. The SDK needs to be updated to support browser wallets.");
      } else {
        throw error;
      }
      return null;
    }
  } catch (error) {
    console.error('Error creating offer:', error);
    toast.error('Failed to create offer: ' + (error instanceof Error ? error.message : 'Unknown error'));
    return null;
  }
};

/**
 * Gets a specific offer by its PDA
 * @param connection Solana connection object
 * @param wallet GenericWallet implementation
 * @param offerPDA PublicKey of the offer to get
 * @returns Offer information or null if not found
 */
export const getOffer = async (
  connection: Connection,
  wallet: GenericWallet,
  offerPDA: PublicKey
): Promise<OfferInfo | null> => {
  try {
    const offerClient = await createOfferClient(connection, wallet);
    const offer = await offerClient.getOffer(offerPDA);
    
    return {
      id: offerPDA.toString(),
      publicKey: offerPDA.toString(),
      // Map SDK fields to our frontend interface
      owner: offer.maker.toString(),
      currencyMint: offer.tokenMint.toString(),
      price: offer.pricePerToken.toNumber() / 100, // Convert from cents to dollars/units
      status: offer.status,
      createdAt: new Date(offer.createdAt * 1000),
      updatedAt: new Date(offer.updatedAt * 1000)
    };
  } catch (error) {
    console.error('Error getting offer:', error);
    toast.error('Failed to get offer information');
    return null;
  }
};

/**
 * Gets all offers owned by the specified user
 * @param connection Solana connection object
 * @param wallet GenericWallet implementation
 * @param ownerPubkey PublicKey of the offer owner (defaults to current wallet)
 * @returns Array of offer information
 */
export const getOffersByOwner = async (
  connection: Connection,
  wallet: GenericWallet,
  ownerPubkey?: PublicKey
): Promise<OfferInfo[]> => {
  try {
    const offerClient = await createOfferClient(connection, wallet);
    const owner = ownerPubkey || wallet.publicKey;
    
    try {
      // Get all offers and filter by owner 
      // (Using getAllOffers since SDK doesn't have getOffersByUser method)
      const allOffers = await offerClient.getAllOffers();
      const filteredOffers = allOffers.filter(
        (offerData) => offerData && offerData.account && 
          offerData.account.maker.toString() === owner.toString()
      );
      
      return filteredOffers.map((offerData) => {
        const offer = offerData.account;
        if (!offer) return null;
        
        return {
          id: offerData.publicKey.toString(),
          publicKey: offerData.publicKey.toString(),
          owner: offer.maker.toString(),
          currencyMint: offer.tokenMint.toString(),
          price: offer.pricePerToken.toNumber() / 100, // Convert from cents to dollars/units
          status: offer.status,
          createdAt: new Date(offer.createdAt * 1000),
          updatedAt: new Date(offer.updatedAt * 1000)
        };
      }).filter((item): item is OfferInfo => item !== null);
    } catch (sdkError) {
      // Handle SDK errors same as in getAllOffers
      console.warn('SDK getAllOffers failed in getOffersByOwner, using fallback method:', sdkError);
      
      // Get program ID from the client
      const programId = new PublicKey(process.env.NEXT_PUBLIC_OFFER_PROGRAM_ID || '9gwnRq5iRoUkYHCJpR2BLLtrZUCuK8ifvwL8EJLsT7RL');
      
      // Get all program accounts
      const accounts = await connection.getProgramAccounts(programId, {
        commitment: 'confirmed',
        filters: [
          {
            dataSize: 232, // Assuming offer account size is 232 bytes
          },
        ],
      });
      
      console.log(`Found ${accounts.length} raw offer accounts, but cannot filter by owner without proper decoding`);
      
      // Since we can't properly decode accounts without the SDK, we can't reliably filter by owner
      // Return an empty array rather than potentially incorrect data
      toast.error("Unable to filter offers by owner due to SDK error. Please try again later.");
      return [];
    }
  } catch (error) {
    console.error('Error getting offers by owner:', error);
    toast.error('Failed to get offers');
    return [];
  }
};

/**
 * Gets all active offers filtered by currencyMint
 * @param connection Solana connection object
 * @param wallet GenericWallet implementation
 * @param currencyMint PublicKey of the currency mint to filter offers by
 * @returns Array of offer information
 */
export const getActiveOffersByCurrency = async (
  connection: Connection,
  wallet: GenericWallet,
  currencyMint: PublicKey
): Promise<OfferInfo[]> => {
  try {
    const offerClient = await createOfferClient(connection, wallet);
    
    // Get all offers since SDK doesn't have getOffersByCurrency method
    const allOffers = await offerClient.getAllOffers();
    
    // Filter for active offers with the specified currency mint
    const filteredOffers = allOffers.filter(
      (offerData: OfferWithPublicKey) => {
        if (!offerData.account) return false;
        return offerData.account.status === OfferStatus.Active && 
               offerData.account.tokenMint.toString() === currencyMint.toString();
      }
    );
    
    // Map to frontend format
    return filteredOffers.map((offerData: OfferWithPublicKey) => {
      const offer = offerData.account;
      if (!offer) return null;
      
      return {
        id: offerData.publicKey.toString(),
        publicKey: offerData.publicKey.toString(),
        owner: offer.maker.toString(),
        currencyMint: offer.tokenMint.toString(),
        price: offer.pricePerToken.toNumber() / 100, // Convert from cents to dollars/units
        status: offer.status,
        createdAt: new Date(offer.createdAt * 1000),
        updatedAt: new Date(offer.updatedAt * 1000)
      };
    }).filter(item => item !== null) as OfferInfo[];
  } catch (error) {
    console.error('Error getting offers by currency:', error);
    toast.error('Failed to get offers for this currency');
    return [];
  }
};

/**
 * Updates an offer's price
 * @param connection Solana connection object
 * @param wallet GenericWallet implementation
 * @param offerPDA PublicKey of the offer to update
 * @param newPrice New price for the offer (in currency's smallest unit)
 * @returns Boolean indicating success or failure
 */
export const updateOfferPrice = async (
  connection: Connection,
  wallet: GenericWallet,
  offerPDA: PublicKey,
  newPrice: number
): Promise<boolean> => {
  try {
    // Convert price to BN - store as cents
    const priceBN = new BN(newPrice * 100);
    
    // Ensure sufficient SOL for transaction
    const sufficientBalance = await ensureSufficientSol(connection, wallet);
    if (!sufficientBalance) return false;
    
    // Create a wallet adapter for transaction signing
    const walletAdapter = createWalletAdapter(wallet);
    
    // Get an offer client
    const offerClient = await createOfferClient(connection, wallet);
    
    // Update the offer price using SDK method
    await offerClient.updateOffer(
      offerPDA, 
      walletAdapter, 
      priceBN,
      undefined,  // minAmount - keep unchanged
      undefined   // maxAmount - keep unchanged
    );
    
    toast.success('Offer price updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating offer price:', error);
    toast.error('Failed to update offer price: ' + (error instanceof Error ? error.message : 'Unknown error'));
    return false;
  }
};

/**
 * Cancels an offer
 * @param connection Solana connection object
 * @param wallet GenericWallet implementation
 * @param offerPDA PublicKey of the offer to cancel
 * @returns Boolean indicating success or failure
 */
export const cancelOffer = async (
  connection: Connection,
  wallet: GenericWallet,
  offerPDA: PublicKey
): Promise<boolean> => {
  try {
    // Ensure sufficient SOL for transaction
    const sufficientBalance = await ensureSufficientSol(connection, wallet);
    if (!sufficientBalance) return false;
    
    // Create a wallet adapter for transaction signing
    const walletAdapter = createWalletAdapter(wallet);
    
    // Get an offer client
    const offerClient = await createOfferClient(connection, wallet);
    
    // The SDK method is called closeOffer
    await offerClient.closeOffer(offerPDA, walletAdapter);
    
    toast.success('Offer cancelled successfully');
    return true;
  } catch (error) {
    console.error('Error cancelling offer:', error);
    toast.error('Failed to cancel offer: ' + (error instanceof Error ? error.message : 'Unknown error'));
    return false;
  }
};

/**
 * Gets all available offers 
 * @param connection Solana connection object
 * @param wallet GenericWallet implementation
 * @returns Array of offer information
 */
export const getAllOffers = async (
  connection: Connection,
  wallet: GenericWallet
): Promise<OfferInfo[]> => {
  try {
    const offerClient = await createOfferClient(connection, wallet);
    
    // Get all offers from the client
    try {
      const allOffers = await offerClient.getAllOffers();
      
      // Map the SDK offer format to our frontend format
      return allOffers
        .filter(offerData => offerData && offerData.account !== undefined)
        .map(offerData => {
          const offer = offerData.account;
          // Since we filtered undefined accounts above, this check is not necessary anymore
          // but TypeScript still needs the check
          if (!offer) return null;
          
          // Map SDK properties to our frontend interface
          return {
            id: offerData.publicKey.toString(),
            publicKey: offerData.publicKey.toString(),
            owner: offer.maker.toString(), 
            currencyMint: offer.tokenMint.toString(),
            price: offer.pricePerToken.toNumber() / 100,
            status: offer.status,
            createdAt: new Date(offer.createdAt * 1000),
            updatedAt: new Date(offer.updatedAt * 1000)
          };
        })
        .filter((item): item is OfferInfo => item !== null);
    } catch (sdkError) {
      // The SDK's getAllOffers method is failing with 
      // "TypeError: Cannot read properties of null (reading 'property')"
      // Let's implement a fallback approach using getProgramAccounts directly
      console.warn('SDK getAllOffers failed, using fallback method:', sdkError);
      
      // Get program ID from the client
      const programId = new PublicKey(process.env.NEXT_PUBLIC_OFFER_PROGRAM_ID || '9gwnRq5iRoUkYHCJpR2BLLtrZUCuK8ifvwL8EJLsT7RL');
      
      // Get all program accounts
      const accounts = await connection.getProgramAccounts(programId, {
        commitment: 'confirmed',
        filters: [
          {
            dataSize: 232, // Assuming offer account size is 232 bytes - adjust if needed
          },
        ],
      });
      
      // Log for debugging
      console.log(`Found ${accounts.length} raw offer accounts`);
      
      // We won't be able to decode the accounts properly without the IDL,
      // so let's return a basic representation that's better than nothing
      return accounts.map((account, index) => {
        try {
          // Use the publicKey as the unique identifier
          const publicKey = account.pubkey.toString();
          
          return {
            id: publicKey,
            publicKey: publicKey,
            owner: 'Unknown', // We can't decode without SDK
            currencyMint: 'Unknown', // We can't decode without SDK
            price: 0, // We can't decode without SDK
            status: OfferStatus.Active, // Default to active since we can't decode
            createdAt: new Date(),
            updatedAt: new Date()
          };
        } catch (err) {
          console.error(`Error processing account ${index}:`, err);
          return null;
        }
      }).filter((item): item is OfferInfo => item !== null);
    }
  } catch (error) {
    console.error('Error getting all offers:', error);
    toast.error('Failed to get offers');
    return [];
  }
}; 