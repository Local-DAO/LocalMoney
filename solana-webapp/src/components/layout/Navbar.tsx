'use client';

import { FC } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import WalletButton from '@/components/ui/WalletButton';
import { useWalletStore } from '@/store/useWalletStore';
import { formatSOL } from '@/utils/solana';

export const Navbar: FC = () => {
  const pathname = usePathname();
  const { connected, balance, balanceLoading } = useWalletStore();

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Profile', href: '/profile' },
    { name: 'Offers', href: '/offers' },
    { name: 'Trades', href: '/trades' },
  ];

  return (
    <nav className="bg-gray-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold">
                LocalMoney
              </Link>
            </div>
            <div className="ml-10 flex items-center space-x-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === link.href
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {connected && !balanceLoading && (
              <div className="text-sm font-medium text-gray-300">
                {formatSOL(balance)}
              </div>
            )}
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 