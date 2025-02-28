'use client';

import { FC, useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter, useParams } from 'next/navigation';
import { PublicKey, Connection } from '@solana/web3.js';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { getTrade, acceptTrade, completeTrade, cancelTrade, disputeTrade } from '@/utils/tradeService';
import { useLocalWalletStore } from '@/utils/localWallets';
import { TradeStatus } from '@localmoney/solana-sdk';

interface TradeDetails {
  id: string;
  buyer: string | null;
  seller: string;
  amount: number;
  price: number;
  status: TradeStatus;
  createdAt: Date;
  updatedAt: Date;
}

export default function TradeDetails() {
  const params = useParams();
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const { getSelectedWallet, isLocalnetMode } = useLocalWalletStore();
  
  const [trade, setTrade] = useState<TradeDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isBuyer, setIsBuyer] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [userMessage, setUserMessage] = useState<string>('');

  useEffect(() => {
    // Set up connection when component mounts
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://localhost:8899';
    setConnection(new Connection(rpcUrl, 'confirmed'));
  }, []);

  useEffect(() => {
    if (connection) {
      loadTradeDetails();
    }
  }, [params.id, connected, connection]);

  useEffect(() => {
    // Check if logged-in user is the buyer or seller
    if (trade && publicKey) {
      if (isLocalnetMode) {
        const selectedWallet = getSelectedWallet();
        if (selectedWallet) {
          const walletPubkey = selectedWallet.keypair.publicKey.toString();
          setIsBuyer(trade.buyer === walletPubkey);
          setIsSeller(trade.seller === walletPubkey);
        }
      } else {
        setIsBuyer(trade.buyer === publicKey.toString());
        setIsSeller(trade.seller === publicKey.toString());
      }
    } else {
      setIsBuyer(false);
      setIsSeller(false);
    }
  }, [trade, publicKey, isLocalnetMode, getSelectedWallet]);

  const loadTradeDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!params.id) {
        setError('Invalid trade ID');
        return;
      }

      if (!connection) {
        setError('Solana connection not available');
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
        // For viewing, we can proceed without a connected wallet
        wallet = {
          publicKey: null
        };
      }
      
      // Try parsing the ID as a PublicKey
      let tradePDA: PublicKey;
      try {
        tradePDA = new PublicKey(params.id);
      } catch (error) {
        setError('Invalid trade ID format');
        return;
      }
      
      // Fetch the trade details
      const tradeDetails = await getTrade(connection, wallet, tradePDA);
      
      if (tradeDetails) {
        setTrade(tradeDetails);
      } else {
        setError('Trade not found');
      }
    } catch (error: any) {
      console.error('Error loading trade:', error);
      setError(error.message || 'Failed to load trade details');
    } finally {
      setIsLoading(false);
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

  const getStatusText = (status: TradeStatus) => {
    switch (status) {
      case TradeStatus.Open:
        return 'Open';
      case TradeStatus.InProgress:
        return 'In Progress';
      case TradeStatus.Completed:
        return 'Completed';
      case TradeStatus.Cancelled:
        return 'Cancelled';
      case TradeStatus.Disputed:
        return 'Disputed';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: TradeStatus) => {
    switch (status) {
      case TradeStatus.Open:
        return 'bg-blue-100 text-blue-800';
      case TradeStatus.InProgress:
        return 'bg-yellow-100 text-yellow-800';
      case TradeStatus.Completed:
        return 'bg-green-100 text-green-800';
      case TradeStatus.Disputed:
        return 'bg-red-100 text-red-800';
      case TradeStatus.Cancelled:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getInstructions = () => {
    if (!trade) return 'Loading trade details...';

    if (isBuyer) {
      switch (trade.status) {
        case TradeStatus.Open:
          return 'Waiting for the seller to accept this trade.';
        case TradeStatus.InProgress:
          return 'Mark as paid once you have sent the payment via the agreed method.';
        case TradeStatus.Completed:
          return 'This trade has been completed. The SOL has been transferred to your wallet.';
        case TradeStatus.Cancelled:
          return 'This trade has been cancelled.';
        case TradeStatus.Disputed:
          return 'This trade is currently under dispute. Please contact support.';
      }
    } else if (isSeller) {
      switch (trade.status) {
        case TradeStatus.Open:
          return 'Please accept this trade to proceed or cancel if you no longer wish to trade.';
        case TradeStatus.InProgress:
          return 'Once you confirm receipt of payment, the SOL will be released to the buyer.';
        case TradeStatus.Completed:
          return 'This trade has been completed. The SOL has been transferred to the buyer.';
        case TradeStatus.Cancelled:
          return 'This trade has been cancelled.';
        case TradeStatus.Disputed:
          return 'This trade is currently under dispute. Please contact support.';
      }
    } else {
      return 'You are viewing this trade as a third party.';
    }
  };

  const handleAcceptTrade = async () => {
    if (!trade || !connection) return;
    
    if (!connected && !isLocalnetMode) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    // Get the wallet to use
    let wallet;
    
    if (isLocalnetMode) {
      // Use the selected local wallet
      const selectedWallet = getSelectedWallet();
      if (!selectedWallet) {
        toast.error('Please select a local wallet');
        return;
      }
      wallet = {
        publicKey: selectedWallet.keypair.publicKey,
        keypair: selectedWallet.keypair
      };
    } else if (publicKey) {
      wallet = {
        publicKey
      };
    } else {
      toast.error('Please connect your wallet');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const success = await acceptTrade(
        connection,
        wallet,
        new PublicKey(trade.id)
      );
      
      if (success) {
        toast.success('Trade accepted successfully!');
        loadTradeDetails(); // Reload trade details
      }
    } catch (error: any) {
      console.error('Error accepting trade:', error);
      toast.error(error.message || 'Failed to accept trade');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteTrade = async () => {
    if (!trade || !connection) return;
    
    if (!connected && !isLocalnetMode) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    // Get the wallet to use
    let wallet;
    
    if (isLocalnetMode) {
      // Use the selected local wallet
      const selectedWallet = getSelectedWallet();
      if (!selectedWallet) {
        toast.error('Please select a local wallet');
        return;
      }
      wallet = {
        publicKey: selectedWallet.keypair.publicKey,
        keypair: selectedWallet.keypair
      };
    } else if (publicKey) {
      wallet = {
        publicKey
      };
    } else {
      toast.error('Please connect your wallet');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const success = await completeTrade(
        connection,
        wallet,
        new PublicKey(trade.id)
      );
      
      if (success) {
        toast.success('Trade completed successfully!');
        loadTradeDetails(); // Reload trade details
      }
    } catch (error: any) {
      console.error('Error completing trade:', error);
      toast.error(error.message || 'Failed to complete trade');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTrade = async () => {
    if (!trade || !connection) return;
    
    if (!connected && !isLocalnetMode) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    // Get the wallet to use
    let wallet;
    
    if (isLocalnetMode) {
      // Use the selected local wallet
      const selectedWallet = getSelectedWallet();
      if (!selectedWallet) {
        toast.error('Please select a local wallet');
        return;
      }
      wallet = {
        publicKey: selectedWallet.keypair.publicKey,
        keypair: selectedWallet.keypair
      };
    } else if (publicKey) {
      wallet = {
        publicKey
      };
    } else {
      toast.error('Please connect your wallet');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const success = await cancelTrade(
        connection,
        wallet,
        new PublicKey(trade.id)
      );
      
      if (success) {
        toast.success('Trade cancelled successfully!');
        loadTradeDetails(); // Reload trade details
      }
    } catch (error: any) {
      console.error('Error cancelling trade:', error);
      toast.error(error.message || 'Failed to cancel trade');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisputeTrade = async () => {
    if (!trade || !connection) return;
    
    if (!connected && !isLocalnetMode) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    // Get the wallet to use
    let wallet;
    
    if (isLocalnetMode) {
      // Use the selected local wallet
      const selectedWallet = getSelectedWallet();
      if (!selectedWallet) {
        toast.error('Please select a local wallet');
        return;
      }
      wallet = {
        publicKey: selectedWallet.keypair.publicKey,
        keypair: selectedWallet.keypair
      };
    } else if (publicKey) {
      wallet = {
        publicKey
      };
    } else {
      toast.error('Please connect your wallet');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const success = await disputeTrade(
        connection,
        wallet,
        new PublicKey(trade.id)
      );
      
      if (success) {
        toast.success('Trade dispute initiated!');
        loadTradeDetails(); // Reload trade details
      }
    } catch (error: any) {
      console.error('Error disputing trade:', error);
      toast.error(error.message || 'Failed to dispute trade');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserMessage(e.target.value);
  };
  
  const handleSendMessage = () => {
    if (!userMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }
    
    // In a real app, we would save this message to the backend
    toast.success('Message feature coming soon!');
    setUserMessage('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Trade Details</h1>
        <Link
          href="/trades"
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Back to Trades
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <svg className="animate-spin h-10 w-10 text-indigo-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-500">Loading trade details...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      ) : trade ? (
        <div>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Trade #{trade.id.substring(0, 8)}...
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Created {formatDate(trade.createdAt)}
                </p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(trade.status)}`}>
                {getStatusText(trade.status)}
              </span>
            </div>
            
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Trade ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 break-all">{trade.id}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Buyer</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 break-all">
                    {trade.buyer ? (
                      <>
                        {trade.buyer} 
                        {isBuyer && <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">You</span>}
                      </>
                    ) : 'Waiting for buyer...'}
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Seller</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 break-all">
                    {trade.seller}
                    {isSeller && <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">You</span>}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Amount</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{trade.amount} SOL</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Price</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{trade.price} USD per SOL</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Total Value</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{(trade.amount * trade.price).toFixed(2)} USD</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(trade.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
          
          {/* Instructions Panel */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">{getInstructions()}</p>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 justify-end mb-8">
            {/* Seller Actions */}
            {isSeller && (
              <>
                {trade.status === TradeStatus.Open && (
                  <>
                    <button
                      type="button"
                      onClick={handleAcceptTrade}
                      disabled={isSubmitting}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      {isSubmitting ? 'Processing...' : 'Accept Trade'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelTrade}
                      disabled={isSubmitting}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      {isSubmitting ? 'Processing...' : 'Cancel Trade'}
                    </button>
                  </>
                )}
                {trade.status === TradeStatus.InProgress && (
                  <>
                    <button
                      type="button"
                      onClick={handleCompleteTrade}
                      disabled={isSubmitting}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      {isSubmitting ? 'Processing...' : 'Release Funds'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDisputeTrade}
                      disabled={isSubmitting}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                    >
                      {isSubmitting ? 'Processing...' : 'Dispute Trade'}
                    </button>
                  </>
                )}
              </>
            )}
            
            {/* Buyer Actions */}
            {isBuyer && (
              <>
                {trade.status === TradeStatus.InProgress && (
                  <button
                    type="button"
                    onClick={handleDisputeTrade}
                    disabled={isSubmitting}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    {isSubmitting ? 'Processing...' : 'Dispute Trade'}
                  </button>
                )}
              </>
            )}
          </div>
          
          {/* Chat Section */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Trade Chat</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">Communicate with your trade partner</p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <div className="bg-gray-50 p-4 rounded-md mb-4 h-64 overflow-y-auto">
                <p className="text-sm text-gray-500 text-center">Chat functionality coming soon...</p>
              </div>
              <div className="mt-4">
                <label htmlFor="message" className="sr-only">Message</label>
                <textarea
                  id="message"
                  name="message"
                  rows={3}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Type your message here..."
                  value={userMessage}
                  onChange={handleMessageChange}
                ></textarea>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSendMessage}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
} 