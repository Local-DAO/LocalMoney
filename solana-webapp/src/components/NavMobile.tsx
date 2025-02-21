'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavMobile() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Offers', href: '/offers' },
    { name: 'My Offers', href: '/my-offers' },
    { name: 'My Trades', href: '/my-trades' },
  ];

  return (
    <div className="md:hidden">
      {/* Hamburger button */}
      <button
        type="button"
        className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-primary hover:bg-gray-100"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="sr-only">Open main menu</span>
        <svg
          className="h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile menu */}
      {isOpen && (
        <div className="absolute top-16 left-0 w-full bg-white shadow-lg z-50">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === item.href
                    ? 'text-primary bg-gray-100'
                    : 'text-gray-600 hover:text-primary hover:bg-gray-100'
                }`}
                onClick={() => setIsOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 