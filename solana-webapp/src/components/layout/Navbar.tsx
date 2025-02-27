'use client';

import { FC } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import WalletButton from '@/components/ui/WalletButton';
import { useWalletStore } from '@/store/useWalletStore';
import { formatSOL } from '@/utils/solana';
import { useLocalWalletStore } from '@/utils/localWallets';
import LocalWalletSelector from '@/components/LocalWalletSelector';

export const Navbar: FC = () => {
  const pathname = usePathname();
  const { connected, balance, balanceLoading } = useWalletStore();
  const { isLocalnetMode } = useLocalWalletStore();
  const isLocalnet = isLocalnetMode;

  const navLinks = [
    { name: 'My Trades', href: '/trades' },
  ];

  return (
    <nav className="bg-background text-foreground shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold flex items-center">
                <img src="/logo.svg" alt="LocalMoney Logo" className="h-8 w-8 mr-2" />
                <span className="text-primary">Local Money</span>
                <span className="ml-4 text-xs bg-secondary px-2 py-1 rounded text-gray-400">
                  {isLocalnet ? 'Localnet' : 'Mainnet'}
                </span>
              </Link>
            </div>
            <div className="ml-10 flex items-center space-x-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === link.href
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-300 hover:text-primary'
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
            {isLocalnet && <LocalWalletSelector />}
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 