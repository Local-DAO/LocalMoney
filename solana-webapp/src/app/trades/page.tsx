'use client';

import { FC, useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';

interface Trade {
  id: string;
  offerId: string;
  buyer: string;
  seller: string;
  amount: number;
  price: number;
  currency: string;
  status: 'initiated' | 'paid' | 'completed' | 'disputed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export default function Trades() {
  const { publicKey, connected, connection } = useWallet();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load trades when component mounts or wallet connects
    if (connected) {
      loadTrades();
    } else {
      setTrades([]);
      setIsLoading(false);
    }
  }, [connected, connection]);

  const loadTrades = async () => {
    try {
      setIsLoading(true);
      
      // Here you would use your SDK to fetch trades
      // For example:
      // const tradeClient = new TradeClient(connection, publicKey);
      // const trades = await tradeClient.getMyTrades();
      
      // For now, we'll mock some example trades
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data
      const mockTrades: Trade[] = [
        {
          id: '1',
          offerId: 'offer-1',
          buyer: 'You',
          seller: 'Alice',
          amount: 1.5,
          price: 100,
          currency: 'USD',
          status: 'completed',
          createdAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
          updatedAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
        },
        {
          id: '2',
          offerId: 'offer-2',
          buyer: 'Bob',
          seller: 'You',
          amount: 0.5,
          price: 105,
          currency: 'EUR',
          status: 'initiated',
          createdAt: new Date(Date.now() - 43200000), // 12 hours ago
          updatedAt: new Date(Date.now() - 43200000), // 12 hours ago
        },
        {
          id: '3',
          offerId: 'offer-3',
          buyer: 'You',
          seller: 'Charlie',
          amount: 2.0,
          price: 98.5,
          currency: 'USD',
          status: 'paid',
          createdAt: new Date(Date.now() - 7200000), // 2 hours ago
          updatedAt: new Date(Date.now() - 3600000), // 1 hour ago
        },
      ];
      
      setTrades(mockTrades);
    } catch (error) {
      console.error('Error loading trades:', error);
      toast.error('Failed to load trades');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeClass = (status: Trade['status']) => {
    switch (status) {
      case 'initiated':
        return 'bg-blue-100 text-blue-800';
      case 'paid':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'disputed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
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

  const handleTradeAction = (trade: Trade, action: string) => {
    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    toast.success(`${action} on trade ${trade.id} feature coming soon!`);
  };

  if (!connected) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold mb-8">Trades</h1>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Please connect your wallet to view your trades.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold mb-8">Your Trades</h1>
      
      {isLoading ? (
        <div className="text-center py-12">
          <svg className="animate-spin h-10 w-10 text-indigo-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-500">Loading trades...</p>
        </div>
      ) : trades.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 mb-2">You don't have any trades yet.</p>
          <p className="text-gray-500">Browse offers to start trading!</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trade ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
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
              {trades.map((trade) => (
                <tr key={trade.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {trade.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {trade.buyer === 'You' ? 'Buyer' : 'Seller'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {trade.amount} SOL
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {trade.price} {trade.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(trade.status)}`}>
                      {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(trade.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {trade.status === 'initiated' && trade.buyer === 'You' && (
                      <button
                        onClick={() => handleTradeAction(trade, 'Mark as paid')}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Mark as paid
                      </button>
                    )}
                    {trade.status === 'paid' && trade.seller === 'You' && (
                      <button
                        onClick={() => handleTradeAction(trade, 'Release funds')}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Release funds
                      </button>
                    )}
                    <button
                      onClick={() => handleTradeAction(trade, 'View details')}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View details
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