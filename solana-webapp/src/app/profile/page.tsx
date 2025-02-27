'use client';

import { FC, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletStore } from '@/store/useWalletStore';
import { shortenAddress, getExplorerUrl } from '@/utils/solana';
import toast from 'react-hot-toast';
import { Connection, PublicKey } from '@solana/web3.js';

export default function Profile() {
  const { publicKey, connected, connection } = useWallet();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [paymentMethods, setPaymentMethods] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  
  // Load profile data if available
  useEffect(() => {
    if (connected && publicKey && connection) {
      loadProfileData();
    }
  }, [connected, publicKey, connection]);

  const loadProfileData = async () => {
    try {
      setIsLoading(true);
      // Here you would use your SDK to load profile data
      // For now, we're just simulating profile data
      // In a real implementation, you would call:
      // const profileClient = new ProfileClient(connection, publicKey);
      // const profileData = await profileClient.getProfile(publicKey);
      
      // Simulate loading profile data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate profile data (replace with actual SDK calls)
      setUsername('Trader' + publicKey.toString().substring(0, 4));
      setBio('Solana trader since 2023');
      setPaymentMethods('Bank Transfer, PayPal');
      setIsProfileLoaded(true);
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    try {
      setIsLoading(true);
      // Here you would use your SDK to save profile data
      // For example:
      // const profileClient = new ProfileClient(connection, publicKey);
      // await profileClient.updateProfile({
      //   username,
      //   bio,
      //   paymentMethods
      // });
      
      // Simulate saving
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Profile saved successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Please connect your wallet to view and manage your profile.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Your Profile</h1>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Wallet Information</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about your Solana wallet.</p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Wallet Address</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {publicKey ? (
                  <div className="flex items-center">
                    <span className="font-mono">{shortenAddress(publicKey.toString(), 8)}</span>
                    <a 
                      href={getExplorerUrl(publicKey.toString())} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 text-indigo-600 hover:text-indigo-800"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                ) : 'Not connected'}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Balance</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {useWalletStore.getState().balance.toFixed(4)} SOL
              </dd>
            </div>
          </dl>
        </div>
      </div>
      
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Profile Information</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>This information will be displayed to other users when they view your offers or trades.</p>
          </div>
          
          <form className="mt-5" onSubmit={handleSaveProfile}>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                <input
                  type="text"
                  name="username"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Your trading name"
                />
              </div>
              
              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700">Bio</label>
                <textarea
                  name="bio"
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Tell others about yourself"
                />
              </div>
              
              <div>
                <label htmlFor="paymentMethods" className="block text-sm font-medium text-gray-700">Payment Methods</label>
                <textarea
                  name="paymentMethods"
                  id="paymentMethods"
                  value={paymentMethods}
                  onChange={(e) => setPaymentMethods(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="List payment methods you accept (e.g. Bank Transfer, PayPal)"
                />
              </div>
            </div>
            
            <div className="mt-6">
              <button
                type="submit"
                disabled={isLoading}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                  isLoading ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 