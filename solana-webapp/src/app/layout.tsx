import type { Metadata } from "next";
import { Inter } from "next/font/google";
import WalletProvider from "@/providers/WalletProvider";
import ToastProvider from "@/providers/ToastProvider";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LocalMoney - Solana P2P Trading",
  description: "Decentralized peer-to-peer trading platform on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider>
          <WalletProvider>
            <div className="flex flex-col min-h-screen">
              <Navbar />
              <main className="flex-grow">{children}</main>
              <Footer />
            </div>
          </WalletProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
