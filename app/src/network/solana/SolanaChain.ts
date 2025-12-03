/**
 * SolanaChain - Solana implementation of the Chain interface
 *
 * This class wraps the @localmoney/sdk to provide a Chain-compatible interface
 * for the LocalMoney frontend application.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import BN from 'bn.js'
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
  LocalMoneyClient,
  type OfferAccount,
  type TradeAccount,
  type UserProfileAccount,
  type ArbitratorAccount,
  OfferType as SdkOfferType,
  OfferState as SdkOfferState,
  TradeState as SdkTradeState,
  DisputeResolution,
  bytesToFiat,
  fiatToBytes,
} from '@localmoney/sdk'

import type { Chain } from '../Chain'
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
  Trade,
  TradeInfo,
  GetOffer,
  TradeState,
  TradeStateItem,
  OfferType,
  OfferState,
} from '~/types/components.interface'
import type { Coin } from '@cosmjs/stargate'
import type { SolanaConfig, SolanaHubInfo } from './types'
import { PhantomSolanaAdapter, waitForPhantom } from './wallet'
import { WalletNotConnected, WalletNotInstalled, DefaultError } from '../chain-error'

// Price decimals used in the Solana SDK
const PRICE_DECIMALS = 8
const TOKEN_DECIMALS = 6 // Standard SPL token decimals (USDC)

/**
 * SolanaChain implementation
 *
 * Implements the Chain interface by wrapping the LocalMoney SDK.
 */
export class SolanaChain implements Chain {
  private config: SolanaConfig
  private hubInfo: SolanaHubInfo
  private connection: Connection
  private sdkClient: LocalMoneyClient | null = null
  private walletAdapter: PhantomSolanaAdapter | null = null
  private walletAddress: string = ''
  private initialized = false

  constructor(config: SolanaConfig, hubInfo: SolanaHubInfo) {
    this.config = config
    this.hubInfo = hubInfo
    this.connection = new Connection(config.rpcEndpoint, 'confirmed')
  }

  // ==================== Core Methods ====================

  /**
   * Initialize the chain client
   */
  async init(): Promise<void> {
    if (this.initialized) return

    // Initialize SDK client without wallet (read-only mode)
    // Using the SDK's expected NetworkConfig format
    this.sdkClient = LocalMoneyClient.create({
      config: {
        name: this.config.network,
        endpoint: this.config.rpcEndpoint,
        wsEndpoint: this.config.wsEndpoint,
        commitment: 'confirmed',
        programIds: {
          HUB: new PublicKey(this.hubInfo.hubProgramId),
          PROFILE: new PublicKey(this.hubInfo.profileProgramId),
          OFFER: new PublicKey(this.hubInfo.offerProgramId),
          TRADE: new PublicKey(this.hubInfo.tradeProgramId),
          ESCROW: new PublicKey(this.hubInfo.escrowProgramId),
          ARBITRATOR: new PublicKey(this.hubInfo.arbitratorProgramId),
          PRICE_ORACLE: new PublicKey(this.hubInfo.priceOracleProgramId),
        },
      },
      connection: this.connection,
    })

    // Try to fetch hub config from chain and update local config
    try {
      const hubConfig = await this.sdkClient.hub.getConfig()
      if (hubConfig) {
        this.updateHubConfigFromChain(hubConfig)
      }
    } catch (error) {
      console.warn('Failed to fetch hub config from chain, using defaults:', error)
    }

    this.initialized = true
  }

  /**
   * Get chain display name
   */
  getName(): string {
    return this.config.chainName
  }

  /**
   * Get chain type identifier
   */
  getChainType(): string {
    return 'solana'
  }

  /**
   * Get hub configuration
   */
  getHubConfig(): HubConfig {
    return this.hubInfo.hubConfig
  }

  // ==================== Wallet Methods ====================

  /**
   * Connect to wallet
   */
  async connectWallet(): Promise<void> {
    // Check if Phantom is available
    const phantomAvailable = await waitForPhantom(3000)
    if (!phantomAvailable) {
      throw new WalletNotInstalled('Phantom wallet not found. Please install it from phantom.app')
    }

    // Create wallet adapter
    this.walletAdapter = new PhantomSolanaAdapter()

    // Set up event listeners
    this.walletAdapter.on('disconnect', () => {
      this.walletAddress = ''
      this.updateSdkClientWallet(null)
    })

    this.walletAdapter.on('accountChanged', (publicKey) => {
      if (publicKey) {
        this.walletAddress = publicKey.toBase58()
        this.updateSdkClientWallet(this.walletAdapter)
      } else {
        this.walletAddress = ''
        this.updateSdkClientWallet(null)
      }
    })

    // Connect to wallet
    await this.walletAdapter.connect()

    if (!this.walletAdapter.publicKey) {
      throw new WalletNotConnected('Failed to connect to wallet')
    }

    this.walletAddress = this.walletAdapter.publicKey.toBase58()

    // Update SDK client with wallet
    this.updateSdkClientWallet(this.walletAdapter)
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(): Promise<void> {
    if (this.walletAdapter) {
      await this.walletAdapter.disconnect()
      this.walletAdapter = null
    }
    this.walletAddress = ''
    this.updateSdkClientWallet(null)
  }

  /**
   * Get connected wallet address
   */
  getWalletAddress(): string {
    return this.walletAddress
  }

  // ==================== Profile Methods ====================

  /**
   * Fetch user profile
   */
  async fetchProfile(profileAddr?: Addr): Promise<Profile> {
    this.requireClient()

    const address = profileAddr || this.walletAddress
    if (!address) {
      throw new WalletNotConnected('No address provided and wallet not connected')
    }

    const publicKey = new PublicKey(address)
    const profile = await this.sdkClient!.profile.getProfile(publicKey)

    if (!profile) {
      // Return default profile if not found
      return this.createDefaultProfile(address)
    }

    return this.convertProfileFromSdk(profile, address)
  }

  /**
   * Fetch token balance
   */
  async fetchTokenBalance(denom: Denom): Promise<Coin> {
    this.requireClient()

    if (!this.walletAddress) {
      return { denom: this.getDenomString(denom), amount: '0' }
    }

    try {
      const walletPubkey = new PublicKey(this.walletAddress)
      const mintAddress = this.getMintAddressFromDenom(denom)

      // Check if it's native SOL
      if (mintAddress.equals(PublicKey.default)) {
        const balance = await this.connection.getBalance(walletPubkey)
        return {
          denom: 'SOL',
          amount: (balance / LAMPORTS_PER_SOL).toString(),
        }
      }

      // Get SPL token balance
      const ata = await getAssociatedTokenAddress(mintAddress, walletPubkey)
      try {
        const account = await getAccount(this.connection, ata)
        return {
          denom: this.getDenomString(denom),
          amount: account.amount.toString(),
        }
      } catch {
        // Account doesn't exist, balance is 0
        return {
          denom: this.getDenomString(denom),
          amount: '0',
        }
      }
    } catch (error) {
      console.error('Error fetching token balance:', error)
      return { denom: this.getDenomString(denom), amount: '0' }
    }
  }

  // ==================== Offer Methods ====================

  /**
   * Fetch single offer by ID
   */
  async fetchOffer(offerId: string): Promise<OfferResponse> {
    this.requireClient()

    const offer = await this.sdkClient!.offer.getOffer(new BN(offerId))
    if (!offer) {
      throw new DefaultError(`Offer not found: ${offerId}`)
    }

    const profile = await this.fetchMakerProfile(offer.owner.toBase58())
    return {
      offer: this.convertOfferFromSdk(offer),
      profile,
    }
  }

  /**
   * Fetch all offers with pagination
   */
  async fetchAllOffers(limit: number, last?: number): Promise<OfferResponse[]> {
    this.requireClient()

    const offers = await this.sdkClient!.offer.getActiveOffers()

    // Apply pagination
    const startIndex = last ? last + 1 : 0
    const paginatedOffers = offers.slice(startIndex, startIndex + limit)

    return Promise.all(
      paginatedOffers.map(async (o) => {
        const profile = await this.fetchMakerProfile(o.account.owner.toBase58())
        return {
          offer: this.convertOfferFromSdk(o.account),
          profile,
        }
      })
    )
  }

  /**
   * Fetch offers with filters
   */
  async fetchOffers(args: FetchOffersArgs, limit: number, last?: number): Promise<OfferResponse[]> {
    this.requireClient()

    // Use SDK search with filters
    const offers = await this.sdkClient!.offer.searchOffers({
      offerType: args.offerType === 'buy' ? SdkOfferType.Buy : SdkOfferType.Sell,
      fiatCurrency: args.fiatCurrency,
      state: SdkOfferState.Active,
    })

    // Apply pagination
    const startIndex = last ? last + 1 : 0
    const paginatedOffers = offers.slice(startIndex, startIndex + limit)

    return Promise.all(
      paginatedOffers.map(async (o) => {
        const profile = await this.fetchMakerProfile(o.account.owner.toBase58())
        return {
          offer: this.convertOfferFromSdk(o.account),
          profile,
        }
      })
    )
  }

  /**
   * Fetch offers by maker
   */
  async fetchMakerOffers(maker: Addr): Promise<OfferResponse[]> {
    this.requireClient()

    const offers = await this.sdkClient!.offer.getOffersByOwner(new PublicKey(maker))
    const profile = await this.fetchMakerProfile(maker)

    return offers.map((o) => ({
      offer: this.convertOfferFromSdk(o.account),
      profile,
    }))
  }

  /**
   * Fetch connected wallet's offers
   */
  async fetchMyOffers(limit: number, last?: number): Promise<OfferResponse[]> {
    if (!this.walletAddress) {
      return []
    }
    return this.fetchMakerOffers(this.walletAddress)
  }

  /**
   * Fetch offers count by states
   */
  async fetchOffersCountByStates(states: string[]): Promise<number> {
    this.requireClient()

    // For now, just get all offers and filter
    const allOffers = await this.sdkClient!.offer.getActiveOffers()
    return allOffers.filter((o) => states.includes(this.convertOfferStateToApp(o.account.state))).length
  }

  /**
   * Fetch all fiats offers count
   */
  async fetchAllFiatsOffersCount(states: string[]): Promise<Array<{ fiat: string; count: number }>> {
    this.requireClient()

    const allOffers = await this.sdkClient!.offer.getActiveOffers()
    const counts = new Map<string, number>()

    for (const offer of allOffers) {
      const state = this.convertOfferStateToApp(offer.account.state)
      if (states.includes(state)) {
        const fiat = bytesToFiat(offer.account.fiatCurrency as number[])
        counts.set(fiat, (counts.get(fiat) || 0) + 1)
      }
    }

    return Array.from(counts.entries()).map(([fiat, count]) => ({ fiat, count }))
  }

  /**
   * Create a new offer
   */
  async createOffer(postOffer: PostOffer): Promise<number> {
    this.requireWallet()

    // Ensure profile exists
    await this.ensureProfile(postOffer.owner_contact, postOffer.owner_encryption_key)

    const tokenMint = this.getMintAddressFromDenom(postOffer.denom)

    // Note: postOffer.min_amount and postOffer.max_amount are already in micro-units from client.ts
    // So we just need to convert them to BN without additional multiplication
    const result = await this.sdkClient!.offer.createOffer({
      offerType: postOffer.offer_type === 'buy' ? SdkOfferType.Buy : SdkOfferType.Sell,
      fiatCurrency: postOffer.fiat_currency,
      tokenMint,
      minAmount: new BN(postOffer.min_amount), // Already in micro-units
      maxAmount: new BN(postOffer.max_amount), // Already in micro-units
      rate: this.parseRate(postOffer.rate),
      description: postOffer.description || '',
    })

    return result.offerId.toNumber()
  }

  /**
   * Update an existing offer
   */
  async updateOffer(updateOffer: PatchOffer): Promise<void> {
    this.requireWallet()

    // Note: updateOffer amounts are already in micro-units from client.ts
    await this.sdkClient!.offer.updateOffer(new BN(updateOffer.id), {
      minAmount: updateOffer.min_amount ? new BN(updateOffer.min_amount) : undefined,
      maxAmount: updateOffer.max_amount ? new BN(updateOffer.max_amount) : undefined,
      rate: updateOffer.rate ? this.parseRate(updateOffer.rate) : undefined,
    })

    // Handle state changes
    if (updateOffer.state === 'paused') {
      await this.sdkClient!.offer.pauseOffer(new BN(updateOffer.id))
    } else if (updateOffer.state === 'active') {
      await this.sdkClient!.offer.resumeOffer(new BN(updateOffer.id))
    }
  }

  // ==================== Trade Methods ====================

  /**
   * Open a new trade
   */
  async openTrade(trade: NewTrade): Promise<number> {
    this.requireWallet()

    // Ensure profile exists
    await this.ensureProfile(trade.profile_taker_contact, trade.profile_taker_encryption_key)

    // Fetch offer to get token mint
    const offer = await this.sdkClient!.offer.getOffer(new BN(trade.offer_id))
    if (!offer) {
      throw new DefaultError(`Offer not found: ${trade.offer_id}`)
    }

    // Note: trade.amount and trade.price are already in micro-units from client.ts
    // So we just need to convert them to BN without additional multiplication
    const result = await this.sdkClient!.trade.createTrade({
      offerId: new BN(trade.offer_id),
      amount: new BN(trade.amount), // Already in micro-units
      fiatAmount: trade.price ? new BN(trade.price) : new BN(0), // Already in micro-units
      buyerContact: trade.taker_contact,
      tokenMint: offer.tokenMint as PublicKey,
    })

    return result.tradeId.toNumber()
  }

  /**
   * Fetch trades for connected wallet
   */
  async fetchTrades(limit: number, last?: number): Promise<TradeInfo[]> {
    this.requireWallet()

    const walletPubkey = new PublicKey(this.walletAddress)
    const trades = await this.sdkClient!.trade.getActiveTrades(walletPubkey)

    // Apply pagination
    const startIndex = last ? last + 1 : 0
    const paginatedTrades = trades.slice(startIndex, startIndex + limit)

    return Promise.all(paginatedTrades.map((t) => this.buildTradeInfo(t.account)))
  }

  /**
   * Fetch trades count by states
   */
  async fetchTradesCountByStates(states: string[]): Promise<number> {
    this.requireWallet()

    const walletPubkey = new PublicKey(this.walletAddress)
    const buyerTrades = await this.sdkClient!.trade.getTradesByBuyer(walletPubkey)
    const sellerTrades = await this.sdkClient!.trade.getTradesBySeller(walletPubkey)

    const allTrades = [...buyerTrades, ...sellerTrades]
    // Remove duplicates
    const uniqueTrades = Array.from(new Map(allTrades.map((t) => [t.publicKey.toBase58(), t])).values())

    return uniqueTrades.filter((t) => states.includes(this.convertTradeStateToApp(t.account.state))).length
  }

  /**
   * Fetch all fiats trades count
   */
  async fetchAllFiatsTradesCount(states: string[]): Promise<Array<{ fiat: string; count: number }>> {
    this.requireWallet()

    const walletPubkey = new PublicKey(this.walletAddress)
    const buyerTrades = await this.sdkClient!.trade.getTradesByBuyer(walletPubkey)
    const sellerTrades = await this.sdkClient!.trade.getTradesBySeller(walletPubkey)

    const allTrades = [...buyerTrades, ...sellerTrades]
    const uniqueTrades = Array.from(new Map(allTrades.map((t) => [t.publicKey.toBase58(), t])).values())

    const counts = new Map<string, number>()
    for (const trade of uniqueTrades) {
      const state = this.convertTradeStateToApp(trade.account.state)
      if (states.includes(state)) {
        const fiat = bytesToFiat(trade.account.fiatCurrency as number[])
        counts.set(fiat, (counts.get(fiat) || 0) + 1)
      }
    }

    return Array.from(counts.entries()).map(([fiat, count]) => ({ fiat, count }))
  }

  /**
   * Fetch disputed trades
   */
  async fetchDisputedTrades(
    limit: number,
    last?: number
  ): Promise<{ openDisputes: TradeInfo[]; closedDisputes: TradeInfo[] }> {
    this.requireWallet()

    const walletPubkey = new PublicKey(this.walletAddress)
    const buyerTrades = await this.sdkClient!.trade.getTradesByBuyer(walletPubkey)
    const sellerTrades = await this.sdkClient!.trade.getTradesBySeller(walletPubkey)

    const allTrades = [...buyerTrades, ...sellerTrades]
    const uniqueTrades = Array.from(new Map(allTrades.map((t) => [t.publicKey.toBase58(), t])).values())

    const disputedTrades = uniqueTrades.filter(
      (t) => t.account.state === SdkTradeState.Disputed || t.account.state === SdkTradeState.DisputeResolved
    )

    const tradeInfos = await Promise.all(disputedTrades.map((t) => this.buildTradeInfo(t.account)))

    return {
      openDisputes: tradeInfos.filter((t) => t.trade.state === 'escrow_disputed'),
      closedDisputes: tradeInfos.filter(
        (t) => t.trade.state === 'settled_for_maker' || t.trade.state === 'settled_for_taker'
      ),
    }
  }

  /**
   * Fetch trade detail
   */
  async fetchTradeDetail(tradeId: number): Promise<TradeInfo> {
    this.requireClient()

    const trade = await this.sdkClient!.trade.getTrade(new BN(tradeId))
    if (!trade) {
      throw new DefaultError(`Trade not found: ${tradeId}`)
    }

    return this.buildTradeInfo(trade)
  }

  /**
   * Accept trade request (seller)
   */
  async acceptTradeRequest(tradeId: number, makerContact: string): Promise<void> {
    this.requireWallet()

    await this.sdkClient!.trade.acceptTrade(new BN(tradeId), {
      sellerContact: makerContact,
    })
  }

  /**
   * Cancel trade request
   */
  async cancelTradeRequest(tradeId: number): Promise<void> {
    this.requireWallet()

    await this.sdkClient!.trade.cancelTrade(new BN(tradeId))
  }

  /**
   * Fund escrow
   */
  async fundEscrow(tradeInfo: TradeInfo, maker_contact?: string): Promise<void> {
    this.requireWallet()

    const tokenMint = this.getMintAddressFromDenom(tradeInfo.offer.offer.denom)
    await this.sdkClient!.trade.fundEscrow(new BN(tradeInfo.trade.id), tokenMint)
  }

  /**
   * Set fiat deposited (buyer confirmation)
   */
  async setFiatDeposited(tradeId: number): Promise<void> {
    this.requireWallet()

    await this.sdkClient!.trade.confirmFiatDeposit(new BN(tradeId))
  }

  /**
   * Release escrow (seller releases tokens to buyer)
   */
  async releaseEscrow(tradeId: number): Promise<void> {
    this.requireWallet()

    const trade = await this.sdkClient!.trade.getTrade(new BN(tradeId))
    if (!trade) {
      throw new DefaultError(`Trade not found: ${tradeId}`)
    }

    const tokenMint = trade.tokenMint as PublicKey
    const buyer = trade.buyer as PublicKey

    // Get recipient (buyer) token account
    const recipientTokenAccount = await getAssociatedTokenAddress(tokenMint, buyer)

    // Get treasury and warchest from hub config
    const hubConfig = await this.sdkClient!.hub.getConfig()
    if (!hubConfig) {
      throw new DefaultError('Hub not initialized')
    }

    // Treasury and warchest are PDAs, so we need allowOwnerOffCurve = true
    const treasuryTokenAccount = await getAssociatedTokenAddress(tokenMint, hubConfig.treasury as PublicKey, true)
    const warchestTokenAccount = await getAssociatedTokenAddress(tokenMint, hubConfig.warchest as PublicKey, true)

    await this.sdkClient!.trade.releaseEscrow(
      new BN(tradeId),
      tokenMint,
      recipientTokenAccount,
      treasuryTokenAccount,
      warchestTokenAccount
    )
  }

  /**
   * Refund escrow (return tokens to depositor)
   */
  async refundEscrow(tradeId: number): Promise<void> {
    this.requireWallet()

    const trade = await this.sdkClient!.trade.getTrade(new BN(tradeId))
    if (!trade) {
      throw new DefaultError(`Trade not found: ${tradeId}`)
    }

    const tokenMint = trade.tokenMint as PublicKey
    const seller = trade.seller as PublicKey

    const depositorTokenAccount = await getAssociatedTokenAddress(tokenMint, seller)

    await this.sdkClient!.trade.refundTrade(new BN(tradeId), tokenMint, depositorTokenAccount)
  }

  // ==================== Arbitration Methods ====================

  /**
   * Open a dispute
   */
  async openDispute(tradeId: number, buyerContact: string, sellerContact: string): Promise<void> {
    this.requireWallet()

    // Get trade to find appropriate arbitrator
    const trade = await this.sdkClient!.trade.getTrade(new BN(tradeId))
    if (!trade) {
      throw new DefaultError(`Trade not found: ${tradeId}`)
    }

    // Get arbitrators for the trade's fiat currency
    const fiat = bytesToFiat(trade.fiatCurrency as number[])
    const arbitrators = await this.sdkClient!.arbitrator.getArbitratorsByFiatCurrency(fiat)

    if (arbitrators.length === 0) {
      throw new DefaultError(`No arbitrators available for ${fiat}`)
    }

    // Use the first available arbitrator
    const arbitratorPubkey = arbitrators[0].account.pubkey as PublicKey

    await this.sdkClient!.trade.initiateDispute(new BN(tradeId), arbitratorPubkey)
  }

  /**
   * Settle a dispute (arbitrator only)
   */
  async settleDispute(tradeId: number, winner: string): Promise<void> {
    this.requireWallet()

    const trade = await this.sdkClient!.trade.getTrade(new BN(tradeId))
    if (!trade) {
      throw new DefaultError(`Trade not found: ${tradeId}`)
    }

    const fiat = bytesToFiat(trade.fiatCurrency as number[])
    const resolution = winner === 'buyer' ? DisputeResolution.BuyerWins : DisputeResolution.SellerWins

    await this.sdkClient!.arbitrator.resolveDispute(new BN(tradeId), resolution, fiat)
  }

  /**
   * Fetch all arbitrators
   */
  async fetchArbitrators(): Promise<Arbitrator[]> {
    this.requireClient()

    const arbitrators = await this.sdkClient!.arbitrator.getActiveArbitrators()

    return arbitrators.map((a) => ({
      arbitrator: (a.account.pubkey as PublicKey).toBase58(),
      fiat: bytesToFiat(a.account.fiatCurrency as number[]) as FiatCurrency,
      encryption_key: '', // Not stored in SDK arbitrator account
    }))
  }

  /**
   * Register new arbitrator
   */
  async newArbitrator(arbitrator: Arbitrator): Promise<void> {
    this.requireWallet()

    await this.sdkClient!.arbitrator.registerArbitrator(new PublicKey(arbitrator.arbitrator), arbitrator.fiat)
  }

  // ==================== Price Oracle Methods ====================

  /**
   * Update fiat price from oracle
   */
  async updateFiatPrice(fiat: FiatCurrency, denom: Denom): Promise<DenomFiatPrice> {
    this.requireClient()

    try {
      console.log('[SolanaChain] Fetching price for:', fiat)
      const priceAccount = await this.sdkClient!.priceOracle.getPrice(fiat)
      console.log('[SolanaChain] Price account result:', priceAccount)
      if (!priceAccount) {
        console.log('[SolanaChain] Price account is null')
        return {
          denom,
          fiat,
          price: 0,
          success: false,
        }
      }

      // Return raw price value - caller will format using formatFiatPrice
      const rawPrice = Number((priceAccount.value as BN).toString())
      console.log('[SolanaChain] Price raw value:', rawPrice)

      return {
        denom,
        fiat,
        price: rawPrice,
        success: true,
      }
    } catch (error) {
      console.error('Error fetching price:', error)
      return {
        denom,
        fiat,
        price: 0,
        success: false,
      }
    }
  }

  /**
   * Batch update fiat prices
   */
  async batchUpdateFiatPrices(fiats: FiatCurrency[], denom: Denom): Promise<DenomFiatPrice[]> {
    return Promise.all(fiats.map((fiat) => this.updateFiatPrice(fiat, denom)))
  }

  /**
   * Fetch fiat to USD rate
   */
  async fetchFiatToUsdRate(fiat: FiatCurrency): Promise<number> {
    this.requireClient()

    try {
      const priceAccount = await this.sdkClient!.priceOracle.getPrice(fiat)
      if (!priceAccount) {
        return 1 // Default to 1:1 if not found
      }

      // Price is stored as fiat per USD with 8 decimals
      return this.formatFiatPrice((priceAccount.value as BN).toString())
    } catch {
      return 1
    }
  }

  /**
   * Format raw fiat price from oracle
   *
   * Solana SDK stores prices with 8 decimals
   */
  formatFiatPrice(rawPrice: string | number): number {
    const price = typeof rawPrice === 'string' ? Number(rawPrice) : rawPrice
    return price / Math.pow(10, PRICE_DECIMALS)
  }

  // ==================== Private Helper Methods ====================

  private requireClient(): void {
    if (!this.sdkClient) {
      throw new DefaultError('Chain not initialized. Call init() first.')
    }
  }

  private requireWallet(): void {
    this.requireClient()
    if (!this.walletAddress || !this.walletAdapter) {
      throw new WalletNotConnected('Wallet not connected')
    }
  }

  private updateSdkClientWallet(wallet: PhantomSolanaAdapter | null): void {
    if (!this.sdkClient) return

    // Use SDK's built-in setWallet/clearWallet methods instead of recreating client
    if (wallet) {
      this.sdkClient.setWallet(wallet)
    } else {
      this.sdkClient.clearWallet()
    }
  }

  private updateHubConfigFromChain(hubConfig: any): void {
    // Update local hub config with on-chain values
    this.hubInfo.hubConfig = {
      ...this.hubInfo.hubConfig,
      profile_addr: (hubConfig.profileProgram as PublicKey).toBase58(),
      offer_addr: (hubConfig.offerProgram as PublicKey).toBase58(),
      trade_addr: (hubConfig.tradeProgram as PublicKey).toBase58(),
      price_addr: (hubConfig.priceOracleProgram as PublicKey).toBase58(),
      arbitration_fee_pct: hubConfig.arbitratorFeePct / 10000,
      burn_fee_pct: hubConfig.burnFeePct / 10000,
      chain_fee_pct: hubConfig.chainFeePct / 10000,
      warchest_fee_pct: hubConfig.warchestFeePct / 10000,
      active_offers_limit: hubConfig.maxActiveOffers,
      active_trades_limit: hubConfig.maxActiveTrades,
      trade_expiration_timer: (hubConfig.tradeExpirationTimer as BN).toNumber(),
      trade_limit_min: (hubConfig.minTradeAmount as BN).toNumber(),
      trade_limit_max: (hubConfig.maxTradeAmount as BN).toNumber(),
    }
  }

  private async fetchMakerProfile(maker: Addr): Promise<Profile> {
    try {
      return await this.fetchProfile(maker)
    } catch {
      return this.createDefaultProfile(maker)
    }
  }

  private createDefaultProfile(address: string): Profile {
    return {
      addr: address,
      created_at: Math.floor(Date.now() / 1000),
      requested_trades_count: 0,
      released_trades_count: 0,
      last_trade: 0,
      active_offers_count: 0,
      active_trades_count: 0,
    }
  }

  private convertProfileFromSdk(profile: UserProfileAccount, address: string): Profile {
    return {
      addr: address,
      created_at: (profile.createdAt as BN).toNumber(),
      requested_trades_count: (profile.totalTrades as BN).toNumber(),
      released_trades_count: (profile.completedTrades as BN).toNumber(),
      last_trade: (profile.updatedAt as BN).toNumber(),
      contact: profile.contactInfo,
      encryption_key: profile.encryptionKey,
      active_offers_count: profile.activeOffers,
      active_trades_count: profile.activeTrades,
    }
  }

  private convertOfferFromSdk(offer: OfferAccount): GetOffer {
    // Rate is stored multiplied by 100 (parseRate), so divide to get original value
    const storedRate = (offer.rate as BN).toNumber()
    const originalRate = storedRate / 100
    return {
      id: (offer.id as BN).toNumber(),
      state: this.convertOfferStateToApp(offer.state) as OfferState,
      rate: originalRate.toString(),
      min_amount: (offer.minAmount as BN).toString(),
      max_amount: (offer.maxAmount as BN).toString(),
      owner: (offer.owner as PublicKey).toBase58(),
      offer_type: (offer.offerType === SdkOfferType.Buy ? 'buy' : 'sell') as OfferType,
      denom: { native: (offer.tokenMint as PublicKey).toBase58() },
      description: offer.description as string,
      fiat_currency: bytesToFiat(offer.fiatCurrency as number[]) as FiatCurrency,
      timestamp: (offer.createdAt as BN).toNumber(),
    }
  }

  private convertOfferStateToApp(state: SdkOfferState): string {
    switch (state) {
      case SdkOfferState.Active:
        return 'active'
      case SdkOfferState.Paused:
        return 'paused'
      case SdkOfferState.Deleted:
        return 'archive'
      default:
        return 'active'
    }
  }

  private convertTradeStateToApp(state: SdkTradeState): TradeState {
    const mapping: Record<SdkTradeState, TradeState> = {
      [SdkTradeState.RequestCreated]: 'request_created',
      [SdkTradeState.RequestAccepted]: 'request_accepted',
      [SdkTradeState.EscrowFunded]: 'escrow_funded',
      [SdkTradeState.FiatDeposited]: 'fiat_deposited',
      [SdkTradeState.EscrowReleased]: 'escrow_released',
      [SdkTradeState.RequestCanceled]: 'request_canceled',
      [SdkTradeState.RequestExpired]: 'request_expired',
      [SdkTradeState.EscrowRefunded]: 'escrow_refunded',
      [SdkTradeState.Disputed]: 'escrow_disputed',
      [SdkTradeState.DisputeResolved]: 'settled_for_maker', // Default, actual winner determined elsewhere
    }
    return mapping[state] || 'request_created'
  }

  private async buildTradeInfo(trade: TradeAccount): Promise<TradeInfo> {
    const offerId = (trade.offerId as BN).toNumber()
    const offer = await this.fetchOffer(offerId.toString())

    const now = Math.floor(Date.now() / 1000)
    const expiresAt = (trade.expiresAt as BN).toNumber()

    const appTrade: Trade = {
      id: (trade.id as BN).toNumber(),
      addr: '', // Not applicable on Solana
      factory_addr: '', // Not applicable
      buyer: (trade.buyer as PublicKey).toBase58(),
      buyer_contact: trade.buyerContact,
      seller: (trade.seller as PublicKey).toBase58(),
      seller_contact: trade.sellerContact,
      seller_encryption_key: '', // TODO: Get from profile
      arbitrator: trade.arbitrator ? (trade.arbitrator as PublicKey).toBase58() : null,
      arbitrator_encryption_key: '',
      offer_contract: '',
      offer_id: offerId,
      created_at: (trade.createdAt as BN).toNumber(),
      expires_at: expiresAt,
      amount: (trade.amount as BN).toString(),
      denom: { native: (trade.tokenMint as PublicKey).toBase58() },
      denom_fiat_price: (trade.fiatAmount as BN).toNumber() / 100,
      state: this.convertTradeStateToApp(trade.state),
      state_history: this.buildStateHistory(trade),
      fiat: bytesToFiat(trade.fiatCurrency as number[]) as FiatCurrency,
    }

    return {
      trade: appTrade,
      offer,
      expired: now > expiresAt,
    }
  }

  private buildStateHistory(trade: TradeAccount): TradeStateItem[] {
    // SDK doesn't store state history, so we construct minimal history
    const history: TradeStateItem[] = []
    const createdAt = (trade.createdAt as BN).toNumber()
    const updatedAt = (trade.updatedAt as BN).toNumber()

    // Always start with created
    history.push({
      actor: (trade.buyer as PublicKey).toBase58(),
      state: 'request_created' as TradeState,
      timestamp: createdAt,
    })

    // Add current state if different
    if (trade.state !== SdkTradeState.RequestCreated) {
      const actor =
        trade.state === SdkTradeState.RequestAccepted || trade.state === SdkTradeState.EscrowFunded
          ? (trade.seller as PublicKey).toBase58()
          : (trade.buyer as PublicKey).toBase58()

      history.push({
        actor,
        state: this.convertTradeStateToApp(trade.state),
        timestamp: updatedAt,
      })
    }

    return history
  }

  private async ensureProfile(contact: string, encryptionKey: string): Promise<void> {
    this.requireWallet()

    const profile = await this.sdkClient!.profile.getMyProfile()
    if (!profile) {
      await this.sdkClient!.profile.createProfile({
        contactInfo: contact,
        encryptionKey: encryptionKey,
      })
    }
  }

  private parseAmount(amount: string): BN {
    // Parse string amount to BN with TOKEN_DECIMALS
    const value = parseFloat(amount)
    const multiplier = Math.pow(10, TOKEN_DECIMALS)
    return new BN(Math.floor(value * multiplier))
  }

  private parseRate(rate: string): BN {
    // Rate is stored as cents (integer)
    const value = parseFloat(rate)
    return new BN(Math.floor(value * 100))
  }

  private getDenomString(denom: Denom): string {
    if ('native' in denom) {
      return denom.native
    }
    if ('cw20' in denom) {
      return denom.cw20
    }
    return 'unknown'
  }

  private getMintAddressFromDenom(denom: Denom): PublicKey {
    const denomStr = this.getDenomString(denom)
    try {
      return new PublicKey(denomStr)
    } catch {
      // If not a valid public key, use default USDC
      return new PublicKey(this.hubInfo.hubConfig.local_denom.native)
    }
  }
}
