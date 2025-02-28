'use client';

import { FC, useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter, useParams } from 'next/navigation';
import { PublicKey, Connection } from '@solana/web3.js';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { getOffer, updateOffer } from '@/utils/offerService';
import { useLocalWalletStore } from '@/utils/localWallets';

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
}

export default function ViewOffer() {
  const params = useParams();
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const { getSelectedWallet, isLocalnetMode } = useLocalWalletStore();
  
  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedPrice, setEditedPrice] = useState<string>('');
  const [editedMinAmount, setEditedMinAmount] = useState<string>('');
  const [editedMaxAmount, setEditedMaxAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Set up connection when component mounts
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://localhost:8899';
    setConnection(new Connection(rpcUrl, 'confirmed'));
  }, []);

  useEffect(() => {
    if (connection) {
      loadOfferDetails();
    }
  }, [params.id, connected, connection]);

  useEffect(() => {
    // Check if logged-in user is the offer creator
    if (offer && publicKey) {
      // Log values to debug ownership issue
      console.log('Checking offer ownership:', {
        creator: offer.creator,
        currentUser: publicKey.toString(),
        isEqual: offer.creator === publicKey.toString()
      });
      
      // For localnet mode, we should handle this scenario separately
      if (isLocalnetMode) {
        const selectedWallet = getSelectedWallet();
        if (selectedWallet) {
          const isCreator = offer.creator === selectedWallet.keypair.publicKey.toString();
          console.log('Localnet check:', {
            creator: offer.creator,
            selectedWallet: selectedWallet.keypair.publicKey.toString(),
            isEqual: isCreator
          });
          setIsOwner(isCreator);
          
          if (isCreator) {
            setEditedPrice(offer.price.toString());
            setEditedMinAmount(offer.minAmount.toString());
            setEditedMaxAmount(offer.maxAmount.toString());
          }
          return;
        }
      }
      
      // Normal comparison for non-localnet mode
      const isCreator = offer.creator === publicKey.toString();
      setIsOwner(isCreator);
      
      if (isCreator) {
        setEditedPrice(offer.price.toString());
        setEditedMinAmount(offer.minAmount.toString());
        setEditedMaxAmount(offer.maxAmount.toString());
      }
    } else {
      setIsOwner(false);
    }
  }, [offer, publicKey, isLocalnetMode, getSelectedWallet]);

  const loadOfferDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!params.id) {
        setError('Invalid offer ID');
        return;
      }

      if (!connection) {
        setError('Solana connection not available');
        return;
      }

      // Get the wallet to use
      let wallet;
      
      if (isLocalnetMode) {
        // Use the selected local wallet
        const selectedWallet = getSelectedWallet();
        if (selectedWallet) {
          wallet = {
            publicKey: selectedWallet.keypair.publicKey,
            keypair: selectedWallet.keypair
          };
        }
      } else if (publicKey) {
        wallet = {
          publicKey
        };
      } else {
        // For viewing, we can proceed without a connected wallet
        // Creating a temporary wallet with just publicKey as null
        wallet = {
          publicKey: null
        };
      }
      
      // Try parsing the ID as a PublicKey
      let offerPublicKey: PublicKey;
      try {
        offerPublicKey = new PublicKey(params.id);
      } catch (error) {
        setError('Invalid offer ID format');
        return;
      }
      
      // Fetch the offer details
      const offerDetails = await getOffer(connection, wallet, offerPublicKey);
      
      if (offerDetails) {
        // Log the full offer details to help debug
        console.log('Received offer details:', offerDetails);
        setOffer(offerDetails);
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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleTrade = () => {
    if (!connected && !isLocalnetMode) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!offer) return;
    
    // Check if trades/create route exists, otherwise show a toast message
    toast.success(`Trade with ${offer.creator.substring(0, 8)}... feature coming soon!`);
    // Uncomment when trade feature is implemented
    // router.push(`/trades/create?offerId=${offer.id}`);
  };

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    // Reset form values
    if (offer) {
      setEditedPrice(offer.price.toString());
      setEditedMinAmount(offer.minAmount.toString());
      setEditedMaxAmount(offer.maxAmount.toString());
    }
    setIsEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!connection || !offer) return;

    // Basic validation
    if (!editedPrice || !editedMinAmount || !editedMaxAmount) {
      toast.error('All fields are required');
      return;
    }

    const price = parseFloat(editedPrice);
    const minAmount = parseFloat(editedMinAmount);
    const maxAmount = parseFloat(editedMaxAmount);

    if (isNaN(price) || isNaN(minAmount) || isNaN(maxAmount)) {
      toast.error('All values must be valid numbers');
      return;
    }

    if (minAmount > maxAmount) {
      toast.error('Minimum amount cannot be greater than maximum amount');
      return;
    }

    try {
      setIsSubmitting(true);
      
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
      
      // Try parsing the ID as a PublicKey
      let offerPublicKey: PublicKey;
      try {
        offerPublicKey = new PublicKey(params.id as string);
      } catch (error) {
        toast.error('Invalid offer ID format');
        return;
      }
      
      // Update the offer
      const success = await updateOffer(
        connection,
        wallet, 
        offerPublicKey,
        price,
        minAmount,
        maxAmount
      );
      
      if (success) {
        toast.success('Offer updated successfully');
        setIsEditMode(false);
        // Reload offer details to see the updated values
        loadOfferDetails();
      } else {
        toast.error('Failed to update offer');
      }
    } catch (error: any) {
      console.error('Error updating offer:', error);
      toast.error(error.message || 'Failed to update offer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Offer Details</h1>
        <Link
          href="/offers"
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Back to Offers
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <svg className="animate-spin h-10 w-10 text-indigo-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-500">Loading offer details...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      ) : offer ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {typeof offer.isBuy === 'boolean' ? (offer.isBuy ? 'Buy' : 'Sell') : 'Unknown'} Offer
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Created {formatDate(offer.createdAt)}
              </p>
            </div>
            <div className="flex space-x-2 items-center">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(offer.status)}`}>
                {getStatusText(offer.status)}
              </span>
              
              {isOwner && !isEditMode && offer.status === 'active' && (
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="ml-3 inline-flex items-center px-3 py-1.5 border border-indigo-300 text-xs font-medium rounded text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                >
                  Edit Offer
                </button>
              )}
            </div>
          </div>
          
          {isEditMode ? (
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Edit Offer</h3>
              <div className="space-y-6">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price (USD per SOL)</label>
                  <div className="mt-1">
                    <input
                      type="number"
                      id="price"
                      value={editedPrice}
                      onChange={(e) => setEditedPrice(e.target.value)}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="minAmount" className="block text-sm font-medium text-gray-700">Minimum Amount (SOL)</label>
                  <div className="mt-1">
                    <input
                      type="number"
                      id="minAmount"
                      value={editedMinAmount}
                      onChange={(e) => setEditedMinAmount(e.target.value)}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      min="0"
                      step="0.000001"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="maxAmount" className="block text-sm font-medium text-gray-700">Maximum Amount (SOL)</label>
                  <div className="mt-1">
                    <input
                      type="number"
                      id="maxAmount"
                      value={editedMaxAmount}
                      onChange={(e) => setEditedMaxAmount(e.target.value)}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      min="0"
                      step="0.000001"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSubmitting}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Offer ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 break-all">{offer.id}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Created by</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 break-all">{offer.creator}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Price</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {offer.price} {offer.currency} per SOL
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Minimum amount</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{offer.minAmount} SOL</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Maximum amount</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{offer.maxAmount} SOL</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Payment methods</dt>
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
          )}
          
          <div className="bg-gray-50 px-4 py-5 sm:px-6 flex justify-end">
            {!isEditMode && (
              <button
                type="button"
                onClick={handleTrade}
                disabled={offer.status !== 'active'}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                  offer.status === 'active'
                    ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {typeof offer.isBuy === 'boolean' 
                  ? (offer.isBuy ? 'Sell to this buyer' : 'Buy from this seller')
                  : 'Trade with this offer'}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
} 