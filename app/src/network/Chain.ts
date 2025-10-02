import type { Coin } from '@cosmjs/stargate'
import { JUNO_TESTNET_CONFIG, JUNO_TESTNET_HUB_INFO } from './cosmos/config/juno'
import {
  KUJIRA_MAINNET_CONFIG,
  KUJIRA_MAINNET_HUB_INFO,
  KUJIRA_TESTNET_CONFIG,
  KUJIRA_TESTNET_HUB_INFO,
} from './cosmos/config/kujira'
import { NEUTRON_CONFIG, NEUTRON_HUB_INFO } from './cosmos/config/neutron'
import { DEV_CONFIG, DEV_HUB_INFO } from './cosmos/config/dev'
import { TERRA_CONFIG, TERRA_HUB_INFO } from './cosmos/config/terra'
import { MANTRA_CONFIG, MANTRA_HUB_INFO } from './cosmos/config/mantra'
import { COSMOSHUB_CONFIG, COSMOSHUB_HUB_INFO } from './cosmos/config/cosmoshub'
import { BSC_MAINNET_CONFIG, BSC_MAINNET_HUB_INFO, BSC_TESTNET_CONFIG, BSC_TESTNET_HUB_INFO } from './evm/config/bsc'
import type {
  Addr,
  Arbitrator,
  Denom,
  DenomFiatPrice,
  FetchOffersArgs,
  FiatCurrency,
  HubConfig,
  NewTrade,
  OfferResponse,
  PatchOffer,
  PostOffer,
  Profile,
  TradeInfo,
} from '~/types/components.interface'
import { CosmosChain } from '~/network/cosmos/CosmosChain'
import { EVMChain } from '~/network/evm/EVMChain'

export interface Chain {
  init(): void

  getName(): string

  getChainType(): string

  connectWallet(walletType?: any): Promise<void>

  disconnectWallet(): Promise<void>

  getHubConfig(): HubConfig

  getWalletAddress(): string

  fetchProfile(profile_addr?: Addr): Promise<Profile>

  fetchTokenBalance(denom: Denom): Promise<Coin>

  fetchOffer(offerId: string): Promise<OfferResponse>

  fetchAllOffers(limit: number, last?: number): Promise<OfferResponse[]>

  fetchOffers(args: FetchOffersArgs, limit: number, last?: number): Promise<OfferResponse[]>

  fetchMakerOffers(maker: Addr): Promise<OfferResponse[]>

  fetchMyOffers(limit: number, last?: number): Promise<OfferResponse[]>
  
  fetchOffersCountByStates(states: string[]): Promise<number>
  
  fetchAllFiatsOffersCount(states: string[]): Promise<Array<{ fiat: string; count: number }>>

  createOffer(postOffer: PostOffer): Promise<number>

  updateOffer(updateOffer: PatchOffer): Promise<void>

  openTrade(trade: NewTrade): Promise<number>

  fetchTrades(limit: number, last?: number): Promise<TradeInfo[]>
  
  fetchTradesCountByStates(states: string[]): Promise<number>
  
  fetchAllFiatsTradesCount(states: string[]): Promise<Array<{ fiat: string; count: number }>>

  fetchDisputedTrades(limit: number, last?: number): Promise<{ openDisputes: TradeInfo[]; closedDisputes: TradeInfo[] }>

  fetchTradeDetail(tradeId: number): Promise<TradeInfo>

  fetchArbitrators(): Promise<Arbitrator[]>

  updateFiatPrice(fiat: FiatCurrency, denom: Denom): Promise<DenomFiatPrice>
  
  batchUpdateFiatPrices(fiats: FiatCurrency[], denom: Denom): Promise<DenomFiatPrice[]>

  fetchFiatToUsdRate(fiat: FiatCurrency): Promise<number>
  
  /**
   * Format raw fiat price from the chain's price oracle to a standardized format
   * @param rawPrice The raw price value from the chain (string for EVM, number for Cosmos)
   * @returns Number of fiat units per 1 USD as a decimal value
   * Example: Returns 4051.88 for COP (meaning 1 USD = 4051.88 COP)
   */
  formatFiatPrice(rawPrice: string | number): number

  acceptTradeRequest(tradeId: number, makerContact: string): Promise<void>

  cancelTradeRequest(tradeId: number): Promise<void>

  fundEscrow(tradeInfo: TradeInfo, maker_contact?: string): Promise<void>

  setFiatDeposited(tradeId: number): Promise<void>

  releaseEscrow(tradeId: number): Promise<void>

  refundEscrow(tradeId: number): Promise<void>

  openDispute(tradeId: number, buyerContact: string, sellerContact: string): Promise<void>

  settleDispute(tradeId: number, winner: string): Promise<void>

  newArbitrator(arbitrator: Arbitrator): Promise<void>
}

export enum ChainClient {
  kujiraTestnet = 'KUJIRA_TESTNET',
  kujiraMainnet = 'KUJIRA_MAINNET',
  juno = 'JUNO',
  dev = 'DEV',
  terra = 'TERRA',
  neutron = 'NEUTRON',
  mantra = 'MANTRA',
  cosmoshub = 'COSMOSHUB',
  bscMainnet = 'BSC_MAINNET',
  bscTestnet = 'BSC_TESTNET',
}

// Centralized place to instantiate chain client and inject dependencies if needed
export function chainFactory(client: ChainClient): Chain {
  switch (client) {
    case ChainClient.kujiraTestnet:
      return new CosmosChain(KUJIRA_TESTNET_CONFIG, KUJIRA_TESTNET_HUB_INFO)
    case ChainClient.kujiraMainnet:
      return new CosmosChain(KUJIRA_MAINNET_CONFIG, KUJIRA_MAINNET_HUB_INFO)
    case ChainClient.juno:
      return new CosmosChain(JUNO_TESTNET_CONFIG, JUNO_TESTNET_HUB_INFO)
    case ChainClient.neutron:
      return new CosmosChain(NEUTRON_CONFIG, NEUTRON_HUB_INFO)
    case ChainClient.dev:
      return new CosmosChain(DEV_CONFIG, DEV_HUB_INFO)
    case ChainClient.terra:
      return new CosmosChain(TERRA_CONFIG, TERRA_HUB_INFO)
    case ChainClient.mantra:
      return new CosmosChain(MANTRA_CONFIG, MANTRA_HUB_INFO)
    case ChainClient.cosmoshub:
      return new CosmosChain(COSMOSHUB_CONFIG, COSMOSHUB_HUB_INFO)
    case ChainClient.bscMainnet:
      return new EVMChain(BSC_MAINNET_CONFIG, BSC_MAINNET_HUB_INFO)
    case ChainClient.bscTestnet:
      return new EVMChain(BSC_TESTNET_CONFIG, BSC_TESTNET_HUB_INFO)
  }
}
