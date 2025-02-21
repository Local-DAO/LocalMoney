'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { formatAddress, formatAmount, timeSince } from '@/utils/format';
import { sdkService } from '@/services/sdk';
import { notify } from '@/services/notification';
import Loading from '@/components/Loading';
import NotConnected from '@/components/NotConnected';

interface Offer {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  minAmount: number;
  maxAmount: number;
  fiat: string;
  denom: string;
  owner: string;
  createdAt: Date;
  status: 'active' | 'completed' | 'cancelled';
}

export default function OfferDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { publicKey } = useWallet();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [tradeAmount, setTradeAmount] = useState('');
  const [creatingTrade, setCreatingTrade] = useState(false);

  useEffect(() => {
    const fetchOffer = async () => {
      try {
        // TODO: Fetch offer details from SDK
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch offer:', error);
        notify.error('Failed to load offer details');
        router.push('/offers');
      }
    };

    fetchOffer();
  }, [id, router]);

  const handleCreateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !offer) return;

    setCreatingTrade(true);
    try {
      await sdkService.createTrade({
        offerId: offer.id,
        amount: parseFloat(tradeAmount),
      });
      notify.success('Trade created successfully');
      router.push('/my-trades');
    } catch (error) {
      console.error('Failed to create trade:', error);
      notify.error('Failed to create trade');
    } finally {
      setCreatingTrade(false);
    }
  };

  if (!publicKey) {
    return <NotConnected />;
  }

  if (loading || !offer) {
    return <Loading />;
  }

  const isOwner = publicKey.toBase58() === offer.owner;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {offer.type === 'buy' ? 'Buy' : 'Sell'} {offer.denom}
            </h1>
            <div className="flex space-x-2">
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
          </div>
          <p className="text-sm text-gray-500">{timeSince(offer.createdAt)}</p>
        </div>

        <div className="space-y-4 mb-8">
          <div>
            <p className="text-sm text-gray-500">Amount</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatAmount(offer.amount, 9)} {offer.denom}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Limits</p>
            <p className="text-base text-gray-900">
              {formatAmount(offer.minAmount, 9)} - {formatAmount(offer.maxAmount, 9)} {offer.denom}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Currency</p>
            <p className="text-base text-gray-900">{offer.fiat}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Owner</p>
            <p className="text-base text-gray-900 font-mono">{formatAddress(offer.owner, 12)}</p>
          </div>
        </div>

        {!isOwner && offer.status === 'active' && (
          <form onSubmit={handleCreateTrade} className="space-y-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Trade Amount ({offer.denom})
              </label>
              <input
                type="number"
                id="amount"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                min={offer.minAmount}
                max={offer.maxAmount}
                step="0.000000001"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary"
                required
              />
            </div>

            <button
              type="submit"
              disabled={creatingTrade}
              className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingTrade ? 'Creating Trade...' : 'Create Trade'}
            </button>
          </form>
        )}

        {isOwner && offer.status === 'active' && (
          <button
            onClick={async () => {
              try {
                await sdkService.cancelOffer(offer.id);
                notify.success('Offer cancelled successfully');
                router.push('/my-offers');
              } catch (error) {
                console.error('Failed to cancel offer:', error);
                notify.error('Failed to cancel offer');
              }
            }}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-500 transition-colors"
          >
            Cancel Offer
          </button>
        )}
      </div>
    </div>
  );
} 