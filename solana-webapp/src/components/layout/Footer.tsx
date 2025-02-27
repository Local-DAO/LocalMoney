'use client';

import { FC } from 'react';
import Link from 'next/link';

export const Footer: FC = () => {
  return (
    <footer className="bg-gray-900 text-white py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <div className="text-xl font-bold">LocalMoney</div>
            <p className="text-gray-400 text-sm mt-2">
              Peer-to-peer trading on Solana
            </p>
          </div>
          <div className="flex space-x-6">
            <Link href="/" className="text-gray-400 hover:text-white">
              Home
            </Link>
            <Link href="/profile" className="text-gray-400 hover:text-white">
              Profile
            </Link>
            <Link href="/offers" className="text-gray-400 hover:text-white">
              Offers
            </Link>
            <Link href="/trades" className="text-gray-400 hover:text-white">
              Trades
            </Link>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-800 pt-4 flex justify-between items-center">
          <p className="text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} LocalMoney. All rights reserved.
          </p>
          <div className="flex space-x-4">
            <a
              href="https://solana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white"
            >
              Built on Solana
            </a>
            <a
              href="https://phantom.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white"
            >
              Phantom Wallet
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 