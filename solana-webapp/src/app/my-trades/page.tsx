'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

interface Trade {
  id: string;
  offerId: string;
  type: 'buy' | 'sell';
  amount: number;
  fiat: string;
  denom: string;
  counterparty: string;
  createdAt: Date;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'disputed';
}

export default function MyTradesPage() {
  const { publicKey } = useWallet();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicKey) return;

    // TODO: Fetch user's trades from SDK
    setLoading(false);
  }, [publicKey]);

  if (!publicKey) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Connect your wallet</h3>
        <p className="text-gray-500">Please connect your wallet to view your trades.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Trades</h1>
        <Link
          href="/offers"
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-light transition-colors"
        >
          Find Offers
        </Link>
      </div>

      {trades.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No trades yet</h3>
          <p className="text-gray-500">Start trading by finding an offer!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {trades.map((trade) => (
            <div
              key={trade.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="space-x-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      trade.type === 'buy'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {trade.type.toUpperCase()}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      trade.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : trade.status === 'active'
                        ? 'bg-blue-100 text-blue-800'
                        : trade.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : trade.status === 'disputed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {trade.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {new Date(trade.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="mb-4">
                <p className="text-lg font-semibold text-gray-900">
                  {trade.amount} {trade.denom}
                </p>
                <p className="text-sm text-gray-500">{trade.fiat}</p>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500 truncate" title={trade.counterparty}>
                  Trading with: {trade.counterparty.slice(0, 8)}...{trade.counterparty.slice(-8)}
                </p>
                <div className="flex space-x-4">
                  <Link
                    href={`/trades/${trade.id}`}
                    className="text-primary hover:text-primary-light font-medium text-sm"
                  >
                    View Details
                  </Link>
                  {trade.status === 'active' && (
                    <button
                      onClick={() => {
                        // TODO: Complete trade
                      }}
                      className="text-green-600 hover:text-green-500 font-medium text-sm"
                    >
                      Complete
                    </button>
                  )}
                  {(trade.status === 'pending' || trade.status === 'active') && (
                    <button
                      onClick={() => {
                        // TODO: Cancel trade
                      }}
                      className="text-red-600 hover:text-red-500 font-medium text-sm"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 