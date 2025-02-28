'use client';

import { FC, useState, useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { PublicKey, Connection } from '@solana/web3.js';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { getOffer } from '@/utils/offerService';
import { createTrade, depositTradeEscrow } from '@/utils/tradeService';
import { useLocalWalletStore } from '@/utils/localWallets';
import { ChangeEvent } from 'react';

interface OfferDetails {
  id: string;
  creator: string;
  price: number;
  minAmount: number;
  maxAmount: number;
  currency: string;
  paymentMethods: string[];
  isBuy: boolean;
  createdAt: Date;
  status: string;
  tokenMint: string;
}

const CreateTradePage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  // Get offerId from query parameter instead of route parameter
  const offerId = searchParams.get('offerId');
  console.log('Extracted offerId from query params:', offerId);  // Debug log
  const { publicKey, connected } = useWallet();
  const { getSelectedWallet, isLocalnetMode } = useLocalWalletStore();
  const router = useRouter();
  
  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [createdTradeId, setCreatedTradeId] = useState<string | null>(null);
  const [createdTokenMint, setCreatedTokenMint] = useState<string | null>(null);

  useEffect(() => {
    // Set up connection when component mounts
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://localhost:8899';
    console.log('Setting up connection with RPC URL:', rpcUrl);
    setConnection(new Connection(rpcUrl, 'confirmed'));

    // Debug URL information
    if (typeof window !== 'undefined') {
      console.log('Current URL path:', window.location.pathname);
      console.log('Current URL query:', window.location.search);
      console.log('Expected format: /trades/create?offerId=XYZ');
      console.log('SearchParams offerId:', searchParams.get('offerId'));
    }
  }, [searchParams]);

  useEffect(() => {
    if (connection) {
      console.log('Connection available, loading offer details...');
      loadOfferDetails();
    } else {
      console.log('No connection available yet');
    }
  }, [searchParams, connected, connection]);

  useEffect(() => {
    if (offer && amount) {
      try {
        const amountValue = parseFloat(amount);
        setTotalPrice(amountValue * offer.price);
      } catch (e) {
        setTotalPrice(0);
      }
    } else {
      setTotalPrice(0);
    }
  }, [amount, offer]);

  const loadOfferDetails = async () => {
    try {
      console.log('loadOfferDetails called, offerId:', offerId);
      setIsLoading(true);
      setError(null);
      
      if (!connection) {
        console.log('No connection available in loadOfferDetails');
        setError('Solana connection not available');
        return;
      }

      // Check if offerId is valid
      if (!offerId) {
        console.error('No offer ID provided');
        setError('No offer ID provided');
        return;
      }

      // Get the wallet to use
      let wallet;
      
      if (isLocalnetMode) {
        // Use the selected local wallet
        const selectedWallet = getSelectedWallet();
        console.log('Local mode, selectedWallet:', selectedWallet ? 'available' : 'not available');
        if (selectedWallet) {
          wallet = {
            publicKey: selectedWallet.keypair.publicKey,
            keypair: selectedWallet.keypair
          };
        }
      } else if (publicKey) {
        console.log('Using connected wallet with publicKey:', publicKey.toString());
        wallet = {
          publicKey
        };
      } else {
        console.log('No wallet available');
        setError('Please connect your wallet');
        return;
      }
      
      // Try parsing the ID as a PublicKey
      let offerPublicKey: PublicKey;
      try {
        if (!offerId || typeof offerId !== 'string' || offerId.trim() === '') {
          throw new Error('Invalid offer ID: empty or not a string');
        }
        
        console.log('Attempting to parse offerId as PublicKey:', offerId);
        offerPublicKey = new PublicKey(offerId);
        console.log('Parsed offer ID as PublicKey:', offerPublicKey.toString());
      } catch (error) {
        console.error('Failed to parse offer ID as PublicKey:', error);
        setError('Invalid offer ID format');
        return;
      }
      
      // Fetch the offer details
      const offerDetails = await getOffer(connection, wallet, offerPublicKey);
      
      if (offerDetails) {
        setOffer(offerDetails);
        // Set default amount to min amount
        setAmount(offerDetails.minAmount.toString());
      } else {
        setError('Offer not found');
      }
    } catch (error: any) {
      console.error('Error loading offer:', error);
      setError(error.message || 'Failed to load offer details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    
    // Validate the amount
    if (!value) {
      setAmountError('Amount is required');
      return;
    }
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setAmountError('Amount must be a number');
      return;
    }
    
    if (offer) {
      if (numValue < offer.minAmount) {
        setAmountError(`Amount must be at least ${offer.minAmount} SOL`);
        return;
      }
      
      if (numValue > offer.maxAmount) {
        setAmountError(`Amount cannot exceed ${offer.maxAmount} SOL`);
        return;
      }
    }
    
    setAmountError(null);
  };

  // Calculate total value of the trade
  const totalValue = useMemo(() => {
    if (!offer || !amount) return '0';
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return '0';
    
    return (numAmount * offer.price).toFixed(2);
  }, [offer, amount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!offer || !connection) {
      return;
    }

    if (!connected && !isLocalnetMode) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Basic validation
    let amountValue: number;
    try {
      amountValue = parseFloat(amount);
      if (isNaN(amountValue)) {
        throw new Error('Amount must be a valid number');
      }
    } catch (error) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amountValue < offer.minAmount || amountValue > offer.maxAmount) {
      toast.error(`Amount must be between ${offer.minAmount} and ${offer.maxAmount} SOL`);
      return;
    }

    // Get the wallet to use
    let wallet;
    
    if (isLocalnetMode) {
      // Use the selected local wallet
      const selectedWallet = getSelectedWallet();
      if (!selectedWallet) {
        toast.error('Please select a local wallet');
        return;
      }
      wallet = {
        publicKey: selectedWallet.keypair.publicKey,
        keypair: selectedWallet.keypair
      };
    } else if (publicKey) {
      wallet = {
        publicKey
      };
    } else {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Create the trade (without depositing to escrow yet)
      const tradeId = await createTrade(
        connection,
        wallet,
        new PublicKey(offer.id),
        new PublicKey(offer.creator),
        amountValue
      );
      
      if (tradeId) {
        toast.success('Trade created successfully! Now deposit to escrow to activate it.');
        setCreatedTradeId(tradeId);
        setCreatedTokenMint(offer.tokenMint);
      }
    } catch (error: any) {
      console.error('Error creating trade:', error);
      toast.error(error.message || 'Failed to create trade');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDepositEscrow = async () => {
    if (!createdTradeId || !createdTokenMint) {
      toast.error('No trade created yet');
      return;
    }

    // Get the wallet to use
    let wallet;
    
    if (isLocalnetMode) {
      // Use the selected local wallet
      const selectedWallet = getSelectedWallet();
      if (!selectedWallet) {
        toast.error('Please select a local wallet');
        return;
      }
      wallet = {
        publicKey: selectedWallet.keypair.publicKey,
        keypair: selectedWallet.keypair
      };
    } else if (publicKey) {
      wallet = {
        publicKey
      };
    } else {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Make sure we have a connection
      if (!connection) {
        toast.error('No connection available');
        return;
      }
      
      // Deposit to escrow
      const success = await depositTradeEscrow(
        connection,
        wallet,
        new PublicKey(createdTradeId),
        new PublicKey(createdTokenMint),
        parseFloat(amount) // Use the amount from the form
      );
      
      if (success) {
        toast.success('Successfully deposited to escrow! Trade is now active.');
        // Redirect to the trade details page
        router.push(`/trades/${createdTradeId}`);
      }
    } catch (error: any) {
      console.error('Error depositing to escrow:', error);
      toast.error(error.message || 'Failed to deposit to escrow');
    } finally {
      setIsSubmitting(false);
    }
  };

  // When rendering starts
  console.log('Rendering CreateTradePage component, state:', {
    isLoading,
    error: error ? 'Error exists' : 'No error',
    offer: offer ? 'Offer loaded' : 'No offer',
    connected,
    isLocalnetMode,
    createdTradeId: createdTradeId ? 'Trade created' : 'No trade created'
  });
  
  if (!connected && !isLocalnetMode) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Create Trade</h1>
          <Link
            href="/offers"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Offers
          </Link>
        </div>
        
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Please connect your wallet to create a trade.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create Trade</h1>
      
      {/* Debug information */}
      {isLoading && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
          <p className="text-sm text-blue-700">
            Loading offer details...
          </p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <p className="text-sm text-red-700">
            Error: {error}
          </p>
        </div>
      )}
      
      {!isLoading && !error && !offer && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <p className="text-sm text-yellow-700">
            No offer found. Please check the offer ID.
          </p>
        </div>
      )}
      
      {/* Debug info about offer data */}
      {!isLoading && offer && (
        <div className="bg-gray-50 border-l-4 border-gray-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-gray-700">
                Offer data loaded: ID={offer.id}, Price={offer.price}, Min={offer.minAmount}, Max={offer.maxAmount}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {!createdTradeId ? (
        // Step 1: Trade Creation Form
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Only render form content if offer is available */}
          {offer && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {offer.isBuy ? 'Sell to Buyer' : 'Buy from Seller'}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Review the offer details and enter the amount you want to trade.
                </p>
              </div>
              
              <div className="border-t border-gray-200">
                <dl>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Offer Type</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {offer.isBuy ? 'Buy Offer (You will sell SOL)' : 'Sell Offer (You will buy SOL)'}
                    </dd>
                  </div>
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Creator</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 break-all">
                      {offer.creator}
                    </dd>
                  </div>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Price per SOL</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {offer.price} {offer.currency}
                    </dd>
                  </div>
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Amount Range</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {offer.minAmount} - {offer.maxAmount} SOL
                    </dd>
                  </div>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Payment Methods</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      <ul className="border border-gray-200 rounded-md divide-y divide-gray-200">
                        {offer.paymentMethods.map((method, index) => (
                          <li key={index} className="pl-3 pr-4 py-3 flex items-center justify-between text-sm">
                            <div className="w-0 flex-1 flex items-center">
                              <svg className="flex-shrink-0 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                              </svg>
                              <span className="ml-2 flex-1 w-0 truncate">{method}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                </dl>
              </div>
              
              <div className="px-4 py-5 sm:p-6 border-t border-gray-200">
                <div className="space-y-6">
                  <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                      Trade Amount (SOL)
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="amount"
                        id="amount"
                        value={amount}
                        onChange={handleAmountChange}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder={`Enter amount between ${offer.minAmount} and ${offer.maxAmount} SOL`}
                      />
                    </div>
                    {amountError && (
                      <p className="mt-2 text-sm text-red-600">{amountError}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Total Value
                    </label>
                    <div className="mt-1">
                      <p className="text-lg font-bold">
                        {totalValue} {offer.currency}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-between">
            <Link
              href="/offers"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Back to Offers
            </Link>
            
            <button
              type="submit"
              disabled={isSubmitting || !!amountError || !offer}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Trade'}
            </button>
          </div>
        </form>
      ) : (
        // Step 2: Deposit Escrow Form
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Deposit to Escrow
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Your trade has been created! Now deposit funds to activate it.
            </p>
          </div>
          
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    Trade created successfully with ID: <span className="font-mono break-all">{createdTradeId}</span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-500">
                  To activate your trade, you need to deposit <strong>{amount} SOL</strong> to the escrow account.
                </p>
              </div>
              
              <div className="flex justify-between">
                <Link
                  href="/trades"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Skip (View My Trades)
                </Link>
                
                <button
                  type="button"
                  onClick={handleDepositEscrow}
                  disabled={isSubmitting}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Depositing...' : 'Deposit to Escrow'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateTradePage;