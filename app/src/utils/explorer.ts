import { ChainClient, chainFactory } from '~/network/Chain'
import type { EVMChain } from '~/network/evm/EVMChain'

export function getExplorerUrl(chainClient: ChainClient, address: string): string {
  // Check if this is an EVM chain
  const evmChains = [ChainClient.bscMainnet, ChainClient.bscTestnet]
  if (evmChains.includes(chainClient)) {
    // Get the chain instance to access the config
    const chain = chainFactory(chainClient) as EVMChain
    return `${chain.config.blockExplorerUrl}/address/${address}`
  }
  
  // Handle Cosmos chains
  switch (chainClient) {
    case ChainClient.kujiraMainnet:
      return `https://finder.kujira.app/kaiyo-1/address/${address}`
    case ChainClient.kujiraTestnet:
      return `https://finder.kujira.app/harpoon-4/address/${address}`
    case ChainClient.juno:
      return `https://www.mintscan.io/juno/address/${address}`
    case ChainClient.terra:
      return `https://finder.terra.money/mainnet/address/${address}`
    case ChainClient.neutron:
      return `https://www.mintscan.io/neutron/address/${address}`
    case ChainClient.mantra:
      return `https://explorer.mantrachain.io/mantra-dukong/account/${address}`
    case ChainClient.cosmoshub:
      return `https://www.mintscan.io/cosmos/address/${address}`
    case ChainClient.dev:
      // For dev environment, default to Kujira testnet explorer
      return `https://finder.kujira.app/harpoon-4/address/${address}`
    default:
      // Fallback to Kujira mainnet explorer
      return `https://finder.kujira.app/kaiyo-1/address/${address}`
  }
}