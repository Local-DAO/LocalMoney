import { AnchorProvider, BN, Idl, Program } from '@project-serum/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { OfferClient, OfferType, OfferStatus } from '@localmoney/solana-sdk';
import toast from 'react-hot-toast';

// Program IDs from environment variables
const OFFER_PROGRAM_ID = process.env.NEXT_PUBLIC_OFFER_PROGRAM_ID || 'FSnCsffRYjRwbpzFCkbwSFtgfSNbxrpYUsq84opqG4wW';
const TRADE_PROGRAM_ID = process.env.NEXT_PUBLIC_TRADE_PROGRAM_ID || '6VXLHER2xPndomqaXWPPUH3733HVmcRMUuU5w9eNVqbZ';
const SOL_TOKEN_MINT = 'So11111111111111111111111111111111111111112';

// Factory function to create an offer client
export const createOfferClient = async (
  connection: Connection,
  wallet: any
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
    
    // Ensure the provider has a proper connection
    if (!provider.connection) {
      console.error('Provider connection is not available');
      toast.error('Provider connection is not available');
      throw new Error('Provider connection is not available');
    }
    
    // Load the IDL
    // In a production app, we would import this from the SDK
    // For now, we'll fetch it dynamically
    const response = await fetch('/idl/offer.json');
    if (!response.ok) {
      console.error(`Failed to fetch IDL: ${response.statusText}`);
      toast.error(`Failed to fetch IDL: ${response.statusText}`);
      throw new Error(`Failed to fetch IDL: ${response.statusText}`);
    }
    const offerIdl = await response.json();
    
    // Create the offer client
    const offerClient = new OfferClient(
      new PublicKey(OFFER_PROGRAM_ID),
      provider,
      offerIdl
    );
    
    return offerClient;
  } catch (error) {
    console.error('Error creating offer client:', error);
    toast.error('Failed to initialize offer client', { id: 'offer-client-error' });
    throw error;
  }
};

// Helper function to create an offer
export const createOffer = async (
  connection: Connection,
  wallet: any,
  price: number,
  minAmount: number,
  maxAmount: number,
  offerType: 'buy' | 'sell',
  currency: string
): Promise<string | null> => {
  try {
    // Create new offer client
    const offerClient = await createOfferClient(connection, wallet);
    
    // Convert string parameters to BN (big number) as required by the SDK
    const priceBN = new BN(price);
    const minAmountBN = new BN(minAmount);
    const maxAmountBN = new BN(maxAmount);
    
    // Convert the offer type string to the enum expected by the SDK
    const offerType_enum = offerType === 'buy' ? OfferType.Buy : OfferType.Sell;
    
    // Get the token mint public key
    const tokenMint = new PublicKey(SOL_TOKEN_MINT);
    
    // Determine the signing keypair - we need an actual Keypair for the maker parameter
    let signingKeypair: Keypair | null = null;
    
    // If wallet has a keypair property, use it directly
    if (wallet.keypair && wallet.keypair instanceof Keypair) {
      signingKeypair = wallet.keypair;
    }
    // Otherwise, try to derive a keypair from wallet if possible
    else if (wallet.payer && wallet.payer instanceof Keypair) {
      signingKeypair = wallet.payer;
    }
    // If we have private key directly
    else if (wallet.secretKey) {
      signingKeypair = Keypair.fromSecretKey(wallet.secretKey);
    }
    
    // Log parameter values to help debug
    console.log("Creating offer with parameters:", {
      signer: wallet.publicKey.toString(),
      tokenMint: tokenMint.toString(),
      price: priceBN.toString(),
      minAmount: minAmountBN.toString(), 
      maxAmount: maxAmountBN.toString(),
      offerType: offerType_enum
    });
    
    // The SDK requires a Keypair for the maker parameter, not a PublicKey or null
    if (!signingKeypair) {
      console.error('Signing keypair not available, cannot create offer');
      toast.error('Wallet keypair not available for signing. Please use a local wallet or connect a wallet that supports signing.');
      return null;
    }
    
    // Call create offer on the client with the updated signature
    const offerPDA = await offerClient.createOffer(
      signingKeypair,
      tokenMint,
      priceBN,
      minAmountBN,
      maxAmountBN,
      offerType_enum
    );
    
    return offerPDA.toString();
  } catch (error: any) {
    console.error('Error creating offer:', error);
    
    // Check for the specific "account already in use" error
    if (error.logs && error.logs.some((log: string) => log.includes('already in use'))) {
      toast.error('An offer with identical parameters already exists. Please modify at least one parameter and try again.');
    } else if (error.message && error.message.includes('0x1')) {
      toast.error('Insufficient funds to create offer');
    } else {
      toast.error('Failed to create offer: ' + (error.message || 'Unknown error'));
    }
    
    return null;
  }
};

// Helper function to get all offers
export const getAllOffers = async (
  connection: Connection,
  wallet: any
): Promise<any[]> => {
  try {
    // Ensure connection is available
    if (!connection) {
      console.error('Connection is not available when fetching offers');
      toast.error('Solana connection is not available. Please check your network settings.');
      return [];
    }

    // Ensure wallet is configured properly
    if (!wallet || !wallet.publicKey) {
      console.error('Wallet not properly configured when fetching offers');
      toast.error('Wallet not properly configured. Please connect your wallet or select a local wallet.');
      return [];
    }

    // Create an offer client to interact with the blockchain
    const offerClient = await createOfferClient(connection, wallet);
    
    // Get the program ID
    const programId = new PublicKey(OFFER_PROGRAM_ID);
    
    // Fetch all offer accounts from the program - removing dataSize filter to get all accounts
    console.log('Fetching offer accounts from program:', programId.toString());
    
    const accounts = await connection.getProgramAccounts(programId);
    
    console.log(`Found ${accounts.length} program accounts`);
    
    // Process the accounts and convert them to offer objects
    const offers = await Promise.all(
      accounts.map(async ({ pubkey, account }) => {
        try {
          console.log(`Processing account ${pubkey.toString()} with data size ${account.data.length}`);
          
          // Use the SDK to deserialize the account data
          const offerData = await offerClient.getOffer(pubkey);
          
          // Get the correct type
          let isBuy = false;
          
          // We need to check the type properly as it might be an enum
          if (typeof offerData.offerType === 'number') {
            isBuy = offerData.offerType === 0; // OfferType.Buy
          } else if (offerData.offerType === OfferType.Buy) {
            isBuy = true;
          }
          
          return {
            id: pubkey.toString(),
            creator: offerData.maker.toString(),
            price: offerData.pricePerToken.toNumber(), // Don't divide by 100 as the price is already in correct units
            minAmount: offerData.minAmount.toNumber() / 1e6, // Adjust the conversion factor for proper SOL display
            maxAmount: offerData.maxAmount.toNumber() / 1e6, // Adjust the conversion factor for proper SOL display
            currency: 'USD', // This would come from the offer in a real implementation
            paymentMethods: ['Bank Transfer'], // This would come from the offer in a real implementation
            isBuy: isBuy,
            createdAt: new Date(offerData.createdAt * 1000), // Convert from seconds to milliseconds
            status: offerData.status
          };
        } catch (error) {
          console.error(`Error processing account ${pubkey.toString()}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null entries (accounts that couldn't be processed)
    return offers.filter(offer => offer !== null);
  } catch (error) {
    console.error('Error fetching offers:', error);
    toast.error('Failed to fetch offers from the blockchain');
    return [];
  }
};

// Helper function to get an offer by PDA
export const getOffer = async (
  connection: Connection,
  wallet: any,
  offerPDA: PublicKey
): Promise<any | null> => {
  try {
    const offerClient = await createOfferClient(connection, wallet);
    const offer = await offerClient.getOffer(offerPDA);
    
    // Log raw values for debugging
    console.log('Raw offer values:', {
      pricePerToken: offer.pricePerToken.toString(),
      minAmount: offer.minAmount.toString(),
      maxAmount: offer.maxAmount.toString(),
      offerType: offer.offerType,
      rawOfferType: JSON.stringify(offer.offerType)
    });
    
    // Get the correct type
    let isBuy = false;
    
    // We need to check the type properly as it might be an enum
    // OfferType.Buy should be 0 and OfferType.Sell should be 1 based on standard enum patterns
    if (typeof offer.offerType === 'number') {
      isBuy = offer.offerType === 0; // OfferType.Buy
    } else if (offer.offerType === OfferType.Buy) {
      isBuy = true;
    } else {
      console.log('Unknown offer type format:', offer.offerType);
    }
    
    return {
      id: offerPDA.toString(),
      creator: offer.maker.toString(),
      price: offer.pricePerToken.toNumber(), // Don't divide by 100 as the price is already in correct units
      minAmount: offer.minAmount.toNumber() / 1e6, // Adjust the conversion factor for proper SOL display
      maxAmount: offer.maxAmount.toNumber() / 1e6, // Adjust the conversion factor for proper SOL display
      currency: 'USD', // This would come from the offer in a real implementation
      paymentMethods: ['Bank Transfer'], // This would come from the offer in a real implementation
      isBuy: isBuy,
      createdAt: new Date(offer.createdAt * 1000), // Convert from seconds to milliseconds
      status: offer.status
    };
  } catch (error) {
    console.error('Error fetching offer:', error);
    toast.error('Failed to fetch offer');
    return null;
  }
};

// Helper function to update an offer
export const updateOffer = async (
  connection: Connection,
  wallet: any,
  offerPDA: PublicKey,
  price?: number,
  minAmount?: number,
  maxAmount?: number
): Promise<boolean> => {
  try {
    const offerClient = await createOfferClient(connection, wallet);
    
    // Log values for debugging
    console.log('Updating offer with values:', { price, minAmount, maxAmount });
    
    // Convert values to BN with the correct conversion factors
    // The price is in whole units (dollars, not cents)
    const priceBN = price !== undefined ? new BN(price) : undefined;
    
    // The amounts are in SOL, need to convert to lamports
    const minAmountBN = minAmount !== undefined ? new BN(Math.floor(minAmount * 1e6)) : undefined;
    const maxAmountBN = maxAmount !== undefined ? new BN(Math.floor(maxAmount * 1e6)) : undefined;
    
    // Log converted values for debugging
    console.log('Converted values:', { 
      priceBN: priceBN?.toString(), 
      minAmountBN: minAmountBN?.toString(), 
      maxAmountBN: maxAmountBN?.toString() 
    });
    
    if (!wallet.keypair) {
      toast.error('Cannot update offer: wallet keypair not available');
      return false;
    }
    
    await offerClient.updateOffer(
      offerPDA,
      wallet.keypair,
      priceBN,
      minAmountBN,
      maxAmountBN
    );
    
    return true;
  } catch (error: any) {
    console.error('Error updating offer:', error);
    
    // More detailed error handling
    if (error.logs && error.logs.some((log: string) => log.includes('0x1'))) {
      toast.error('Insufficient funds to update offer');
    } else if (error.message && error.message.includes('not owned by signer')) {
      toast.error('You are not authorized to update this offer');
    } else if (error.message) {
      toast.error(`Failed to update offer: ${error.message}`);
    } else {
      toast.error('Failed to update offer: Unknown error');
    }
    
    return false;
  }
};

// Helper function to pause an offer
export const pauseOffer = async (
  connection: Connection,
  wallet: any,
  offerPDA: PublicKey
): Promise<boolean> => {
  try {
    const offerClient = await createOfferClient(connection, wallet);
    await offerClient.pauseOffer(offerPDA, wallet.keypair);
    return true;
  } catch (error) {
    console.error('Error pausing offer:', error);
    toast.error('Failed to pause offer');
    return false;
  }
};

// Helper function to resume an offer
export const resumeOffer = async (
  connection: Connection,
  wallet: any,
  offerPDA: PublicKey
): Promise<boolean> => {
  try {
    const offerClient = await createOfferClient(connection, wallet);
    await offerClient.resumeOffer(offerPDA, wallet.keypair);
    return true;
  } catch (error) {
    console.error('Error resuming offer:', error);
    toast.error('Failed to resume offer');
    return false;
  }
};

// Helper function to close an offer
export const closeOffer = async (
  connection: Connection,
  wallet: any,
  offerPDA: PublicKey
): Promise<boolean> => {
  try {
    const offerClient = await createOfferClient(connection, wallet);
    await offerClient.closeOffer(offerPDA, wallet.keypair);
    return true;
  } catch (error) {
    console.error('Error closing offer:', error);
    toast.error('Failed to close offer');
    return false;
  }
}; 