'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { formatAddress, formatAmount, timeSince } from '@/utils/format';
import { sdkService } from '@/services/sdk';
import { notify } from '@/services/notification';
import Loading from '@/components/Loading';
import NotConnected from '@/components/NotConnected';

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

export default function TradeDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { publicKey } = useWallet();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchTrade = async () => {
      try {
        // TODO: Fetch trade details from SDK
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch trade:', error);
        notify.error('Failed to load trade details');
        router.push('/my-trades');
      }
    };

    fetchTrade();
  }, [id, router]);

  const handleAction = async (action: 'complete' | 'cancel' | 'dispute') => {
    if (!trade) return;

    setProcessing(true);
    try {
      switch (action) {
        case 'complete':
          await sdkService.completeTrade(trade.id);
          notify.success('Trade completed successfully');
          break;
        case 'cancel':
          await sdkService.cancelTrade(trade.id);
          notify.success('Trade cancelled successfully');
          break;
        case 'dispute':
          await sdkService.disputeTrade(trade.id);
          notify.warning('Trade dispute initiated');
          break;
      }
      router.push('/my-trades');
    } catch (error) {
      console.error(`Failed to ${action} trade:`, error);
      notify.error(`Failed to ${action} trade`);
    } finally {
      setProcessing(false);
    }
  };

  if (!publicKey) {
    return <NotConnected />;
  }

  if (loading || !trade) {
    return <Loading />;
  }

  const isCounterparty = publicKey.toBase58() === trade.counterparty;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {trade.type === 'buy' ? 'Buy' : 'Sell'} {trade.denom}
            </h1>
            <div className="flex space-x-2">
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
          </div>
          <p className="text-sm text-gray-500">{timeSince(trade.createdAt)}</p>
        </div>

        <div className="space-y-4 mb-8">
          <div>
            <p className="text-sm text-gray-500">Amount</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatAmount(trade.amount, 9)} {trade.denom}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Currency</p>
            <p className="text-base text-gray-900">{trade.fiat}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Counterparty</p>
            <p className="text-base text-gray-900 font-mono">
              {formatAddress(trade.counterparty, 12)}
            </p>
          </div>
        </div>

        {trade.status === 'active' && (
          <div className="space-y-3">
            <button
              onClick={() => handleAction('complete')}
              disabled={processing}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Complete Trade'}
            </button>

            <button
              onClick={() => handleAction('dispute')}
              disabled={processing}
              className="w-full bg-yellow-600 text-white py-2 px-4 rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Dispute Trade'}
            </button>

            <button
              onClick={() => handleAction('cancel')}
              disabled={processing}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Cancel Trade'}
            </button>
          </div>
        )}

        {trade.status === 'disputed' && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
            <p className="text-yellow-800">
              This trade is under dispute. Please contact support for assistance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 