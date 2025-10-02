export enum WalletProvider {
  KEPLR = 'keplr',
  METAMASK = 'metamask',
  PHANTOM = 'phantom',
}

export enum ChainType {
  COSMOS = 'cosmos',
  EVM = 'evm',
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
    
    return wallets
  }

  static getChainTypeForWallet(provider: WalletProvider): ChainType {
    switch (provider) {
      case WalletProvider.KEPLR:
        return ChainType.COSMOS
      case WalletProvider.METAMASK:
      case WalletProvider.PHANTOM:
        return ChainType.EVM
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
        return '👻'
      default:
        return '💰'
    }
  }
}