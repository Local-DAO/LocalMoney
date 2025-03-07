'use client';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet, Wallet } from '@solana/wallet-adapter-react';
import { WalletName, WalletReadyState } from '@solana/wallet-adapter-base';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useLocalWalletStore, LocalWallet, LocalWalletType } from '@/utils/localWallets';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export const LocalWalletModal: FC = () => {
  const { wallets, select, connected } = useWallet();
  const { visible, setVisible } = useWalletModal();
  const { wallets: localWallets, selectWallet, isLocalnetMode } = useLocalWalletStore();
  const [selectedTab, setSelectedTab] = useState<'standard' | 'local'>('standard');

  // Close the modal when a wallet is connected
  useEffect(() => {
    if (connected) {
      setVisible(false);
    }
  }, [connected, setVisible]);

  // Filter wallets by ready state
  const [installedWallets, otherWallets] = useMemo(() => {
    const installed: Wallet[] = [];
    const notInstalled: Wallet[] = [];

    for (const wallet of wallets) {
      if (wallet.readyState === WalletReadyState.Installed || wallet.readyState === WalletReadyState.Loadable) {
        installed.push(wallet);
      } else {
        notInstalled.push(wallet);
      }
    }

    return [installed, notInstalled];
  }, [wallets]);

  // Handle selecting a standard wallet
  const handleSelectWallet = useCallback(
    (walletName: WalletName) => {
      select(walletName);
      setVisible(false);
    },
    [select, setVisible]
  );

  // Handle selecting a local wallet
  const handleSelectLocalWallet = useCallback(
    (type: LocalWalletType) => {
      selectWallet(type);
      setVisible(false);
    },
    [selectWallet, setVisible]
  );

  return (
    <Transition appear show={visible} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => setVisible(false)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center"
                >
                  Connect a Wallet
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                    onClick={() => setVisible(false)}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </Dialog.Title>

                {/* Tabs for standard/local wallets */}
                {isLocalnetMode && (
                  <div className="border-b border-gray-200 mt-4">
                    <nav className="-mb-px flex" aria-label="Tabs">
                      <button
                        onClick={() => setSelectedTab('standard')}
                        className={`${
                          selectedTab === 'standard'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } w-1/2 py-2 px-1 text-center border-b-2 font-medium text-sm`}
                      >
                        Standard Wallets
                      </button>
                      <button
                        onClick={() => setSelectedTab('local')}
                        className={`${
                          selectedTab === 'local'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } w-1/2 py-2 px-1 text-center border-b-2 font-medium text-sm`}
                      >
                        Local Wallets
                      </button>
                    </nav>
                  </div>
                )}

                <div className="mt-4">
                  {selectedTab === 'standard' ? (
                    <div className="space-y-4">
                      {installedWallets.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Installed Wallets</h4>
                          <div className="space-y-2">
                            {installedWallets.map((wallet) => (
                              <button
                                key={wallet.adapter.name}
                                onClick={() => handleSelectWallet(wallet.adapter.name)}
                                className="flex items-center w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                              >
                                {wallet.adapter.icon && (
                                  <img
                                    src={wallet.adapter.icon}
                                    alt={`${wallet.adapter.name} icon`}
                                    className="h-5 w-5 mr-2"
                                  />
                                )}
                                {wallet.adapter.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {otherWallets.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Other Wallets</h4>
                          <div className="space-y-2">
                            {otherWallets.map((wallet) => (
                              <button
                                key={wallet.adapter.name}
                                onClick={() => handleSelectWallet(wallet.adapter.name)}
                                className="flex items-center w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                              >
                                {wallet.adapter.icon && (
                                  <img
                                    src={wallet.adapter.icon}
                                    alt={`${wallet.adapter.name} icon`}
                                    className="h-5 w-5 mr-2"
                                  />
                                )}
                                {wallet.adapter.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Local Development Wallets</h4>
                      <div className="space-y-2">
                        {localWallets.map((wallet) => (
                          <button
                            key={wallet.type}
                            onClick={() => handleSelectLocalWallet(wallet.type)}
                            className="flex items-center w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <span className="h-5 w-5 mr-2 flex items-center justify-center bg-indigo-100 text-indigo-500 rounded-full">
                              {wallet.type === 'maker' ? 'M' : 'T'}
                            </span>
                            {wallet.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default LocalWalletModal; 