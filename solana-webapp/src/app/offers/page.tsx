'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Offer {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  fiat: string;
  denom: string;
  owner: string;
  createdAt: Date;
}

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch offers from the SDK
    setLoading(false);
  }, []);

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
        <h1 className="text-2xl font-bold text-gray-900">Available Offers</h1>
        <Link
          href="/offers/create"
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-light transition-colors"
        >
          Create Offer
        </Link>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No offers available</h3>
          <p className="text-gray-500">Be the first one to create an offer!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      offer.type === 'buy'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {offer.type.toUpperCase()}
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

              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500 truncate" title={offer.owner}>
                  {offer.owner.slice(0, 8)}...{offer.owner.slice(-8)}
                </p>
                <Link
                  href={`/offers/${offer.id}`}
                  className="text-primary hover:text-primary-light font-medium text-sm"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 