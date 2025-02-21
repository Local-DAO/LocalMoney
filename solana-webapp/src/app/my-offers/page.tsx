'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

interface Offer {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  fiat: string;
  denom: string;
  owner: string;
  createdAt: Date;
  status: 'active' | 'completed' | 'cancelled';
}

export default function MyOffersPage() {
  const { publicKey } = useWallet();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicKey) return;

    // TODO: Fetch user's offers from SDK
    setLoading(false);
  }, [publicKey]);

  if (!publicKey) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Connect your wallet</h3>
        <p className="text-gray-500">Please connect your wallet to view your offers.</p>
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
        <h1 className="text-2xl font-bold text-gray-900">My Offers</h1>
        <Link
          href="/offers/create"
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-light transition-colors"
        >
          Create Offer
        </Link>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No offers yet</h3>
          <p className="text-gray-500">Create your first offer to start trading!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="space-x-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      offer.type === 'buy'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {offer.type.toUpperCase()}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      offer.status === 'active'
                        ? 'bg-blue-100 text-blue-800'
                        : offer.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {offer.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {new Date(offer.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="mb-4">
                <p className="text-lg font-semibold text-gray-900">
                  {offer.amount} {offer.denom}
                </p>
                <p className="text-sm text-gray-500">{offer.fiat}</p>
              </div>

              <div className="flex justify-end space-x-4">
                <Link
                  href={`/offers/${offer.id}`}
                  className="text-primary hover:text-primary-light font-medium text-sm"
                >
                  View Details
                </Link>
                {offer.status === 'active' && (
                  <button
                    onClick={() => {
                      // TODO: Cancel offer
                    }}
                    className="text-red-600 hover:text-red-500 font-medium text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 