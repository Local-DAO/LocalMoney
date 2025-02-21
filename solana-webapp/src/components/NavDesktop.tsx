'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavDesktop() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Offers', href: '/offers' },
    { name: 'My Offers', href: '/my-offers' },
    { name: 'My Trades', href: '/my-trades' },
  ];

  return (
    <nav className="hidden md:flex items-center space-x-8">
      {navItems.map((item) => (
        <Link
          key={item.name}
          href={item.href}
          className={`text-base font-medium transition-colors duration-200 ${
            pathname === item.href
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-600 hover:text-primary'
          }`}
        >
          {item.name}
        </Link>
      ))}
    </nav>
  );
} 