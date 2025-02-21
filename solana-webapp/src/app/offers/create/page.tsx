'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateOfferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'buy',
    amount: '',
    minAmount: '',
    maxAmount: '',
    fiat: 'USD',
    denom: 'SOL',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Create offer using SDK
      router.push('/offers');
    } catch (error) {
      console.error('Failed to create offer:', error);
      // TODO: Show error notification
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Create New Offer</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Offer Type
          </label>
          <div className="flex space-x-4">
            <button
              type="button"
              className={`flex-1 py-2 px-4 rounded-lg border ${
                formData.type === 'buy'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setFormData({ ...formData, type: 'buy' })}
            >
              Buy
            </button>
            <button
              type="button"
              className={`flex-1 py-2 px-4 rounded-lg border ${
                formData.type === 'sell'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setFormData({ ...formData, type: 'sell' })}
            >
              Sell
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
            Amount ({formData.denom})
          </label>
          <input
            type="number"
            id="amount"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="minAmount" className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Amount
            </label>
            <input
              type="number"
              id="minAmount"
              value={formData.minAmount}
              onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary"
              required
            />
          </div>
          <div>
            <label htmlFor="maxAmount" className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Amount
            </label>
            <input
              type="number"
              id="maxAmount"
              value={formData.maxAmount}
              onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="fiat" className="block text-sm font-medium text-gray-700 mb-2">
            Fiat Currency
          </label>
          <select
            id="fiat"
            value={formData.fiat}
            onChange={(e) => setFormData({ ...formData, fiat: e.target.value })}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            {/* Add more currencies as needed */}
          </select>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Offer'}
          </button>
        </div>
      </form>
    </div>
  );
} 