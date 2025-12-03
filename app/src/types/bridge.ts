export interface BridgeTransaction {
  id: string
  amount: string
  bscRecipient: string
  kujiraAddress: string
  kujiraTxHash?: string
  bscTxHash?: string
  status: TransactionStatus
  timestamp: number
  errorMessage?: string
}

export enum TransactionStatus {
  Pending = 'pending',
  Burning = 'burning',
  WaitingForConfirmation = 'waiting_for_confirmation',
  Completed = 'completed',
  Failed = 'failed',
}

export interface WalletState {
  isConnected: boolean
  address: string
  balance: string
  chainId: string
}

export interface KujiraConfig {
  chainId: string
  chainName: string
  rpc: string
  rest: string
  bech32Prefix: string
  coinDenom: string
  coinMinimalDenom: string
  coinDecimals: number
}

export interface BSCConfig {
  chainId: number
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls: string[]
}
