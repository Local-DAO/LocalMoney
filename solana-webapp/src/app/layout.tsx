import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import { WalletContextProvider } from "@/components/WalletProvider";
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: "Local Money - Solana",
  description: "Local is a decentralized P2P marketplace for the multi-chain world.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>
          <Header />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <Toaster position="bottom-right" />
        </WalletContextProvider>
      </body>
    </html>
  );
}
