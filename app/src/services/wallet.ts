export enum WalletProvider {
  KEPLR = 'keplr',
  METAMASK = 'metamask',
  PHANTOM = 'phantom', // Phantom EVM mode
  PHANTOM_SOLANA = 'phantom_solana', // Phantom Solana mode
}

export enum ChainType {
  COSMOS = 'cosmos',
  EVM = 'evm',
  SOLANA = 'solana',
}

export interface WalletInfo {
  provider: WalletProvider
  chainType: ChainType
  address: string
  isConnected: boolean
}

export class WalletService {
  static detectAvailableWallets(): WalletProvider[] {
    const wallets: WalletProvider[] = []

    // Guard for SSR - window is not defined on server
    if (typeof window === 'undefined') {
      return wallets
    }

    // Check for Keplr
    if (window.keplr) {
      wallets.push(WalletProvider.KEPLR)
    }

    // Check for MetaMask
    if (window.ethereum?.isMetaMask) {
      wallets.push(WalletProvider.METAMASK)
    }

    // Check for Phantom (EVM mode)
    if (window.phantom?.ethereum) {
      wallets.push(WalletProvider.PHANTOM)
    }

    // Check for Phantom (Solana mode)
    if (window.phantom?.solana?.isPhantom) {
      wallets.push(WalletProvider.PHANTOM_SOLANA)
    }

    return wallets
  }

  static getChainTypeForWallet(provider: WalletProvider): ChainType {
    switch (provider) {
      case WalletProvider.KEPLR:
        return ChainType.COSMOS
      case WalletProvider.METAMASK:
      case WalletProvider.PHANTOM:
        return ChainType.EVM
      case WalletProvider.PHANTOM_SOLANA:
        return ChainType.SOLANA
      default:
        throw new Error(`Unknown wallet provider: ${provider}`)
    }
  }

  static isWalletCompatibleWithChain(provider: WalletProvider, chainType: ChainType): boolean {
    const walletChainType = this.getChainTypeForWallet(provider)
    return walletChainType === chainType
  }

  static getWalletDisplayName(provider: WalletProvider): string {
    switch (provider) {
      case WalletProvider.KEPLR:
        return 'Keplr'
      case WalletProvider.METAMASK:
        return 'MetaMask'
      case WalletProvider.PHANTOM:
        return 'Phantom (EVM)'
      case WalletProvider.PHANTOM_SOLANA:
        return 'Phantom'
      default:
        return 'Unknown Wallet'
    }
  }

  static getWalletIcon(provider: WalletProvider): string {
    switch (provider) {
      case WalletProvider.KEPLR:
        return '🌌'
      case WalletProvider.METAMASK:
        return '🦊'
      case WalletProvider.PHANTOM:
      case WalletProvider.PHANTOM_SOLANA:
        return '👻'
      default:
        return '💰'
    }
  }

  /**
   * Get wallets compatible with a specific chain type
   */
  static getWalletsForChainType(chainType: ChainType): WalletProvider[] {
    const availableWallets = this.detectAvailableWallets()
    return availableWallets.filter((wallet) => this.isWalletCompatibleWithChain(wallet, chainType))
  }

  /**
   * Check if Solana wallet is available
   */
  static isSolanaWalletAvailable(): boolean {
    return this.detectAvailableWallets().includes(WalletProvider.PHANTOM_SOLANA)
  }
}