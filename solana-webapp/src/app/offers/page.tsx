'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { getAllOffers, SOL_TOKEN_MINT } from '@/utils/offerService';
import { useLocalWalletStore } from '@/utils/localWallets';
import { Connection } from '@solana/web3.js';
import { OfferStatus } from '@/../../contracts/solana/sdk/src/types'

// Updated interface to match what getAllOffers returns
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

export default function Offers() {
  const router = useRouter();
  const { publicKey, connected, signTransaction } = useWallet();
  const { getSelectedWallet, isLocalnetMode } = useLocalWalletStore();
  const [offers, setOffers] = useState<OfferInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Initialize connection
  const [connection, setConnection] = useState<Connection | null>(null);
  
  useEffect(() => {
    // Set up connection when component mounts
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://localhost:8899';
    setConnection(new Connection(rpcUrl, 'confirmed'));
  }, []);

  useEffect(() => {
    // Load offers when component mounts or wallet connects
    if (connection) {
      loadOffers();
    }
  }, [connected, connection]);

  const loadOffers = async () => {
    try {
      setIsLoading(true);
      
      // Check for connection
      if (!connection) {
        console.error('Connection not available');
        toast.error('Solana connection not available');
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
        // For viewing offers, we can proceed with a null publicKey
        wallet = {
          publicKey: null
        };
      }
      
      // Use the offer service to fetch offers
      const fetchedOffers = await getAllOffers(
        connection,
        wallet
      );
      
      setOffers(fetchedOffers);
    } catch (error) {
      console.error('Error loading offers:', error);
      toast.error('Failed to load offers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOffer = () => {
    if (!connected && !isLocalnetMode) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    // Navigate to the create offer page
    router.push('/offers/create');
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

  // Helper to determine if an offer is a buy or sell offer
  const isBuyOffer = (offer: OfferInfo): boolean => {
    // This is a placeholder as the actual logic depends on your implementation
    // You might need to adjust this based on your actual data model
    return Math.random() > 0.5; // Temporary random assignment for demonstration
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Offers</h1>
        <button
          onClick={handleCreateOffer}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Create Offer
        </button>
      </div>
      
      {isLoading ? (
        <div className="text-center py-12">
          <svg className="animate-spin h-10 w-10 text-indigo-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-500">Loading offers...</p>
        </div>
      ) : offers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-700 font-medium mb-2">No offers found</p>
          <p className="text-gray-500 mb-2">
            Start by creating a new offer
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Currency
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      offer.status === OfferStatus.Active 
                        ? 'bg-green-100 text-green-800' 
                        : offer.status === OfferStatus.Paused 
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {offer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {offer.owner.slice(0, 4)}...{offer.owner.slice(-4)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {offer.currencyMint === SOL_TOKEN_MINT ? 'SOL' : offer.currencyMint.slice(0, 4) + '...' + offer.currencyMint.slice(-4)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {offer.price.toFixed(2)} {offer.currencyMint === SOL_TOKEN_MINT ? 'USD/SOL' : 'USD'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(offer.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => router.push(`/offers/${offer.id}`)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      View
                    </button>
                    <button
                      onClick={() => router.push(`/trades/create?offerId=${offer.id}`)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Trade
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 