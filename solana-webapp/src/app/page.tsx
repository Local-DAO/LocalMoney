'use client';

import Link from "next/link";
import { useWalletStore } from "@/store/useWalletStore";
import { FC, useEffect, useState } from "react";
import { isPhantomInstalled } from "@/utils/solana";
import { isLocalnetMode } from "@/utils/localWallets";
import LocalWalletSelector from "@/components/LocalWalletSelector";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Home() {
  const { connected } = useWalletStore();
  const [isClient, setIsClient] = useState(false);
  const phantomInstalled = isPhantomInstalled();
  const isLocalnet = isLocalnetMode();
  const { publicKey, connecting } = useWallet();

  // Set isClient to true when component mounts on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Don't render wallet-specific content during SSR
  if (!isClient) {
    return (
      <div className="flex flex-col">
        <section className="bg-background text-foreground py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl font-extrabold sm:text-5xl md:text-6xl">
                <span className="block">Trade with your peers,</span>
                <span className="block text-primary">locally.</span>
              </h1>
              <p className="mt-6 text-xl text-gray-300 max-w-3xl mx-auto">
                <span className="text-primary font-semibold">Local</span> is a decentralized P2P marketplace for the crypto multi-chain world.
              </p>
              <div className="mt-12">
                <div className="inline-flex items-center px-5 py-3 border border-primary text-base font-medium rounded-md text-primary bg-transparent">
                  Loading...
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="bg-background text-foreground py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold sm:text-5xl md:text-6xl">
              <span className="block">Trade with your peers,</span>
              <span className="block text-primary">locally.</span>
            </h1>
            <p className="mt-6 text-xl text-gray-300 max-w-3xl mx-auto">
              <span className="text-primary font-semibold">Local</span> is a decentralized P2P marketplace for the crypto multi-chain world.
            </p>
            
            {/* Local wallet selector for localnet mode */}
            {isLocalnet && (
              <div className="mt-6">
                <LocalWalletSelector />
              </div>
            )}
            
            <div className="mt-12 flex justify-center">
              {connected ? (
                <Link
                  href="/offers"
                  className="inline-flex items-center px-5 py-3 border border-primary text-base font-medium rounded-md text-white bg-primary hover:bg-opacity-90"
                >
                  Browse Offers
                </Link>
              ) : (
                <div className="inline-flex items-center">
                  {isLocalnet ? (
                    <div className="px-5 py-3 border border-primary text-base font-medium rounded-md text-primary bg-transparent">
                      Select a local wallet above to get started
                    </div>
                  ) : (
                    <WalletMultiButton className="py-3 px-5 border border-primary text-base font-medium rounded-md bg-primary hover:bg-opacity-90">
                      {connecting ? "Connecting..." : phantomInstalled ? "Connect Wallet" : "Install Phantom Wallet"}
                    </WalletMultiButton>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Top offers section */}
      <section className="py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">
              Top offers from the community
            </h2>
          </div>

          <div className="flex flex-col gap-6">
            {/* Crypto selection */}
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">Crypto</div>
              <div className="flex">
                <button className="px-4 py-2 bg-primary text-white rounded-l-md">buy</button>
                <button className="px-4 py-2 bg-secondary text-gray-400 rounded-r-md">sell</button>
              </div>
              <div className="px-4 py-2 bg-secondary text-gray-300 rounded-md flex items-center">
                <span className="mr-2">USK</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Currency selection */}
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">Currency (FIAT)</div>
              <div className="px-4 py-2 bg-secondary text-gray-300 rounded-md flex items-center">
                <span className="mr-2">🇺🇸 USD</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* List of sellers */}
          <div className="mt-12">
            <h3 className="text-xl font-bold text-foreground mb-4">
              Buy from these sellers
            </h3>
            <div className="bg-secondary rounded-lg p-6 text-center text-gray-400">
              Failed to fetch
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Why Choose LocalMoney
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-3xl mx-auto">
              Experience the benefits of decentralized trading on Solana
            </p>
          </div>

          <div className="mt-12 grid gap-8 grid-cols-1 md:grid-cols-3">
            <FeatureCard
              title="Fast & Low Cost"
              description="Benefit from Solana's high-speed transactions and minimal fees for seamless trading."
              icon={
                <svg className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            />
            
            <FeatureCard
              title="Secure & Trustless"
              description="Trade directly with other users through smart contracts without intermediaries."
              icon={
                <svg className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
            />
            
            <FeatureCard
              title="Full Control"
              description="Maintain ownership of your funds throughout the entire trading process."
              icon={
                <svg className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-3xl mx-auto">
              Simple steps to start trading on LocalMoney
            </p>
          </div>

          <div className="mt-12 grid gap-8 grid-cols-1 md:grid-cols-4">
            <StepCard 
              number={1} 
              title="Connect Wallet" 
              description="Link your Phantom wallet to get started" 
            />
            <StepCard 
              number={2} 
              title="Create Profile" 
              description="Set up your trading profile with payment methods" 
            />
            <StepCard 
              number={3} 
              title="Browse Offers" 
              description="Find trades that match your needs" 
            />
            <StepCard 
              number={4} 
              title="Trade Securely" 
              description="Complete trades with built-in escrow protection" 
            />
          </div>
        </div>
      </section>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const FeatureCard: FC<FeatureCardProps> = ({ title, description, icon }) => {
  return (
    <div className="bg-secondary p-6 rounded-lg">
      <div className="mb-4 text-primary">{icon}</div>
      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
};

interface StepCardProps {
  number: number;
  title: string;
  description: string;
}

const StepCard: FC<StepCardProps> = ({ number, title, description }) => {
  return (
    <div className="relative">
      <div className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center mb-4 font-bold">
        {number}
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
};
