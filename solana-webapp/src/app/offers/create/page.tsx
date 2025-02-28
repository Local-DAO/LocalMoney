'use client';

import { FC, useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { BN } from '@project-serum/anchor';
import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import Link from 'next/link';
import { createOffer } from '@/utils/offerService';
import bs58 from 'bs58';
import { useLocalWalletStore } from '@/utils/localWallets';

// Import SDK components when available
// import { OfferClient, OfferType } from '@localmoney/solana-sdk';

enum OfferType {
  Buy = 'buy',
  Sell = 'sell'
}

export default function CreateOffer() {
  const router = useRouter();
  const { publicKey, connected, connection } = useWallet();
  const { getSelectedWallet, isLocalnetMode } = useLocalWalletStore();
  
  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [offerType, setOfferType] = useState<OfferType>(OfferType.Sell);
  const [price, setPrice] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['Bank Transfer']);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');

  // Payment method options
  const paymentMethodOptions = [
    'Bank Transfer',
    'Cash Deposit',
    'PayPal',
    'Venmo',
    'Zelle',
    'Revolut',
    'Cash App',
    'Other'
  ];

  // Currency options
  const currencyOptions = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];

  const handleAddPaymentMethod = () => {
    if (newPaymentMethod && !paymentMethods.includes(newPaymentMethod)) {
      setPaymentMethods([...paymentMethods, newPaymentMethod]);
      setNewPaymentMethod('');
    }
  };

  const handleRemovePaymentMethod = (method: string) => {
    setPaymentMethods(paymentMethods.filter(m => m !== method));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected && !isLocalnetMode) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!minAmount || !maxAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (parseFloat(minAmount) > parseFloat(maxAmount)) {
      toast.error('Minimum amount cannot be greater than maximum amount');
      return;
    }

    if (parseFloat(price) <= 0) {
      toast.error('Price must be greater than zero');
      return;
    }

    if (paymentMethods.length === 0) {
      toast.error('Please add at least one payment method');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Get the wallet to use
      let wallet;
      let effectiveConnection = connection;
      
      if (isLocalnetMode) {
        // Use the selected local wallet
        const selectedWallet = getSelectedWallet();
        if (!selectedWallet) {
          toast.error('Please select a local wallet first');
          return;
        }
        
        // For localnet mode, we need to create our own connection if the one from useWallet isn't available
        if (!effectiveConnection) {
          const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://localhost:8899';
          effectiveConnection = new Connection(rpcUrl, 'confirmed');
        }
        
        // Create a wallet adapter for Anchor that includes both publicKey and the signing methods
        wallet = {
          publicKey: selectedWallet.keypair.publicKey,
          keypair: selectedWallet.keypair,
          signTransaction: async (tx: any) => {
            tx.sign(selectedWallet.keypair);
            return tx;
          },
          signAllTransactions: async (txs: any[]) => {
            return txs.map(tx => {
              tx.sign(selectedWallet.keypair);
              return tx;
            });
          }
        };
      } else {
        // For development, we'll use the maker private key from the environment
        // In production, we would use the connected wallet
        if (process.env.NEXT_PUBLIC_MAKER_PRIVATE_KEY) {
          const privateKey = bs58.decode(process.env.NEXT_PUBLIC_MAKER_PRIVATE_KEY);
          const keypair = Keypair.fromSecretKey(privateKey);
          wallet = {
            publicKey: keypair.publicKey,
            keypair,
            signTransaction: async (tx: any) => {
              tx.sign(keypair);
              return tx;
            },
            signAllTransactions: async (txs: any[]) => {
              return txs.map(tx => {
                tx.sign(keypair);
                return tx;
              });
            }
          };
        } else if (publicKey) {
          wallet = {
            publicKey
          };
        } else {
          toast.error('Wallet not available');
          return;
        }
      }

      if (!effectiveConnection) {
        toast.error('Solana connection not available');
        return;
      }
      
      // Use the offer service to create the offer
      const offerPDA = await createOffer(
        effectiveConnection,
        wallet,
        parseFloat(price),
        parseFloat(minAmount),
        parseFloat(maxAmount),
        offerType,
        currency
      );
      
      if (offerPDA) {
        toast.success('Offer created successfully!');
        // Redirect to offers page after successful creation
        router.push('/offers');
      } else {
        toast.error('Failed to create offer');
      }
    } catch (error) {
      console.error('Error creating offer:', error);
      toast.error('Failed to create offer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Create Offer</h1>
        <Link 
          href="/offers"
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Back to Offers
        </Link>
      </div>

      {(!connected && !isLocalnetMode) ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Please connect your wallet to create an offer.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8 divide-y divide-gray-200">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">Offer Details</h3>
              <p className="mt-1 text-sm text-gray-500">
                Provide the details for your offer.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              {/* Offer Type */}
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Offer Type</label>
                <div className="mt-1">
                  <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        className="form-radio h-4 w-4 text-indigo-600"
                        value={OfferType.Sell}
                        checked={offerType === OfferType.Sell}
                        onChange={() => setOfferType(OfferType.Sell)}
                      />
                      <span className="ml-2">Sell SOL</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        className="form-radio h-4 w-4 text-indigo-600"
                        value={OfferType.Buy}
                        checked={offerType === OfferType.Buy}
                        onChange={() => setOfferType(OfferType.Buy)}
                      />
                      <span className="ml-2">Buy SOL</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Price */}
              <div className="sm:col-span-3">
                <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                  Price per SOL
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    name="price"
                    id="price"
                    step="0.01"
                    min="0"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center">
                    <select
                      id="currency"
                      name="currency"
                      className="focus:ring-indigo-500 focus:border-indigo-500 h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-gray-500 sm:text-sm rounded-md"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      {currencyOptions.map((curr) => (
                        <option key={curr} value={curr}>{curr}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Min Amount */}
              <div className="sm:col-span-3">
                <label htmlFor="minAmount" className="block text-sm font-medium text-gray-700">
                  Minimum Amount (SOL)
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="minAmount"
                    id="minAmount"
                    step="0.000001"
                    min="0"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Minimum amount allowed per individual trade. Must be less than maximum amount.
                </p>
              </div>

              {/* Max Amount */}
              <div className="sm:col-span-3">
                <label htmlFor="maxAmount" className="block text-sm font-medium text-gray-700">
                  Maximum Amount (SOL)
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="maxAmount"
                    id="maxAmount"
                    step="0.000001"
                    min="0"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Maximum amount allowed per individual trade.
                </p>
              </div>

              {/* Payment Methods */}
              <div className="sm:col-span-6">
                <label className="block text-sm font-medium text-gray-700">
                  Payment Methods
                </label>
                <div className="mt-1">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {paymentMethods.map((method) => (
                      <span 
                        key={method} 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-indigo-100 text-indigo-800"
                      >
                        {method}
                        <button
                          type="button"
                          className="ml-1.5 inline-flex text-indigo-500 hover:text-indigo-600"
                          onClick={() => handleRemovePaymentMethod(method)}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex">
                    <select
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-l-md"
                      value={newPaymentMethod}
                      onChange={(e) => setNewPaymentMethod(e.target.value)}
                    >
                      <option value="">Select a payment method</option>
                      {paymentMethodOptions
                        .filter(method => !paymentMethods.includes(method))
                        .map(method => (
                          <option key={method} value={method}>{method}</option>
                        ))
                      }
                    </select>
                    <button
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={handleAddPaymentMethod}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5">
            <div className="flex justify-end">
              <Link
                href="/offers"
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : 'Create Offer'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
} 