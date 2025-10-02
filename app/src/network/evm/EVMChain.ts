import { 
  createPublicClient, 
  createWalletClient, 
  custom, 
  http, 
  type Address, 
  type Hash, 
  parseEther, 
  formatEther,
  parseUnits,
  formatUnits,
  encodeAbiParameters,
  decodeAbiResult,
  type Hex,
  ContractFunctionRevertedError,
} from 'viem'
import { bsc, bscTestnet } from 'viem/chains'
import type { Coin } from '@cosmjs/stargate'
import type { Chain } from '~/network/Chain'
import { DefaultError, WalletNotConnected, WalletNotInstalled } from '~/network/chain-error'
import { sanitizeTokenSymbol, sanitizeNumber } from '~/utils/sanitize'
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
  OfferState,
  OfferType,
  TradeState,
} from '~/types/components.interface'
import { denomToValue } from '~/utils/denom'
import { 
  HubABI, 
  ProfileABI, 
  OfferABI, 
  TradeABI, 
  PriceOracleABI, 
  EscrowABI, 
  ArbitratorManagerABI,
  ERC20ABI,
} from './abi'

// Constants for chain detection and calculations
const EVM_CHAINS = ['BSC', 'ETH', 'POLYGON'] as const
type EVMChainType = typeof EVM_CHAINS[number]

// Basis points constant for fee calculations
// 1 basis point = 0.01%, so 10000 basis points = 100%
const BASIS_POINTS = 10000n
import { TOKEN_ADDRESSES } from './tokenAddresses'

export interface EVMConfig {
  chainId: number
  chainName: string
  chainShortName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrl: string
  blockExplorerUrl: string
  blockExplorerName: string
}

export interface EVMHubInfo {
  hubAddress: string
  profileAddress: string
  offerAddress: string
  tradeAddress: string
  escrowAddress: string
  priceOracleAddress: string
  arbitratorManagerAddress?: string
  hubConfig: HubConfig
  additionalConfig?: any // Store additional config from Hub
}

export enum WalletType {
  METAMASK = 'metamask',
  PHANTOM = 'phantom',
}

interface MetaMaskProvider {
  isMetaMask?: boolean
  request: (args: { method: string; params?: any[] }) => Promise<any>
  on: (event: string, handler: (...args: any[]) => void) => void
  removeListener: (event: string, handler: (...args: any[]) => void) => void
}

interface PhantomProvider {
  isPhantom?: boolean
  ethereum?: {
    isPhantom?: boolean
    request: (args: { method: string; params?: any[] }) => Promise<any>
    on: (event: string, handler: (...args: any[]) => void) => void
    removeListener: (event: string, handler: (...args: any[]) => void) => void
  }
}

declare global {
  interface Window {
    ethereum?: MetaMaskProvider
    phantom?: PhantomProvider
  }
}

// Helper functions to map between contract and app types
function mapOfferState(state: number): OfferState {
  const stateMap = {
    0: 'active' as OfferState,
    1: 'paused' as OfferState,
    2: 'archive' as OfferState,  // Note: app uses 'archive' not 'archived'
  }
  return stateMap[state] || 'paused'
}

function mapOfferType(type: number): OfferType {
  return type === 0 ? 'buy' : 'sell'
}

function mapTradeState(state: number): TradeState {
  const stateMap = {
    0: 'request_created' as TradeState,    // RequestCreated
    1: 'request_accepted' as TradeState,   // RequestAccepted
    2: 'escrow_funded' as TradeState,      // EscrowFunded
    3: 'fiat_deposited' as TradeState,     // FiatDeposited
    4: 'escrow_released' as TradeState,    // EscrowReleased
    5: 'escrow_cancelled' as TradeState,   // EscrowCancelled
    6: 'escrow_refunded' as TradeState,    // EscrowRefunded
    7: 'escrow_disputed' as TradeState,    // EscrowDisputed
    8: 'settled_for_maker' as TradeState,  // DisputeResolved - will need additional logic to determine winner
  }
  return stateMap[state] || 'request_cancelled'
}

export class EVMChain implements Chain {
  public config: EVMConfig
  protected hubInfo: EVMHubInfo
  protected walletType?: WalletType
  protected account?: Address
  protected publicClient?: any
  protected walletClient?: any

  constructor(config: EVMConfig, hubInfo: EVMHubInfo) {
    this.config = config
    this.hubInfo = hubInfo
  }

  private isFiatPriceNotFoundError(error: any): boolean {
    return error instanceof ContractFunctionRevertedError ||
           error?.name === 'ContractFunctionRevertedError' ||
           error?.message?.includes('FiatPriceNotFound') || 
           error?.message?.includes('0x4a1e0a41') || 
           error?.message?.includes('0x8686a196') ||
           error?.message?.includes('revert') ||
           error?.data?.errorName === 'FiatPriceNotFound'
  }

  private getChainNativeToken(): string {
    // Map chain ID to native token symbol
    switch (this.config.chainId) {
      case 56:     // BSC Mainnet
      case 97:     // BSC Testnet
        return 'BNB'
      case 1:      // Ethereum Mainnet
      case 5:      // Goerli
      case 11155111: // Sepolia
        return 'ETH'
      case 137:    // Polygon Mainnet
      case 80001:  // Mumbai
        return 'MATIC'
      default:
        return 'ETH' // Default fallback
    }
  }

  private isEVMChain(chainType: string): boolean {
    return EVM_CHAINS.includes(chainType as EVMChainType)
  }

  async init() {
    const chain = this.config.chainId === 56 ? bsc : bscTestnet
    this.publicClient = createPublicClient({
      chain,
      transport: http(this.config.rpcUrl),
    })

    // Try to fetch hub configuration from contract
    // If the contract is not initialized, use the provided addresses
    try {
      console.log('Fetching Hub config from:', this.hubInfo.hubAddress)
      
      const config = await this.publicClient.readContract({
        address: this.hubInfo.hubAddress as Address,
        abi: HubABI,
        functionName: 'getConfig',
      })

      console.log('Hub config received:', config)

      // Update hubConfig and hubInfo addresses with actual contract values
      if (config) {
        // Convert fee values from contract (basis points) to decimal
        const burnFeePct = Number(config.burnFeePct || 0) / 10000
        const chainFeePct = Number(config.chainFeePct || 0) / 10000
        const warchestFeePct = Number(config.warchestFeePct || 0) / 10000
        const arbitrationFeePct = Number(config.arbitratorFeePct || 0) / 10000
        
        // Update the hubInfo addresses with fetched values
        this.hubInfo.profileAddress = config.profileContract
        this.hubInfo.offerAddress = config.offerContract
        this.hubInfo.tradeAddress = config.tradeContract
        this.hubInfo.priceOracleAddress = config.priceContract
        // Escrow and ArbitratorManager addresses remain from env config
        
        this.hubInfo.hubConfig = {
          ...this.hubInfo.hubConfig,
          profile_addr: config.profileContract,
          offer_addr: config.offerContract,
          trade_addr: config.tradeContract,
          escrow_addr: this.hubInfo.escrowAddress, // Use the address from env config since Hub doesn't have escrow
          price_addr: config.priceContract,
          price_oracle_addr: config.priceContract,
          price_provider_addr: config.priceProvider || '',
          local_market_addr: config.localMarket,
          chain_fee_collector_addr: config.chainFeeCollector || '',
          warchest_addr: config.treasury || '',
          arbitration_fee_pct: arbitrationFeePct,
          burn_fee_pct: burnFeePct,
          chain_fee_pct: chainFeePct,
          warchest_fee_pct: warchestFeePct,
          active_offers_limit: Number(config.maxActiveOffers || 100),
          active_trades_limit: Number(config.maxActiveTrades || 100),
          trade_expiration_timer: Number(config.tradeExpirationTimer || 86400),
          platform_fee: Number(config.burnFeePct || 0) + Number(config.chainFeePct || 0) + Number(config.warchestFeePct || 0), // Sum of fees in basis points
          platform_fee_recipient: config.treasury,
        }

        // Store additional config for later use
        this.hubInfo.additionalConfig = {
          priceProvider: config.priceProvider,
          localTokenAddress: config.localTokenAddress,
          chainFeeCollector: config.chainFeeCollector,
          swapRouter: config.swapRouter,
          fees: {
            burnFeePct: Number(config.burnFeePct || 0),
            chainFeePct: Number(config.chainFeePct || 0),
            warchestFeePct: Number(config.warchestFeePct || 0),
            conversionFeePct: Number(config.conversionFeePct || 0),
            arbitratorFeePct: Number(config.arbitratorFeePct || 0),
          },
          limits: {
            minTradeAmount: config.minTradeAmount?.toString() || '0',
            maxTradeAmount: config.maxTradeAmount?.toString() || '0',
            maxActiveOffers: config.maxActiveOffers?.toString() || '100',
            maxActiveTrades: config.maxActiveTrades?.toString() || '100',
          },
          timers: {
            tradeExpirationTimer: config.tradeExpirationTimer?.toString() || '86400',
            tradeDisputeTimer: config.tradeDisputeTimer?.toString() || '86400',
          },
          paused: {
            globalPause: config.globalPause || false,
            pauseNewTrades: config.pauseNewTrades || false,
            pauseDeposits: config.pauseDeposits || false,
            pauseWithdrawals: config.pauseWithdrawals || false,
          },
        }

        console.log('Hub config loaded from contract')
      }
    } catch (error: any) {
      // Check if it's a revert error (contract not initialized)
      if (error?.message?.includes('reverted') || error?.message?.includes('0x')) {
        console.error('Hub contract not initialized or configuration not available')
        // Cannot proceed without Hub config since we don't have contract addresses
        throw new Error('Failed to fetch Hub configuration. Please ensure the Hub contract is properly deployed and initialized.')
      } else {
        console.error('Failed to fetch hub config:', error)
        throw new Error('Failed to fetch Hub configuration: ' + error?.message)
      }
    }
  }

  getName() {
    return this.config.chainName
  }

  getChainType() {
    return 'evm'
  }

  private getProvider(): MetaMaskProvider | undefined {
    if (this.walletType === WalletType.METAMASK && window.ethereum?.isMetaMask) {
      return window.ethereum
    }
    if (this.walletType === WalletType.PHANTOM && window.phantom?.ethereum) {
      return window.phantom.ethereum as MetaMaskProvider
    }
    return undefined
  }

  async connectWallet(walletType: WalletType = WalletType.METAMASK) {
    this.walletType = walletType
    const provider = this.getProvider()
    
    if (!provider) {
      throw new WalletNotInstalled()
    }

    try {
      // Request account access
      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      
      if (accounts.length === 0) {
        throw new WalletNotConnected()
      }

      this.account = accounts[0] as Address
      
      // Switch to the correct chain
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${this.config.chainId.toString(16)}` }],
        })
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${this.config.chainId.toString(16)}`,
                chainName: this.config.chainName,
                nativeCurrency: this.config.nativeCurrency,
                rpcUrls: [this.config.rpcUrl],
                blockExplorerUrls: [this.config.blockExplorerUrl],
              },
            ],
          })
        } else {
          throw switchError
        }
      }

      // Create wallet client
      const chain = this.config.chainId === 56 ? bsc : bscTestnet
      this.walletClient = createWalletClient({
        account: this.account,
        chain,
        transport: custom(provider),
      })

      // Set up event listeners
      provider.on('accountsChanged', this.handleAccountsChanged.bind(this))
      provider.on('chainChanged', this.handleChainChanged.bind(this))
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  private handleAccountsChanged(accounts: string[]) {
    if (accounts.length === 0) {
      this.disconnectWallet()
    } else {
      this.account = accounts[0] as Address
    }
  }

  private handleChainChanged(chainId: string) {
    // Reload the page to reset the state
    window.location.reload()
  }

  async disconnectWallet() {
    const provider = this.getProvider()
    if (provider) {
      provider.removeListener('accountsChanged', this.handleAccountsChanged.bind(this))
      provider.removeListener('chainChanged', this.handleChainChanged.bind(this))
    }
    this.account = undefined
    this.walletClient = undefined
    this.walletType = undefined
  }

  getHubConfig(): HubConfig {
    return this.hubInfo.hubConfig
  }

  getWalletAddress(): string {
    return this.account || 'undefined'
  }

  async fetchProfile(profile_addr?: Addr): Promise<Profile> {
    if (!this.publicClient) {
      await this.init()
    }
    
    // Ensure we have the profile address from Hub config
    if (!this.hubInfo.profileAddress) {
      throw new Error('Profile address not available. Hub config may not be loaded.')
    }

    const address = profile_addr || this.getWalletAddress()
    if (address === 'undefined') {
      throw new WalletNotConnected()
    }

    try {
      const result = await this.publicClient!.readContract({
        address: this.hubInfo.profileAddress as Address,
        abi: ProfileABI,
        functionName: 'getProfile',
        args: [address as Address],
      })

      return {
        addr: result.owner,
        contact: result.contact,
        encryption_key: result.encryptionKey ? Array.from(result.encryptionKey as Uint8Array) : null,
      }
    } catch (error) {
      // Profile doesn't exist, return empty profile
      return {
        addr: address,
        contact: '',
        encryption_key: null,
      }
    }
  }

  async fetchTokenBalance(denom: Denom): Promise<Coin> {
    if (!this.account || !this.publicClient) {
      throw new WalletNotConnected()
    }

    try {
      // For native token
      if (denom.native === 'BNB' || denom.native === 'tBNB') {
        const balance = await this.publicClient.getBalance({
          address: this.account,
        })
        return {
          denom: denom.native,
          amount: balance.toString(),
        }
      }

      // For ERC20 tokens
      const tokenAddresses = this.config.chainId === 56 ? TOKEN_ADDRESSES.BSC_MAINNET : TOKEN_ADDRESSES.BSC_TESTNET
      const tokenAddress = tokenAddresses[denom.native as keyof typeof tokenAddresses]

      if (tokenAddress) {
        const balance = await this.publicClient.readContract({
          address: tokenAddress as Address,
          abi: ERC20ABI,
          functionName: 'balanceOf',
          args: [this.account],
        })

        return {
          denom: denom.native,
          amount: balance.toString(),
        }
      }

      return {
        denom: denom.native || '',
        amount: '0',
      }
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async fetchOffer(offerId: string): Promise<OfferResponse> {
    if (!this.publicClient) {
      await this.init()
    }
    
    // Ensure we have the offer address from Hub config
    if (!this.hubInfo.offerAddress) {
      throw new Error('Offer address not available. Hub config may not be loaded.')
    }

    try {
      const result = await this.publicClient.readContract({
        address: this.hubInfo.offerAddress as Address,
        abi: OfferABI,
        functionName: 'getOffer',
        args: [BigInt(offerId)],
      })

      // Convert amounts from wei (1e18) to micro-units (1e6) for frontend compatibility
      const minAmountInMicroUnits = result.minAmount / BigInt(1e12)
      const maxAmountInMicroUnits = result.maxAmount / BigInt(1e12)

      const offer = {
        id: Number(result.id),
        owner: result.owner,
        offer_type: mapOfferType(result.offerType),
        fiat_currency: result.fiatCurrency as FiatCurrency,
        rate: result.rate.toString(),
        min_amount: minAmountInMicroUnits.toString(),
        max_amount: maxAmountInMicroUnits.toString(),
        state: mapOfferState(result.state),
        denom: result.tokenAddress === '0x0000000000000000000000000000000000000000'
          ? { native: 'bnb' }
          : { native: this.mapTokenAddressToDenom(result.tokenAddress) },
        description: result.description,
        timestamp: Number(result.createdAt),
      }

      // EVM profiles may not exist; return minimal/null profile if unavailable
      const profile = null

      return { offer, profile } as unknown as OfferResponse
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async fetchAllOffers(limit: number, last?: number): Promise<OfferResponse[]> {
    if (!this.publicClient) {
      try {
        await this.init()
      } catch (error) {
        console.error('Failed to initialize EVMChain:', error)
        return []
      }
    }
    
    // Ensure we have the offer address from Hub config
    if (!this.hubInfo.offerAddress) {
      console.debug('Offer address not available. Hub config may not be loaded yet.')
      return []
    }

    try {
      // First get the array of offer IDs
      const offerIds = await this.publicClient.readContract({
        address: this.hubInfo.offerAddress as Address,
        abi: OfferABI,
        functionName: 'getAllActiveOffers',
      }) as bigint[]

      console.log('[EVMChain.fetchAllOffers] Active offer IDs:', offerIds.map(id => id.toString()))

      // Apply pagination to IDs
      const startIndex = last || 0
      const paginatedIds = offerIds.slice(startIndex, startIndex + limit)

      // Fetch details for each offer ID
      const offerPromises = paginatedIds.map(async (offerId) => {
        try {
          const offerData = await this.publicClient.readContract({
            address: this.hubInfo.offerAddress as Address,
            abi: OfferABI,
            functionName: 'getOffer',
            args: [offerId],
          }) as any

          // Convert amounts from wei (1e18) to micro-units (1e6) for frontend compatibility
          // Frontend expects amounts in micro-units like Cosmos chains (e.g., uatom)
          const minAmountInMicroUnits = offerData.minAmount / BigInt(1e12) // wei to micro-units
          const maxAmountInMicroUnits = offerData.maxAmount / BigInt(1e12) // wei to micro-units

          console.log(`[EVMChain.fetchAllOffers] Offer ${offerId} data:`, {
            id: offerData.id?.toString(),
            state: offerData.state,
            offerType: offerData.offerType,
            fiatCurrency: offerData.fiatCurrency,
            tokenAddress: offerData.tokenAddress,
            minAmountWei: offerData.minAmount.toString(),
            maxAmountWei: offerData.maxAmount.toString(),
            minAmountMicro: minAmountInMicroUnits.toString(),
            maxAmountMicro: maxAmountInMicroUnits.toString(),
          })

          return {
            offer: {
              id: offerData.id.toString(),
              owner: offerData.owner,
              offer_type: mapOfferType(offerData.offerType),
              fiat_currency: offerData.fiatCurrency as FiatCurrency,
              rate: offerData.rate.toString(),
              min_amount: minAmountInMicroUnits.toString(),
              max_amount: maxAmountInMicroUnits.toString(),
              state: mapOfferState(offerData.state),
              denom: offerData.tokenAddress === '0x0000000000000000000000000000000000000000' 
                ? { native: 'bnb' } 
                : { native: this.mapTokenAddressToDenom(offerData.tokenAddress) },
              description: offerData.description,
              timestamp: offerData.createdAt.toString(),
            },
            profile: null, // Profile needs to be fetched separately if needed
          } as OfferResponse
        } catch (error) {
          console.error(`Failed to fetch offer ${offerId}:`, error)
          return null
        }
      })

      const offers = await Promise.all(offerPromises)
      return offers.filter((o): o is OfferResponse => o !== null)
    } catch (error) {
      console.error('Failed to fetch offers:', error)
      return []
    }
  }

  async fetchOffers(args: FetchOffersArgs, limit: number, last?: number): Promise<OfferResponse[]> {
    const allOffers = await this.fetchAllOffers(limit * 10, 0) // Fetch more to filter
    console.log('[EVMChain.fetchOffers] Total offers fetched:', allOffers.length)
    console.log('[EVMChain.fetchOffers] Filter args:', args)
    
    // Apply filters
    let filtered = allOffers

    if (args.offerType) {
      const beforeFilter = filtered.length
      filtered = filtered.filter(o => o.offer.offer_type === args.offerType)
      console.log(`[EVMChain.fetchOffers] After offerType filter (${args.offerType}): ${beforeFilter} -> ${filtered.length}`)
    }

    if (args.fiatCurrency) {
      const beforeFilter = filtered.length
      filtered = filtered.filter(o => o.offer.fiat_currency === args.fiatCurrency)
      console.log(`[EVMChain.fetchOffers] After fiatCurrency filter (${args.fiatCurrency}): ${beforeFilter} -> ${filtered.length}`)
    }

    if (args.denom) {
      const beforeFilter = filtered.length
      const denomStr = denomToValue(args.denom).toLowerCase()
      filtered = filtered.filter(o => {
        const offerDenomStr = denomToValue(o.offer.denom).toLowerCase()
        return offerDenomStr === denomStr
      })
      console.log(`[EVMChain.fetchOffers] After denom filter (${denomStr}): ${beforeFilter} -> ${filtered.length}`)
    }

    // Apply pagination
    const startIndex = last || 0
    const result = filtered.slice(startIndex, startIndex + limit)
    console.log(`[EVMChain.fetchOffers] Returning ${result.length} offers after pagination`)
    return result
  }

  async fetchMakerOffers(maker: Addr): Promise<OfferResponse[]> {
    if (!this.publicClient) {
      try {
        await this.init()
      } catch (error) {
        console.error('Failed to initialize EVMChain:', error)
        return []
      }
    }
    
    // Ensure we have the offer address from Hub config
    if (!this.hubInfo.offerAddress) {
      console.debug('Offer address not available. Hub config may not be loaded yet.')
      return []
    }

    try {
      // First get the array of offer IDs
      const offerIds = await this.publicClient.readContract({
        address: this.hubInfo.offerAddress as Address,
        abi: OfferABI,
        functionName: 'getOffersByOwner',
        args: [maker as Address],
      }) as bigint[]

      // Fetch details for each offer ID
      const offerPromises = offerIds.map(async (offerId) => {
        try {
          const offerData = await this.publicClient.readContract({
            address: this.hubInfo.offerAddress as Address,
            abi: OfferABI,
            functionName: 'getOffer',
            args: [offerId],
          }) as any

          // Convert amounts from wei (1e18) to micro-units (1e6) for frontend compatibility
          const minAmountInMicroUnits = offerData.minAmount / BigInt(1e12)
          const maxAmountInMicroUnits = offerData.maxAmount / BigInt(1e12)

          return {
            offer: {
              id: offerData.id.toString(),
              owner: offerData.owner,
              offer_type: mapOfferType(offerData.offerType),
              fiat_currency: offerData.fiatCurrency as FiatCurrency,
              rate: offerData.rate.toString(),
              min_amount: minAmountInMicroUnits.toString(),
              max_amount: maxAmountInMicroUnits.toString(),
              state: mapOfferState(offerData.state),
              denom: offerData.tokenAddress === '0x0000000000000000000000000000000000000000' 
                ? { native: 'bnb' } 
                : { native: this.mapTokenAddressToDenom(offerData.tokenAddress) },
              description: offerData.description,
              timestamp: offerData.createdAt.toString(),
            },
            profile: null, // Profile needs to be fetched separately if needed
          } as OfferResponse
        } catch (error) {
          console.error(`Failed to fetch offer ${offerId}:`, error)
          return null
        }
      })

      const offers = await Promise.all(offerPromises)
      return offers.filter((o): o is OfferResponse => o !== null)
    } catch (error) {
      console.error('Failed to fetch maker offers:', error)
      return []
    }
  }

  async fetchMyOffers(limit: number, last?: number): Promise<OfferResponse[]> {
    if (!this.account) {
      throw new WalletNotConnected()
    }

    const offers = await this.fetchMakerOffers(this.account)
    const startIndex = last || 0
    return offers.slice(startIndex, startIndex + limit)
  }

  async fetchOffersCountByStates(states: string[]): Promise<number> {
    const allOffers = await this.fetchAllOffers(1000, 0)
    return allOffers.filter(o => states.includes(o.offer.state)).length
  }

  async fetchAllFiatsOffersCount(states: string[]): Promise<Array<{ fiat: string; count: number }>> {
    const allOffers = await this.fetchAllOffers(1000, 0)
    const filtered = allOffers.filter(o => states.includes(o.offer.state))
    
    const counts = new Map<string, number>()
    filtered.forEach(offerResponse => {
      const current = counts.get(offerResponse.offer.fiat_currency) || 0
      counts.set(offerResponse.offer.fiat_currency, current + 1)
    })

    return Array.from(counts.entries()).map(([fiat, count]) => ({ fiat, count }))
  }

  async createOffer(postOffer: PostOffer): Promise<number> {
    if (!this.walletClient || !this.account) {
      throw new WalletNotConnected()
    }
    
    // Ensure we have the offer address from Hub config
    if (!this.hubInfo.offerAddress) {
      throw new Error('Offer address not available. Hub config may not be loaded.')
    }

    try {
      // Map denom to token address
      let tokenAddress: Address = '0x0000000000000000000000000000000000000000' // Default to native token (BNB)
      
      const denomStr = denomToValue(postOffer.denom)
      if (denomStr !== 'bnb') {
        const chainTokens = this.config.chainId === 56 ? TOKEN_ADDRESSES.BSC_MAINNET : TOKEN_ADDRESSES.BSC_TESTNET
        const denomUpperCase = denomStr.toUpperCase() as keyof typeof chainTokens
        tokenAddress = (chainTokens[denomUpperCase] || '0x0000000000000000000000000000000000000000') as Address
      }

      // Convert amounts from micro-units (1e6) to wei (1e18) for contract
      const minAmountInWei = BigInt(postOffer.min_amount) * BigInt(1e12)
      const maxAmountInWei = BigInt(postOffer.max_amount) * BigInt(1e12)

      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: this.hubInfo.offerAddress as Address,
        abi: OfferABI,
        functionName: 'createOffer',
        args: [
          postOffer.offer_type === 'buy' ? 0 : 1,
          postOffer.fiat_currency,
          tokenAddress,
          minAmountInWei,
          maxAmountInWei,
          BigInt(postOffer.rate),
          postOffer.description || '',
        ],
      })

      const hash = await this.walletClient.writeContract(request)
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
      
      // Extract offer ID from events (assuming event is emitted)
      // For now, return a placeholder
      return Date.now()
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async updateOffer(updateOffer: PatchOffer): Promise<void> {
    if (!this.walletClient || !this.account) {
      throw new WalletNotConnected()
    }
    
    // Ensure we have the offer address from Hub config
    if (!this.hubInfo.offerAddress) {
      throw new Error('Offer address not available. Hub config may not be loaded.')
    }

    try {
      // Handle description update using the new updateOfferDescription function
      if (updateOffer.description !== undefined) {
        console.log('[EVMChain] Updating offer description')
        const { request } = await this.publicClient.simulateContract({
          account: this.account,
          address: this.hubInfo.offerAddress as Address,
          abi: OfferABI,
          functionName: 'updateOfferDescription',
          args: [
            BigInt(updateOffer.id),
            updateOffer.description,
          ],
        })

        const hash = await this.walletClient.writeContract(request)
        await this.publicClient.waitForTransactionReceipt({ hash })
      }

      // Handle state changes
      if (updateOffer.state) {
        const functionName = updateOffer.state === 'active' ? 'activateOffer' : 
                           updateOffer.state === 'paused' ? 'pauseOffer' : 'archiveOffer'
        
        const { request } = await this.publicClient.simulateContract({
          account: this.account,
          address: this.hubInfo.offerAddress as Address,
          abi: OfferABI,
          functionName,
          args: [BigInt(updateOffer.id)],
        })

        const hash = await this.walletClient.writeContract(request)
        await this.publicClient.waitForTransactionReceipt({ hash })
      }

      // Handle other updates
      if (updateOffer.rate || updateOffer.min_amount || updateOffer.max_amount) {
        // Get current offer to fill in missing values
        const current = await this.fetchOffer(updateOffer.id.toString())
        
        // Map the current state to uint8
        const stateMap = {
          'active': 0,
          'paused': 1,
          'deleted': 2,
          'archived': 2,
        }
        const currentState = stateMap[updateOffer.state || current.state] || 0
        
        const { request } = await this.publicClient.simulateContract({
          account: this.account,
          address: this.hubInfo.offerAddress as Address,
          abi: OfferABI,
          functionName: 'updateOffer',
          args: [
            BigInt(updateOffer.id),
            currentState,
            BigInt(updateOffer.rate || current.rate),
            BigInt(updateOffer.min_amount || current.min_amount),
            BigInt(updateOffer.max_amount || current.max_amount),
          ],
        })

        const hash = await this.walletClient.writeContract(request)
        await this.publicClient.waitForTransactionReceipt({ hash })
      }
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async openTrade(trade: NewTrade): Promise<number> {
    if (!this.walletClient || !this.account) {
      throw new WalletNotConnected()
    }
    
    // Ensure we have the trade address from Hub config
    if (!this.hubInfo.tradeAddress) {
      throw new Error('Trade address not available. Hub config may not be loaded.')
    }

    try {
      // Convert amount from micro-units (1e6) to wei (1e18) for contract
      const amountInWei = BigInt(trade.amount) * BigInt(1e12)
      
      const { request, result } = await this.publicClient.simulateContract({
        account: this.account,
        address: this.hubInfo.tradeAddress as Address,
        abi: TradeABI,
        functionName: 'createTrade',
        args: [
          BigInt(trade.offer_id),
          amountInWei,
          trade.taker_contact,
        ],
      })

      const hash = await this.walletClient.writeContract(request)
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
      
      // The createTrade function returns the trade ID as a uint256
      // Convert bigint to number for the trade ID
      return Number(result)
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async fetchTrades(limit: number, last?: number): Promise<TradeInfo[]> {
    if (!this.account || !this.publicClient) {
      throw new WalletNotConnected()
    }
    
    // Ensure we have the trade address from Hub config
    if (!this.hubInfo.tradeAddress) {
      console.error('Trade address not available. Hub config may not be loaded.')
      return []
    }

    try {
      const tradeIds = await this.publicClient.readContract({
        address: this.hubInfo.tradeAddress as Address,
        abi: TradeABI,
        functionName: 'getTradesByUser',
        args: [this.account],
      }) as bigint[]

      const trades: TradeInfo[] = []
      for (const id of tradeIds) {
        try {
          const t = await this.publicClient.readContract({
            address: this.hubInfo.tradeAddress as Address,
            abi: TradeABI,
            functionName: 'getTrade',
            args: [id],
          })
          // Compose TradeInfo in the same shape as Cosmos
          const amountInMicroUnits = (t.amount as bigint) / BigInt(1e12)

          // Map token address to denom
          const denom = t.tokenAddress === '0x0000000000000000000000000000000000000000'
            ? { native: 'bnb' }
            : { native: this.mapTokenAddressToDenom(t.tokenAddress) }

          // Basic trade object
          const trade = {
            id: Number(t.id),
            addr: `trade-${t.id.toString()}`,
            factory_addr: '',
            buyer: t.buyer as string,
            buyer_contact: t.buyerContact as string,
            buyer_encryption_key: '',
            seller: t.seller as string,
            seller_contact: t.sellerContact as string,
            seller_encryption_key: '',
            arbitrator: (t.arbitrator as string) || null,
            arbitrator_encryption_key: '',
            arbitrator_buyer_contact: undefined,
            arbitrator_seller_contact: undefined,
            offer_contract: this.hubInfo.offerAddress,
            offer_id: Number(t.offerId),
            created_at: Number(t.createdAt),
            expires_at: Number(t.expiresAt),
            enables_dispute_at: Number(t.disputeDeadline) || undefined,
            amount: amountInMicroUnits.toString(),
            denom,
            denom_fiat_price: 0, // filled below for stablecoins
            state: mapTradeState(t.state),
            state_history: [{ actor: t.buyer as string, state: mapTradeState(t.state), timestamp: Number(t.createdAt) }],
            fiat: (t.fiatCurrency as string) as FiatCurrency,
          }

          // Try to enrich fiat price for stablecoins (1:1 to USD)
          const denomStr = denomToValue(denom).toLowerCase()
          const isStablecoin = denomStr === 'usdt' || denomStr === 'usdc' ||
            denomStr.includes('usdt') || denomStr.includes('usdc') ||
            denomStr === '0x55d398326f99059ff775485246999027b3197955' ||
            denomStr === '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
          if (isStablecoin && trade.fiat) {
            try {
              const rateRaw = await this.fetchFiatToUsdRate(trade.fiat)
              const fiatPerUSD = this.formatFiatPrice(rateRaw)
              trade.denom_fiat_price = Math.round(fiatPerUSD * 1_000_000)
            } catch { /* ignore */ }
          }

          // Fetch offer details to include in TradeInfo
          const offer = await this.fetchOffer(t.offerId.toString())

          trades.push({ trade, offer, expired: false } as unknown as TradeInfo)
        } catch (e) {
          console.warn('Failed to fetch trade details for id', id.toString(), e)
        }
      }

      // Apply pagination
      const startIndex = last || 0
      return trades.slice(startIndex, startIndex + limit)
    } catch (error) {
      console.error('Failed to fetch trades:', error)
      return []
    }
  }

  async fetchTradesCountByStates(states: string[]): Promise<number> {
    const trades = await this.fetchTrades(1000, 0)
    return trades.filter(t => states.includes(t.state)).length
  }

  async fetchAllFiatsTradesCount(states: string[]): Promise<Array<{ fiat: string; count: number }>> {
    // This would require fetching all trades and their associated offers
    // For now, return empty array
    return []
  }

  async fetchDisputedTrades(limit: number, last?: number): Promise<{ openDisputes: TradeInfo[]; closedDisputes: TradeInfo[] }> {
    const allTrades = await this.fetchTrades(limit * 2, last)
    const openDisputes = allTrades.filter(t => t.state === 'dispute_opened')
    const closedDisputes = allTrades.filter(t => t.state === 'dispute_settled')
    return { openDisputes, closedDisputes }
  }

  async fetchTradeDetail(tradeId: number): Promise<TradeInfo> {
    if (!this.publicClient) {
      await this.init()
    }

    try {
      const result = await this.publicClient.readContract({
        address: this.hubInfo.tradeAddress as Address,
        abi: TradeABI,
        functionName: 'getTrade',
        args: [BigInt(tradeId)],
      })
      // Shape the detailed trade like Cosmos
      const amountInMicroUnits = (result.amount as bigint) / BigInt(1e12)
      const denom = result.tokenAddress === '0x0000000000000000000000000000000000000000'
        ? { native: 'bnb' }
        : { native: this.mapTokenAddressToDenom(result.tokenAddress) }

      const trade = {
        id: Number(result.id),
        addr: `trade-${result.id.toString()}`,
        factory_addr: '',
        buyer: result.buyer as string,
        buyer_contact: result.buyerContact as string,
        buyer_encryption_key: '',
        seller: result.seller as string,
        seller_contact: result.sellerContact as string,
        seller_encryption_key: '',
        arbitrator: (result.arbitrator as string) || null,
        arbitrator_encryption_key: '',
        arbitrator_buyer_contact: undefined,
        arbitrator_seller_contact: undefined,
        offer_contract: this.hubInfo.offerAddress,
        offer_id: Number(result.offerId),
        created_at: Number(result.createdAt),
        expires_at: Number(result.expiresAt),
        enables_dispute_at: Number(result.disputeDeadline) || undefined,
        amount: amountInMicroUnits.toString(),
        denom,
        denom_fiat_price: 0,
        state: mapTradeState(result.state),
        state_history: [{ actor: result.buyer as string, state: mapTradeState(result.state), timestamp: Number(result.createdAt) }],
        fiat: (result.fiatCurrency as string) as FiatCurrency,
      }

      // Populate denom fiat price for stablecoins if possible
      const denomStr = denomToValue(denom).toLowerCase()
      const isStablecoin = denomStr === 'usdt' || denomStr === 'usdc' ||
        denomStr.includes('usdt') || denomStr.includes('usdc') ||
        denomStr === '0x55d398326f99059ff775485246999027b3197955' ||
        denomStr === '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
      if (isStablecoin && trade.fiat) {
        try {
          const rateRaw = await this.fetchFiatToUsdRate(trade.fiat)
          const fiatPerUSD = this.formatFiatPrice(rateRaw)
          trade.denom_fiat_price = Math.round(fiatPerUSD * 1_000_000)
        } catch { /* ignore */ }
      }

      const offer = await this.fetchOffer(result.offerId.toString())
      return { trade, offer, expired: false } as unknown as TradeInfo
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async fetchArbitrators(): Promise<Arbitrator[]> {
    // For EVM chains, arbitrators are currency-specific
    // This function returns empty array as arbitrators should be fetched per currency
    // Use fetchArbitratorsForCurrency() instead
    return []
  }

  async fetchArbitratorsForCurrency(currency: string): Promise<Arbitrator[]> {
    if (!this.publicClient || !this.hubInfo.arbitratorManagerAddress) {
      return []
    }

    try {
      // Get eligible arbitrators for the currency
      const arbitratorAddresses = await this.publicClient.readContract({
        address: this.hubInfo.arbitratorManagerAddress as Address,
        abi: ArbitratorManagerABI,
        functionName: 'getEligibleArbitrators',
        args: [currency],
      }) as Address[]

      // Fetch info for each arbitrator
      const arbitrators: Arbitrator[] = []
      for (const addr of arbitratorAddresses) {
        try {
          const info = await this.publicClient.readContract({
            address: this.hubInfo.arbitratorManagerAddress as Address,
            abi: ArbitratorManagerABI,
            functionName: 'getArbitratorInfo',
            args: [addr],
          }) as any

          if (info.isActive) {
            arbitrators.push({
              addr: addr,
              name: `Arbitrator ${addr.slice(0, 6)}...${addr.slice(-4)}`, // Default name
              bio: `Reputation: ${info.reputationScore / 100}%`,
              contact: info.encryptionKey || '',
            })
          }
        } catch (err) {
          console.warn(`Failed to fetch info for arbitrator ${addr}:`, err)
        }
      }

      return arbitrators
    } catch (error) {
      console.error('Failed to fetch arbitrators for currency:', error)
      return []
    }
  }

  async updateFiatPrice(fiat: FiatCurrency, denom: Denom): Promise<DenomFiatPrice> {
    // For EVM chains, fetch fiat exchange rates from the oracle
    if (!this.publicClient) {
      await this.init()
    }

    try {
      const denomStr = denomToValue(denom).toLowerCase()
      const isStablecoin = denomStr === 'usdt' || denomStr === 'usdc' || 
                          denomStr?.includes('usdt') || denomStr?.includes('usdc') ||
                          denomStr === '0x55d398326f99059ff775485246999027b3197955' || // USDT on BSC
                          denomStr === '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'    // USDC on BSC
      
      console.log(`[EVMChain.updateFiatPrice] Querying price for ${fiat} with denom`, denom, 'on', this.config.chainName)
      console.log(`[EVMChain.updateFiatPrice] Denom string: ${denomStr}, is stablecoin: ${isStablecoin}`)
      
      if (fiat === 'USD' && isStablecoin) {
        // For USD stablecoins, price is always 1:1
        console.log(`[EVMChain.updateFiatPrice] Using 1:1 USD rate for stablecoin`)
        return {
          denom,
          price: '100000000', // 1 USD with 8 decimals
          fiat,
        }
      } else if (isStablecoin) {
        // For other fiats with stablecoin denoms, prefer using fiat/USD exchange rate
        const fiatToUsdRate = await this.fetchFiatToUsdRate(fiat)
        if (fiatToUsdRate > 0) {
          return {
            denom,
            price: fiatToUsdRate.toString(),
            fiat,
          }
        }
        console.warn(`[EVMChain.updateFiatPrice] No exchange rate for ${fiat}; falling back to oracle query`)
      }
      
      // For non-stablecoins or when stablecoin fallback fails, query oracle
      // Validate price oracle address
      if (!this.hubInfo.priceOracleAddress || this.hubInfo.priceOracleAddress === '0x0000000000000000000000000000000000000000') {
        console.warn(`[EVMChain.updateFiatPrice] Price oracle address not configured for ${this.config.chainName}`)
        throw new Error('Price oracle not configured')
      }
      
      console.log(`[EVMChain.updateFiatPrice] Price oracle address: ${this.hubInfo.priceOracleAddress}`)
      
      // Get fiat/USD exchange rate from oracle
      const fiatPrice = await this.publicClient.readContract({
        address: this.hubInfo.priceOracleAddress as Address,
        abi: PriceOracleABI,
        functionName: 'getFiatPrice',
        args: [fiat],
      })
      
      console.log(`[EVMChain.updateFiatPrice] Price response for ${fiat}:`, fiatPrice.toString())
      
      return {
        denom,
        price: fiatPrice.toString(),
        fiat,
      }
    } catch (error: any) {
      console.log(`[EVMChain.updateFiatPrice] Price query failed for ${fiat}, checking for stablecoin fallback...`)
      
      // Handle stablecoin special case: 1 USDC/USDT = 1 USD
      const denomStr = denomToValue(denom).toLowerCase()
      const isStablecoin = denomStr === 'usdt' || denomStr === 'usdc' || 
                          denomStr?.includes('usdt') || denomStr?.includes('usdc') ||
                          denomStr === '0x55d398326f99059ff775485246999027b3197955' || // USDT on BSC
                          denomStr === '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'    // USDC on BSC
      
      console.log(`[EVMChain.updateFiatPrice] Denom string: ${denomStr}, is USDC/USDT: ${isStablecoin}`)
      
      if (isStablecoin && this.isFiatPriceNotFoundError(error)) {
        // Use exchange rate path for stablecoins
        if (fiat === 'USD') {
          return { denom, price: '100000000', fiat }
        }
        const fiatToUsdRate = await this.fetchFiatToUsdRate(fiat)
        if (fiatToUsdRate > 0) {
          return { denom, price: fiatToUsdRate.toString(), fiat }
        }
        // Fallback to 1:1 if no rate is available
        return { denom, price: '100000000', fiat }
      }
      
      // Don't log errors for known missing prices
      if (!this.isFiatPriceNotFoundError(error)) {
        console.error(`[EVMChain.updateFiatPrice] Failed to fetch price for ${fiat}:`, {
          chain: this.config.chainName,
          priceOracleAddr: this.hubInfo.priceOracleAddress,
          denom,
          error: error?.message || error
        })
      }
      
      // Return fallback price (1 USD equivalent)
      return { denom, price: '100000000', fiat }
    }
  }

  async batchUpdateFiatPrices(fiats: FiatCurrency[], denom: Denom): Promise<DenomFiatPrice[]> {
    // For EVM chains, fetch fiat exchange rates from the oracle
    if (!this.publicClient) {
      await this.init()
    }

    const results: DenomFiatPrice[] = []
    const denomStr = denomToValue(denom).toLowerCase()
    const isStablecoin = denomStr === 'usdt' || denomStr === 'usdc' || 
                        denomStr?.includes('usdt') || denomStr?.includes('usdc') ||
                        denomStr === '0x55d398326f99059ff775485246999027b3197955' || // USDT on BSC
                        denomStr === '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'    // USDC on BSC
    
    console.log(`[EVMChain.batchUpdateFiatPrices] Fetching prices for ${fiats.length} fiats with denom`, denom, 'on', this.config.chainName)
    console.log(`[EVMChain.batchUpdateFiatPrices] Denom string: ${denomStr}, is stablecoin: ${isStablecoin}`)
    
    // Check if oracle is configured
    if (!this.hubInfo.priceOracleAddress || this.hubInfo.priceOracleAddress === '0x0000000000000000000000000000000000000000') {
      console.warn(`[EVMChain.batchUpdateFiatPrices] Price oracle not configured for ${this.config.chainName}, using fallback prices`)
      
      // Return fallback prices for stablecoins
      if (isStablecoin) {
        return fiats.map(fiat => ({
          denom,
          price: '100000000', // 1 USD with 8 decimals
          fiat,
          success: false, // Mark as failed due to missing oracle
        }))
      }
      
      return []
    }
    
    console.log(`[EVMChain.batchUpdateFiatPrices] Price oracle address: ${this.hubInfo.priceOracleAddress}`)
    
    for (const fiat of fiats) {
      try {
        console.log(`[EVMChain.batchUpdateFiatPrices] Querying ${fiat}`)
        
        if (isStablecoin) {
          if (fiat === 'USD') {
            // 1:1 for USD
            results.push({ denom, price: '100000000', fiat, success: true })
          } else {
            // Use exchange rate for other fiats
            const rate = await this.fetchFiatToUsdRate(fiat)
            if (rate > 0) {
              results.push({ denom, price: rate.toString(), fiat, success: true })
            } else {
              // Fallback to 1 USD equivalent if no rate available
              results.push({ denom, price: '100000000', fiat, success: false })
            }
          }
        } else {
          // Non-stablecoin: query oracle directly
          const fiatPrice = await this.publicClient.readContract({
            address: this.hubInfo.priceOracleAddress as Address,
            abi: PriceOracleABI,
            functionName: 'getFiatPrice',
            args: [fiat],
          })
          console.log(`[EVMChain.batchUpdateFiatPrices] Success for ${fiat}:`, fiatPrice.toString())
          results.push({ denom, price: fiatPrice.toString(), fiat, success: true })
        }
      } catch (err: any) {
        console.warn(`[EVMChain.batchUpdateFiatPrices] Error fetching price for ${fiat}`, {
          chain: this.config.chainName,
          priceOracleAddr: this.hubInfo.priceOracleAddress,
          denom,
          error: err?.message || err
        })
        // Return a generic fallback price
        results.push({ denom, price: '100000000', fiat, success: false })
      }
    }

    console.log(`[EVMChain.batchUpdateFiatPrices] Returning ${results.length} results`)
    
    // If all results are unsuccessful for non-stablecoins, log warning
    if (!isStablecoin && results.every(r => !r.success)) {
      console.warn(`[EVMChain.batchUpdateFiatPrices] All price queries failed - check contract query format and oracle configuration`)
    }

    return results
  }

  async fetchFiatToUsdRate(fiat: FiatCurrency): Promise<number> {
    if (!this.publicClient) {
      await this.init()
    }

    // Check if oracle is configured
    if (!this.hubInfo.priceOracleAddress || this.hubInfo.priceOracleAddress === '0x0000000000000000000000000000000000000000') {
      return 0
    }

    try {
      const rate = await this.publicClient.readContract({
        address: this.hubInfo.priceOracleAddress as Address,
        abi: PriceOracleABI,
        functionName: 'getFiatPrice',
        args: [fiat],
      })

      // PriceOracle returns how many units of fiat equal 1 USD (with 8 decimals)
      // For example, COP = 405187890000 means 1 USD = 4051.8789 COP
      // For now, return the raw value - the client will handle formatting
      return Number(rate)
    } catch (error: any) {
      // Don't log FiatPriceNotFound errors - use defaults silently
      if (!this.isFiatPriceNotFoundError(error)) {
        console.error(`[EVMChain.fetchFiatToUsdRate] Failed to fetch ${fiat}/USD rate:`, error)
      }
      // Return 0 to indicate no rate available, not 1 which would be incorrectly formatted
      return 0
    }
  }

  formatFiatPrice(rawPrice: string | number): number {
    // EVM returns prices with 8 decimal places
    // Example: 405187890000 means 1 USD = 4051.8789 COP
    // Example: 85627600 means 1 USD = 0.856276 EUR
    const priceAsBigInt = typeof rawPrice === 'string' ? BigInt(rawPrice) : BigInt(rawPrice)
    return Number(priceAsBigInt) / 100000000 // Convert from 8 decimals to decimal value
  }

  private mapTokenAddressToDenom(tokenAddress: string): string {
    // Map token addresses back to denoms
    const chainTokens = this.config.chainId === 56 ? TOKEN_ADDRESSES.BSC_MAINNET : TOKEN_ADDRESSES.BSC_TESTNET
    
    // Find the denom by matching the address
    for (const [denom, address] of Object.entries(chainTokens)) {
      if (address.toLowerCase() === tokenAddress.toLowerCase()) {
        return denom.toLowerCase()
      }
    }
    
    // Default to the address if no match found
    return tokenAddress
  }

  async acceptTradeRequest(tradeId: number, makerContact: string): Promise<void> {
    if (!this.walletClient || !this.account) {
      throw new WalletNotConnected()
    }

    try {
      // Get trade details to determine amount
      const tradeInfo = await this.fetchTradeDetail(tradeId)
      const offer = await this.fetchOffer(tradeInfo.trade.offer_id.toString())
      
      // Calculate amount to send (assuming seller needs to escrow)
      const amount = BigInt(tradeInfo.trade.amount)

      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: this.hubInfo.tradeAddress as Address,
        abi: TradeABI,
        functionName: 'acceptTrade',
        args: [BigInt(tradeId), makerContact],
      })

      const hash = await this.walletClient.writeContract(request)
      await this.publicClient.waitForTransactionReceipt({ hash })
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async cancelTradeRequest(tradeId: number): Promise<void> {
    if (!this.walletClient || !this.account) {
      throw new WalletNotConnected()
    }

    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: this.hubInfo.tradeAddress as Address,
        abi: TradeABI,
        functionName: 'cancelTrade',
        args: [BigInt(tradeId)],
      })

      const hash = await this.walletClient.writeContract(request)
      await this.publicClient.waitForTransactionReceipt({ hash })
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async fundEscrow(tradeInfo: TradeInfo, _maker_contact?: string): Promise<void> {
    if (!this.walletClient || !this.account) {
      throw new WalletNotConnected()
    }
    try {
      // Read on-chain trade to determine token type and exact amount (in base units)
      const onchainTrade: any = await this.publicClient.readContract({
        address: this.hubInfo.tradeAddress as Address,
        abi: TradeABI,
        functionName: 'getTrade',
        args: [BigInt(tradeInfo.trade.id)],
      })

      const tokenAddress = (onchainTrade.tokenAddress as string).toLowerCase()
      const zeroAddress = '0x0000000000000000000000000000000000000000'
      const isNative = tokenAddress === zeroAddress
      let amount: bigint = onchainTrade.amount as bigint
      
      // If current user is the maker (seller in a sell offer), add the platform fee to the amount
      // The maker pays the fees, so they need to fund: base_amount + fees
      const hubConfig = this.hubInfo.hubConfig
      if (tradeInfo.offer.offer.owner?.toLowerCase() === this.account?.toLowerCase()) {
        // Calculate platform fees (in basis points, converted to percentage)
        const platformFeeBps = BigInt(Math.round(
          (hubConfig.warchest_fee_pct + hubConfig.burn_fee_pct + hubConfig.chain_fee_pct) * Number(BASIS_POINTS)
        ))
        const platformFee = (amount * platformFeeBps) / BASIS_POINTS
        amount = amount + platformFee
      }
      
      // Check user balance before attempting transaction
      if (isNative) {
        const balance = await this.publicClient.getBalance({ address: this.account })
        if (balance < amount) {
          const tokenSymbol = this.getChainNativeToken()
          const needed = sanitizeNumber((amount / 10n**18n).toString())
          const have = sanitizeNumber((balance / 10n**18n).toString())
          throw new Error(`Insufficient ${tokenSymbol} balance. You need ${needed} ${tokenSymbol} but only have ${have} ${tokenSymbol}.`)
        }
      } else {
        const balance = await this.publicClient.readContract({
          address: tokenAddress as Address,
          abi: ERC20ABI,
          functionName: 'balanceOf',
          args: [this.account],
        }) as bigint
        
        if (balance < amount) {
          // Get token symbol and decimals for better error message
          let tokenSymbol = 'tokens'
          let decimals = 18n // Default to 18 if query fails
          
          try {
            const rawSymbol = await this.publicClient.readContract({
              address: tokenAddress as Address,
              abi: ERC20ABI,
              functionName: 'symbol',
              args: [],
            }) as string
            tokenSymbol = sanitizeTokenSymbol(rawSymbol)
          } catch (error) {
            console.warn(`Failed to fetch token symbol for ${tokenAddress}:`, error)
          }
          
          try {
            decimals = BigInt(await this.publicClient.readContract({
              address: tokenAddress as Address,
              abi: ERC20ABI,
              functionName: 'decimals',
              args: [],
            }) as number)
          } catch (error) {
            console.warn(`Failed to fetch token decimals for ${tokenAddress}, using default 18:`, error)
          }
          
          const amountFormatted = sanitizeNumber(Number(amount / 10n**(decimals-6n)) / 1000000)
          const balanceFormatted = sanitizeNumber(Number(balance / 10n**(decimals-6n)) / 1000000)
          throw new Error(`Insufficient ${tokenSymbol} balance. You need ${amountFormatted} ${tokenSymbol} (including fees) but only have ${balanceFormatted} ${tokenSymbol}.`)
        }
      }
      
      const value = isNative ? amount : 0n

      // If ERC20, ensure allowance to Trade contract is sufficient
      if (!isNative) {
        const owner = this.account as Address
        const spender = this.hubInfo.tradeAddress as Address
        const currentAllowance = await this.publicClient.readContract({
          address: tokenAddress as Address,
          abi: ERC20ABI,
          functionName: 'allowance',
          args: [owner, spender],
        }) as bigint

        if (currentAllowance < amount) {
          // Some tokens (e.g., USDT/BEP20) require allowance reset to 0 before setting new value
          if (currentAllowance > 0n) {
            const { request: resetReq } = await this.publicClient.simulateContract({
              account: this.account,
              address: tokenAddress as Address,
              abi: ERC20ABI,
              functionName: 'approve',
              args: [spender, 0n],
            })
            const resetHash = await this.walletClient.writeContract(resetReq)
            await this.publicClient.waitForTransactionReceipt({ hash: resetHash })
          }

          const { request: approveReq } = await this.publicClient.simulateContract({
            account: this.account,
            address: tokenAddress as Address,
            abi: ERC20ABI,
            functionName: 'approve',
            args: [spender, amount],
          })
          const approveHash = await this.walletClient.writeContract(approveReq)
          await this.publicClient.waitForTransactionReceipt({ hash: approveHash })
        }
      }

      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: this.hubInfo.tradeAddress as Address,
        abi: TradeABI,
        functionName: 'fundEscrow',
        args: [BigInt(tradeInfo.trade.id)],
        value,
      })

      const hash = await this.walletClient.writeContract(request)
      await this.publicClient.waitForTransactionReceipt({ hash })
    } catch (error: any) {
      // Check for insufficient balance errors
      if (error?.message?.includes('transfer amount exceeds balance') || 
          error?.message?.includes('insufficient balance') ||
          error?.message?.includes('BEP20: transfer amount exceeds balance')) {
        throw new Error('Insufficient balance. Please ensure you have enough tokens to fund this trade including platform fees.')
      }
      throw DefaultError.fromError(error)
    }
  }

  async setFiatDeposited(tradeId: number): Promise<void> {
    if (!this.walletClient || !this.account) {
      throw new WalletNotConnected()
    }

    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: this.hubInfo.tradeAddress as Address,
        abi: TradeABI,
        functionName: 'markFiatDeposited',
        args: [BigInt(tradeId)],
      })

      const hash = await this.walletClient.writeContract(request)
      await this.publicClient.waitForTransactionReceipt({ hash })
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async releaseEscrow(tradeId: number): Promise<void> {
    if (!this.walletClient || !this.account) {
      throw new WalletNotConnected()
    }

    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: this.hubInfo.tradeAddress as Address,
        abi: TradeABI,
        functionName: 'releaseEscrow',
        args: [BigInt(tradeId)],
      })

      const hash = await this.walletClient.writeContract(request)
      await this.publicClient.waitForTransactionReceipt({ hash })
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async refundEscrow(tradeId: number): Promise<void> {
    if (!this.walletClient || !this.account) {
      throw new WalletNotConnected()
    }

    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: this.hubInfo.tradeAddress as Address,
        abi: TradeABI,
        functionName: 'refundExpiredTrade',
        args: [BigInt(tradeId)],
      })

      const hash = await this.walletClient.writeContract(request)
      await this.publicClient.waitForTransactionReceipt({ hash })
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async openDispute(tradeId: number, _buyerContact: string, _sellerContact: string): Promise<void> {
    if (!this.walletClient || !this.account) {
      throw new WalletNotConnected()
    }

    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: this.hubInfo.tradeAddress as Address,
        abi: TradeABI,
        functionName: 'disputeTrade',
        args: [BigInt(tradeId), ''],
      })

      const hash = await this.walletClient.writeContract(request)
      await this.publicClient.waitForTransactionReceipt({ hash })
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async settleDispute(tradeId: number, winner: string): Promise<void> {
    if (!this.walletClient || !this.account) {
      throw new WalletNotConnected()
    }

    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: this.hubInfo.tradeAddress as Address,
        abi: TradeABI,
        functionName: 'resolveDispute',
        args: [BigInt(tradeId), winner as Address],
      })

      const hash = await this.walletClient.writeContract(request)
      await this.publicClient.waitForTransactionReceipt({ hash })
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }

  async newArbitrator(arbitrator: Arbitrator): Promise<void> {
    if (!this.walletClient || !this.account || !this.hubInfo.arbitratorManagerAddress) {
      throw new WalletNotConnected()
    }

    try {
      // For EVM, we need to provide supported currencies and encryption key
      // Support all configured fiat currencies from fiats-config.json
      const supportedCurrencies = [
        'USD', 'ARS', 'BRL', 'CAD', 'CLP', 'COP', 'EUR', 'GBP',
        'MXN', 'NGN', 'THB', 'VES', 'IDR', 'PHP', 'VND', 'MYR',
        'SGD', 'ZAR', 'EGP', 'KES'
      ]
      const encryptionKey = arbitrator.contact || '' // Use contact as encryption key for now

      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: this.hubInfo.arbitratorManagerAddress as Address,
        abi: ArbitratorManagerABI,
        functionName: 'registerArbitrator',
        args: [supportedCurrencies, encryptionKey],
      })

      const hash = await this.walletClient.writeContract(request)
      await this.publicClient.waitForTransactionReceipt({ hash })
    } catch (error) {
      throw DefaultError.fromError(error)
    }
  }
}
