'use client';

import { FC, useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';

interface Offer {
  id: string;
  creator: string;
  amount: number;
  price: number;
  currency: string;
  paymentMethods: string[];
  isBuy: boolean;
  createdAt: Date;
}

export default function Offers() {
  const { publicKey, connected, connection } = useWallet();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load offers when component mounts or wallet connects
    loadOffers();
  }, [connected, connection]);

  const loadOffers = async () => {
    try {
      setIsLoading(true);
      
      // Here you would use your SDK to fetch offers
      // For example:
      // const offerClient = new OfferClient(connection);
      // const offers = await offerClient.getAllOffers();
      
      // For now, we'll mock some example offers
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data
      const mockOffers: Offer[] = [
        {
          id: '1',
          creator: 'Alice',
          amount: 5,
          price: 100,
          currency: 'USD',
          paymentMethods: ['Bank Transfer', 'PayPal'],
          isBuy: false,
          createdAt: new Date(Date.now() - 86400000) // 1 day ago
        },
        {
          id: '2',
          creator: 'Bob',
          amount: 2.5,
          price: 105,
          currency: 'EUR',
          paymentMethods: ['Cash Deposit', 'Revolut'],
          isBuy: true,
          createdAt: new Date(Date.now() - 43200000) // 12 hours ago
        },
        {
          id: '3',
          creator: 'Charlie',
          amount: 10,
          price: 98.5,
          currency: 'USD',
          paymentMethods: ['Zelle', 'Venmo'],
          isBuy: false,
          createdAt: new Date(Date.now() - 7200000) // 2 hours ago
        },
      ];
      
      setOffers(mockOffers);
    } catch (error) {
      console.error('Error loading offers:', error);
      toast.error('Failed to load offers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOffer = () => {
    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    toast.success('Create offer feature coming soon!');
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
          <p className="text-gray-500 mb-2">No offers found.</p>
          <p className="text-gray-500">Be the first to create an offer!</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creator
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Methods
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
                      offer.isBuy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {offer.isBuy ? 'Buy' : 'Sell'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {offer.creator}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {offer.amount} SOL
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {offer.price} {offer.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {offer.paymentMethods.join(', ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(offer.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => toast.success(`View offer ${offer.id} feature coming soon!`)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      View
                    </button>
                    <button
                      onClick={() => toast.success(`Trade with ${offer.creator} feature coming soon!`)}
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