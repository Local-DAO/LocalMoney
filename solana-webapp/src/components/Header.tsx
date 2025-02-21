'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavDesktop from './NavDesktop';
import NavMobile from './NavMobile';
import { WalletButton } from './WalletButton';

export default function Header() {
  const [isMobile, setIsMobile] = useState(false);
  const badge = 'Solana'; // TODO: Get from chain config

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 550);
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center">
            <div className="h-8 w-8 bg-primary rounded-full" /> {/* Placeholder logo */}
          </Link>

          <div className="bg-gray-100 rounded-full px-3 py-1">
            <p className="text-sm font-medium text-gray-600">{badge}</p>
          </div>
        </div>

        {isMobile ? <NavMobile /> : <NavDesktop />}
        <WalletButton />
      </div>
    </header>
  );
} 