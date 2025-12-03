import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createPublicClient, createWalletClient, custom, http, formatEther, formatUnits, type Address } from 'viem'
import { bsc } from 'viem/chains'
import { BSC_CONFIG, BSC_TOKEN_ADDRESS } from '~/utils/bridge-constants'
import type { WalletState } from '~/types/bridge'

interface MetaMaskProvider {
  isMetaMask?: boolean
  request: (args: { method: string; params?: any[] }) => Promise<any>
  on: (event: string, handler: (...args: any[]) => void) => void
  removeListener: (event: string, handler: (...args: any[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: MetaMaskProvider
  }
}

export const useMetaMaskStore = defineStore('metamask', () => {
  // Check if running in browser
  const isBrowser = typeof window !== 'undefined'

  // State
  const isConnected = ref(false)
  const account = ref<string>('')
  const chainId = ref<string>('')
  const balance = ref<string>('0')
  const tokenBalance = ref<string>('0')
  const isCorrectNetwork = ref(false)

  let publicClient: any = null
  // @ts-expect-error - walletClient will be used in future features
  let walletClient: any = null

  // ERC-20 ABI for balanceOf and decimals
  const ERC20_ABI = [
    {
      constant: true,
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'decimals',
      outputs: [{ name: '', type: 'uint8' }],
      type: 'function',
    },
  ] as const

  // Check if MetaMask is installed
  const isMetaMaskInstalled = (): boolean => {
    if (!isBrowser) return false
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask === true
  }

  // Switch to BSC network
  const switchToBSC = async (): Promise<void> => {
    if (!isBrowser || !window.ethereum) throw new Error('MetaMask not installed')

    const chainIdHex = '0x' + BSC_CONFIG.chainId.toString(16)

    try {
      // Try to switch to BSC network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: chainIdHex,
                chainName: BSC_CONFIG.chainName,
                nativeCurrency: BSC_CONFIG.nativeCurrency,
                rpcUrls: BSC_CONFIG.rpcUrls,
                blockExplorerUrls: BSC_CONFIG.blockExplorerUrls,
              },
            ],
          })
        } catch (addError) {
          throw new Error('Failed to add BSC network to MetaMask')
        }
      } else {
        throw switchError
      }
    }
  }

  // Update balance
  const updateBalance = async (): Promise<void> => {
    if (!isConnected.value || !account.value) return

    try {
      if (!publicClient) {
        publicClient = createPublicClient({
          chain: bsc,
          transport: http(BSC_CONFIG.rpcUrls[0]),
        })
      }

      // Get BNB balance
      const bal = await publicClient.getBalance({
        address: account.value as Address,
      })
      balance.value = formatEther(bal)

      // Get ERC-20 token balance if token address is configured
      if (BSC_TOKEN_ADDRESS && BSC_TOKEN_ADDRESS !== '0x0000000000000000000000000000000000000000') {
        try {
          const tokenBal = await publicClient.readContract({
            address: BSC_TOKEN_ADDRESS as Address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [account.value as Address],
          }) as bigint

          const decimals = await publicClient.readContract({
            address: BSC_TOKEN_ADDRESS as Address,
            abi: ERC20_ABI,
            functionName: 'decimals',
          }) as number

          tokenBalance.value = formatUnits(tokenBal, decimals)
        } catch (tokenError) {
          console.error('Error fetching token balance:', tokenError)
          tokenBalance.value = '0'
        }
      }
    } catch (error) {
      console.error('Error updating balance:', error)
    }
  }

  // Connect wallet
  const connect = async (): Promise<void> => {
    if (!isBrowser || !isMetaMaskInstalled()) {
      throw new Error('MetaMask is not installed. Please install MetaMask to use this bridge.')
    }

    try {
      // Request account access
      const accounts = await window.ethereum!.request({
        method: 'eth_requestAccounts',
      })

      if (accounts.length === 0) {
        throw new Error('No accounts found')
      }

      account.value = accounts[0]

      // Get current chain ID
      const currentChainId = await window.ethereum!.request({
        method: 'eth_chainId',
      })
      chainId.value = currentChainId

      // Check if on BSC network
      const bscChainIdHex = '0x' + BSC_CONFIG.chainId.toString(16)
      isCorrectNetwork.value = currentChainId === bscChainIdHex

      // Switch to BSC if not already on it
      if (!isCorrectNetwork.value) {
        await switchToBSC()
        isCorrectNetwork.value = true
      }

      // Create clients
      walletClient = createWalletClient({
        chain: bsc,
        transport: custom(window.ethereum!),
      })

      publicClient = createPublicClient({
        chain: bsc,
        transport: http(BSC_CONFIG.rpcUrls[0]),
      })

      isConnected.value = true

      // Update balance
      await updateBalance()

      // Setup event listeners
      setupEventListeners()
    } catch (error: any) {
      console.error('Error connecting to MetaMask:', error)
      throw new Error(error.message || 'Failed to connect to MetaMask')
    }
  }

  // Disconnect wallet
  const disconnect = (): void => {
    isConnected.value = false
    account.value = ''
    chainId.value = ''
    balance.value = '0'
    tokenBalance.value = '0'
    isCorrectNetwork.value = false

    // Remove event listeners
    if (isBrowser && window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum.removeListener('chainChanged', handleChainChanged)
    }
  }

  // Event handlers
  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnect()
    } else if (accounts[0] !== account.value) {
      account.value = accounts[0]
      updateBalance()
    }
  }

  const handleChainChanged = (newChainId: string) => {
    chainId.value = newChainId
    const bscChainIdHex = '0x' + BSC_CONFIG.chainId.toString(16)
    isCorrectNetwork.value = newChainId === bscChainIdHex

    if (isCorrectNetwork.value) {
      updateBalance()
    }
  }

  // Setup event listeners
  const setupEventListeners = (): void => {
    if (!isBrowser || !window.ethereum) return

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)
  }

  // Get wallet state
  const getWalletState = (): WalletState => {
    return {
      isConnected: isConnected.value,
      address: account.value,
      balance: balance.value,
      chainId: chainId.value,
    }
  }

  return {
    // State
    isConnected,
    account,
    chainId,
    balance,
    tokenBalance,
    isCorrectNetwork,

    // Actions
    connect,
    disconnect,
    switchToBSC,
    updateBalance,
    isMetaMaskInstalled,
    getWalletState,
  }
})
