import { WalletButton } from '@/components/WalletButton';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-8">
        <nav className="flex justify-between items-center mb-12">
          <h1 className="text-2xl font-bold">LocalMoney Solana</h1>
          <WalletButton />
        </nav>
        
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Welcome to LocalMoney</h2>
          <p className="text-gray-400 mb-8">
            Connect your wallet to start using the Solana-based LocalMoney application.
          </p>
        </div>
      </div>
    </main>
  );
}
