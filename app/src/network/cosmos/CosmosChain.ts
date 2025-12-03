/* eslint-disable no-console */
import { CosmWasmClient, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import type { AccountData, OfflineSigner } from '@cosmjs/launchpad'
import { Decimal } from '@cosmjs/math'
import type { OfflineDirectSigner } from '@cosmjs/proto-signing'
import type { Coin } from '@cosmjs/stargate'
import type { Chain } from '~/network/Chain'
import { DefaultError, WalletNotConnected, WalletNotInstalled } from '~/network/chain-error'
import { extractOfferId, extractTradeId } from './utils/events'
import type { CosmosConfig, HubInfo } from '~/network/cosmos/config'
import {
  FiatCurrency,
} from '~/types/components.interface'
import type {
  Addr,
  Arbitrator,
  Denom,
  DenomFiatPrice,
  FetchOffersArgs,
  HubConfig,
  NewTrade,
  OfferResponse,
  PatchOffer,
  PostOffer,
  Profile,
  TradeInfo,
} from '~/types/components.interface'
import { denomToValue } from '~/utils/denom'

export class CosmosChain implements Chain {
  public config: CosmosConfig
  protected hubInfo: HubInfo

  protected signer?: OfflineSigner | OfflineDirectSigner
  protected account?: AccountData
  protected cwClient?: CosmWasmClient | SigningCosmWasmClient

  constructor(config: CosmosConfig, hubInfo: HubInfo) {
    this.config = config
    this.hubInfo = hubInfo
  }

  async init() {
    this.cwClient = await CosmWasmClient.connect(this.config.rpcUrl)
    this.hubInfo.hubConfig = (await this.cwClient.queryContractSmart(this.hubInfo.hubAddress, {
      config: {},
    })) as HubConfig
    // console.log("Factory config >> ", this.hubInfo.hubConfig)
  }

  getName() {
    return this.config.chainName
  }

  getChainType() {
    return 'cosmos'
  }

  async connectWallet() {
    if (!window.getOfflineSigner || !window.keplr || !window.getOfflineSignerAuto) {
      throw new WalletNotInstalled()
    } else {
      await CosmosChain.suggestChain(this.config)
      await window.keplr.enable(this.config.chainId)
      this.signer = await window.getOfflineSignerAuto(this.config.chainId)
      this.cwClient = await SigningCosmWasmClient.connectWithSigner(this.config.rpcUrl, this.signer, {
        gasPrice: {
          amount: Decimal.fromUserInput('0.0025', 100),
          denom: this.config.coinMinimalDenom,
        },
      })
      // get first account
      ;[this.account] = await this.signer.getAccounts()
    }
  }

  async disconnectWallet() {
    this.cwClient?.disconnect()
    this.account = undefined
    this.signer = undefined
  }

  getHubConfig(): HubConfig {
    return this.hubInfo.hubConfig
  }

  getWalletAddress(): string {
    return this.account ? this.account.address : 'undefined'
  }

  async fetchProfile(profile_addr?: Addr) {
    if (!this.cwClient) {
      await this.init()
    }
    try {
      const addr = profile_addr === undefined ? this.getWalletAddress() : profile_addr
      const result = (await this.cwClient!.queryContractSmart(this.hubInfo.hubConfig.profile_addr, {
        profile: { addr },
      })) as Profile
      console.log('Profile result >> ', result)
      return result
    } catch (e) {
      throw DefaultError.fromError(e)
    }
  }

  async fetchTokenBalance(denom: Denom) {
    if (this.cwClient instanceof SigningCosmWasmClient && this.signer) {
      try {
        const balance = await this.cwClient.getBalance(this.getWalletAddress(), denomToValue(denom))
        console.log(`balance: `, balance)
        return balance
      } catch (e) {
        throw DefaultError.fromError(e)
      }
    } else {
      throw new WalletNotConnected()
    }
  }

  // TODO encrypt the postOffer.owner_contact field
  async createOffer(postOffer: PostOffer) {
    // Ensure all numeric values are properly formatted as integer strings for Uint128
    const rateNum = Number(postOffer.rate)
    const minAmountNum = Number(postOffer.min_amount)
    const maxAmountNum = Number(postOffer.max_amount)
    
    // Check for NaN or invalid values
    if (isNaN(rateNum) || rateNum <= 0) {
      throw new Error(`Invalid rate value: ${postOffer.rate}`)
    }
    if (isNaN(minAmountNum) || minAmountNum < 0) {
      throw new Error(`Invalid min_amount value: ${postOffer.min_amount}`)
    }
    if (isNaN(maxAmountNum) || maxAmountNum <= 0) {
      throw new Error(`Invalid max_amount value: ${postOffer.max_amount}`)
    }
    
    const formattedOffer = {
      ...postOffer,
      rate: Math.floor(rateNum).toString(),
      min_amount: Math.floor(minAmountNum).toString(),
      max_amount: Math.floor(maxAmountNum).toString(),
    }
    const msg = { create: { offer: formattedOffer } }
    console.log('Create offer msg >> ', msg)
    if (this.cwClient instanceof SigningCosmWasmClient && this.signer) {
      try {
        const result = await this.cwClient.execute(
          this.getWalletAddress(),
          this.hubInfo.hubConfig.offer_addr,
          msg,
          'auto'
        )
        console.log('Create offer result >> ', result)
        const offer_id = extractOfferId(result)
        if (!offer_id) {
          console.warn('Could not extract offer ID from transaction events')
          // Return a default or throw an error depending on requirements
          throw new Error('Could not read offer ID from transaction events')
        }
        return offer_id
      } catch (e) {
        throw DefaultError.fromError(e)
      }
    } else {
      throw new WalletNotConnected()
    }
  }

  // TODO encrypt the postOffer.owner_contact field
  async updateOffer(updateOffer: PatchOffer) {
    // Ensure all numeric values are properly formatted as integer strings for Uint128
    const rateNum = Number(updateOffer.rate)
    const minAmountNum = Number(updateOffer.min_amount)
    const maxAmountNum = Number(updateOffer.max_amount)
    
    // Check for NaN or invalid values
    if (isNaN(rateNum) || rateNum <= 0) {
      throw new Error(`Invalid rate value: ${updateOffer.rate}`)
    }
    if (isNaN(minAmountNum) || minAmountNum < 0) {
      throw new Error(`Invalid min_amount value: ${updateOffer.min_amount}`)
    }
    if (isNaN(maxAmountNum) || maxAmountNum <= 0) {
      throw new Error(`Invalid max_amount value: ${updateOffer.max_amount}`)
    }
    
    const formattedUpdate = {
      ...updateOffer,
      rate: Math.floor(rateNum).toString(),
      min_amount: Math.floor(minAmountNum).toString(),
      max_amount: Math.floor(maxAmountNum).toString(),
    }
    const msg = { update_offer: { offer_update: formattedUpdate } }
    console.log('Update offer msg >> ', msg)
    if (this.cwClient instanceof SigningCosmWasmClient && this.signer) {
      try {
        const result = await this.cwClient.execute(
          this.getWalletAddress(),
          this.hubInfo.hubConfig.offer_addr,
          msg,
          'auto'
        )
        console.log('Update offer result >> ', result)
      } catch (e) {
        throw DefaultError.fromError(e)
      }
    } else {
      throw new WalletNotConnected()
    }
  }

  async fetchMyOffers(limit = 100, last?: number) {
    if (this.cwClient instanceof SigningCosmWasmClient) {
      try {
        return (await this.cwClient.queryContractSmart(this.hubInfo.hubConfig.offer_addr, {
          offers_by_owner: {
            owner: this.getWalletAddress(),
            limit,
            last,
          },
        })) as OfferResponse[]
      } catch (e) {
        throw DefaultError.fromError(e)
      }
    } else {
      throw new WalletNotConnected()
    }
  }

  async fetchMakerOffers(maker: Addr): Promise<OfferResponse[]> {
    if (!this.cwClient) {
      await this.init()
    }
    try {
      return (await this.cwClient!.queryContractSmart(this.hubInfo.hubConfig.offer_addr, {
        offers_by_owner: {
          owner: maker,
          limit: 1000,
        },
      })) as OfferResponse[]
    } catch (e) {
      throw DefaultError.fromError(e)
    }
  }

  async fetchOffer(offerId: string): Promise<OfferResponse> {
    // TODO: fix init
    if (!this.cwClient) {
      await this.init()
    }
    try {
      const queryMsg = { offer: { id: offerId } }
      const response = (await this.cwClient!.queryContractSmart(
        this.hubInfo.hubConfig.offer_addr,
        queryMsg
      )) as OfferResponse
      console.log('response >>> ', response)
      return response
    } catch (e) {
      throw DefaultError.fromError(e)
    }
  }

  async fetchOffersCountByStates(states: string[]) {
    if (!this.cwClient) {
      await this.init()
    }
    try {
      const result = (await this.cwClient!.queryContractSmart(this.hubInfo.hubConfig.offer_addr, {
        offers_count_by_states: { states }
      })) as { count: number }
      return result.count
    } catch (e) {
      throw DefaultError.fromError(e)
    }
  }

  async fetchAllFiatsOffersCount(states: string[]) {
    if (!this.cwClient) {
      await this.init()
    }
    try {
      const result = (await this.cwClient!.queryContractSmart(this.hubInfo.hubConfig.offer_addr, {
        all_fiats_offers_count: { states }
      })) as Array<{ fiat: string; count: number }>
      return result
    } catch (e) {
      throw DefaultError.fromError(e)
    }
  }

  async fetchAllOffers(limit = 1000, last?: number) {
    // TODO: fix init
    if (!this.cwClient) {
      await this.init()
    }
    try {
      // We need to fetch offers for each combination of offer_type and fiat_currency
      // Since the contract requires these parameters, we'll fetch common combinations
      const allOffers: OfferResponse[] = []
      const offerTypes = ['buy', 'sell']
      
      // Fetch for each offer type with no specific fiat currency filter
      // We'll use USD as a placeholder but fetch all
      for (const offerType of offerTypes) {
        try {
          const queryMsg = {
            offers_by: {
              offer_type: offerType,
              fiat_currency: null, // Try with null to get all
              denom: null,
              order: 'trades_count',
              limit,
              last,
            },
          }
          const response = (await this.cwClient!.queryContractSmart(
            this.hubInfo.hubConfig.offer_addr,
            queryMsg
          )) as OfferResponse[]
          allOffers.push(...response)
        } catch (e) {
          // If null doesn't work, we need to fetch with specific values
          console.log(`Could not fetch ${offerType} offers with null fiat, trying with USD`)
        }
      }
      
      // If we couldn't get offers with null, return empty array
      // The contract seems to require specific parameters
      console.log('All offers fetched:', allOffers.length)
      return allOffers
    } catch (e) {
      throw DefaultError.fromError(e)
    }
  }

  async fetchOffers(args: FetchOffersArgs, limit = 100, last?: number) {
    // TODO: fix init
    if (!this.cwClient) {
      await this.init()
    }
    try {
      const queryMsg = {
        offers_by: {
          fiat_currency: args.fiatCurrency,
          offer_type: args.offerType ? args.offerType.toLowerCase() : undefined, // Convert to lowercase for contract (buy/sell)
          denom: args.denom,
          order: args.order, // Keep as-is (trades_count/price_rate)
          limit,
          last,
        },
      }
      const response = (await this.cwClient!.queryContractSmart(
        this.hubInfo.hubConfig.offer_addr,
        queryMsg
      )) as OfferResponse[]
      console.log('response >>> ', response)
      return response
    } catch (e) {
      throw DefaultError.fromError(e)
    }
  }

  async openTrade(trade: NewTrade) {
    const msg = { create: trade }
    console.log('Open Trade msg >> ', msg)
    if (this.cwClient instanceof SigningCosmWasmClient && this.signer) {
      try {
        const result = await this.cwClient.execute(
          this.getWalletAddress(),
          this.hubInfo.hubConfig.trade_addr,
          msg,
          'auto'
        )
        console.log('Open Trade result >> ', result)
        const trade_id = extractTradeId(result)
        if (!trade_id) {
          console.warn('Could not extract trade ID from transaction events')
          // Return a default or throw an error depending on requirements
          throw new Error('Could not read trade ID from transaction events')
        }
        return trade_id
      } catch (e) {
        throw DefaultError.fromError(e)
      }
    } else {
      throw new WalletNotConnected()
    }
  }

  // TODO maybe we can do a single trades_query
  async fetchTrades(limit = 100, last?: number) {
    if (this.cwClient instanceof SigningCosmWasmClient) {
      const userAddr = this.getWalletAddress()
      // TODO fix init
      if (!this.cwClient) {
        await this.init()
      }
      try {
        // Query of trades as buyer
        const response = (await this.cwClient!.queryContractSmart(this.hubInfo.hubConfig.trade_addr, {
          trades: { user: userAddr, role: 'trader', limit, last },
        })) as TradeInfo[]
        console.log('response >>> ', response)
        return response
      } catch (e) {
        throw DefaultError.fromError(e)
      }
    } else {
      throw new WalletNotConnected()
    }
  }
  
  async fetchTradesCountByStates(states: string[]) {
    if (!this.cwClient) {
      await this.init()
    }
    try {
      const result = (await this.cwClient!.queryContractSmart(this.hubInfo.hubConfig.trade_addr, {
        trades_count_by_states: { states }
      })) as { count: number }
      return result.count
    } catch (e) {
      throw DefaultError.fromError(e)
    }
  }

  async fetchAllFiatsTradesCount(states: string[]) {
    if (!this.cwClient) {
      await this.init()
    }
    try {
      const result = (await this.cwClient!.queryContractSmart(this.hubInfo.hubConfig.trade_addr, {
        all_fiats_trades_count: { states }
      })) as Array<{ fiat: string; count: number }>
      return result
    } catch (e) {
      throw DefaultError.fromError(e)
    }
  }

  async fetchDisputedTrades(
    limit = 100,
    last?: number
  ): Promise<{ openDisputes: TradeInfo[]; closedDisputes: TradeInfo[] }> {
    if (this.cwClient instanceof SigningCosmWasmClient) {
      const userAddr = this.getWalletAddress()
      // TODO fix init
      if (!this.cwClient) {
        await this.init()
      }
      try {
        // Query of trades as buyer
        const queryMsg = { trades: { user: userAddr, role: 'arbitrator', limit, last } }
        const disputedTrades = (await this.cwClient!.queryContractSmart(
          this.hubInfo.hubConfig.trade_addr,
          queryMsg
        )) as TradeInfo[]
        const openDisputes = disputedTrades.filter((t) => t.trade.state === 'escrow_disputed')
        const closedDisputes = disputedTrades.filter((t) => t.trade.state !== 'escrow_disputed')
        const response: { openDisputes: TradeInfo[]; closedDisputes: TradeInfo[] } = { openDisputes, closedDisputes }
        console.log('response >>> ', response)
        return response
      } catch (e) {
        throw DefaultError.fromError(e)
      }
    } else {
      throw new WalletNotConnected()
    }
  }

  async fetchTradeDetail(tradeId: number) {
    // TODO fix init
    if (!this.cwClient) {
      await this.init()
    }
    try {
      const response = (await this.cwClient!.queryContractSmart(this.hubInfo.hubConfig.trade_addr, {
        trade: { id: tradeId },
      })) as TradeInfo
      return response
    } catch (e) {
      throw DefaultError.fromError(e)
    }
  }

  async fetchArbitrators() {
    // TODO: fix init
    if (!this.cwClient) {
      await this.init()
    }
    try {
      const queryMsg = {
        arbitrators: {
          limit: 100,
        },
      }
      const response = (await this.cwClient!.queryContractSmart(
        this.hubInfo.hubConfig.trade_addr,
        queryMsg
      )) as Arbitrator[]
      console.log('response >>> ', response)
      return response
    } catch (e) {
      throw DefaultError.fromError(e)
    }
  }

  async fetchOpenDisputes() {
    // TODO: fix init
    if (!this.cwClient) {
      await this.init()
    }
    try {
      const queryMsg = {
        trades: {
          user: this.getWalletAddress(),
          role: 'arbitrator',
          limit: 100,
        },
      }
      const response = (await this.cwClient!.queryContractSmart(
        this.hubInfo.hubConfig.trade_addr,
        queryMsg
      )) as TradeInfo[]
      console.log('response >>> ', response)
      return response
    } catch (e) {
      throw DefaultError.fromError(e)
    }
  }

  async fetchFiatToUsdRate(fiat: FiatCurrency): Promise<number> {
    if (!this.cwClient) {
      await this.init()
    }
    
    // If it's already USD, return 1:1 rate
    if (fiat === FiatCurrency.USD || fiat === 'USD') {
      return 100 // 100 cents = 1 USD
    }
    
    // Check if price oracle is configured
    if (!this.hubInfo.hubConfig.price_addr) {
      return 0
    }
    
    try {
      const queryMsg = { get_fiat_price: { currency: fiat } }
      
      const response = await this.cwClient!.queryContractSmart(
        this.hubInfo.hubConfig.price_addr,
        queryMsg
      )
      
      if (response && response.usd_price) {
        // Cosmos returns how many cents of fiat equal 1 USD (with 2 decimals)
        // For example, COP = 405188 means 1 USD = 4051.88 COP
        // This is already in the correct format for our use
        const rate = Number(response.usd_price)
        if (rate > 0) {
          return rate
        }
      }
      
      // No valid price found in contract
      return 0 // Return 0 to indicate no rate available
    } catch (e: any) {
      // Return 0 to indicate no exchange rate is available
      // The frontend should handle this case appropriately
      return 0
    }
  }

  formatFiatPrice(rawPrice: string | number): number {
    // Cosmos returns prices with 2 decimal places (cents)
    // Example: 405607 means 1 USD = 4056.07 COP
    // Example: 86 means 1 USD = 0.86 EUR
    const priceAsNumber = typeof rawPrice === 'string' ? parseInt(rawPrice) : rawPrice
    return priceAsNumber / 100 // Convert cents to decimal value
  }

  async updateFiatPrice(fiat: FiatCurrency, denom: Denom): Promise<DenomFiatPrice> {
    if (!this.cwClient) {
      await this.init()
    }
    
    // Check if price oracle is configured
    if (!this.hubInfo.hubConfig.price_addr) {
      console.warn(`[CosmosChain.updateFiatPrice] Price oracle address not configured for ${this.config.chainName}`)
      throw new Error('Price oracle not configured')
    }
    
    try {
      const queryMsg = { price: { fiat, denom } }
      console.log(`[CosmosChain.updateFiatPrice] Querying price for ${fiat} with denom`, denom, 'on', this.config.chainName)
      console.log(`[CosmosChain.updateFiatPrice] Query message:`, queryMsg)
      console.log(`[CosmosChain.updateFiatPrice] Price oracle address: ${this.hubInfo.hubConfig.price_addr}`)
      
      const response = (await this.cwClient!.queryContractSmart(
        this.hubInfo.hubConfig.price_addr,
        queryMsg
      )) as DenomFiatPrice
      
      console.log(`[CosmosChain.updateFiatPrice] Price response for ${fiat}:`, response)
      return response
    } catch (e: any) {
      console.log(`[CosmosChain.updateFiatPrice] Price query failed, checking for USDC special case...`)
      
      // Handle USDC special case: 1 USDC = 1 USD
      const denomStr = 'native' in denom ? denom.native : denom.cw20
      const isUSDC = denomStr === 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' ||
                     denomStr === 'usdc' ||
                     denomStr?.toLowerCase().includes('usdc')
      
      console.log(`[CosmosChain.updateFiatPrice] Denom string: ${denomStr}, is USDC: ${isUSDC}`)
      
      if (isUSDC && (e.message?.includes('No price route') || e.message?.includes('not found'))) {
        console.log(`[CosmosChain.updateFiatPrice] No price route for USDC, handling as 1:1 with USD`)
        
        // For USDC, we know 1 USDC = 1 USD = 100 cents
        let price = 100 // 100 cents = 1 USD
        
        // If the requested fiat is not USD, we need to convert
        if (fiat !== FiatCurrency.USD && fiat !== 'USD') {
          try {
            console.log(`[CosmosChain.updateFiatPrice] Converting USDC price to ${fiat}`)
            // Get the exchange rate from USD to the target fiat
            const exchangeRate = await this.fetchFiatToUsdRate(fiat)
            if (exchangeRate > 0) {
              // Convert USD price to target fiat
              // exchangeRate tells us how many cents of target fiat = 100 cents USD
              // So 1 USDC (100 cents USD) = exchangeRate cents of target fiat
              price = exchangeRate
              console.log(`[CosmosChain.updateFiatPrice] Converted USDC price from USD to ${fiat}: ${price} cents (rate: ${exchangeRate})`)
            } else {
              console.warn(`[CosmosChain.updateFiatPrice] No exchange rate available for ${fiat}, using USD price`)
            }
          } catch (err) {
            console.error(`[CosmosChain.updateFiatPrice] Failed to get exchange rate for ${fiat}, using USD price:`, err)
          }
        }
        
        return {
          price: price,
          denom: denom,
          fiat: fiat
        } as DenomFiatPrice
      }
      
      console.error(`[CosmosChain.updateFiatPrice] Failed to fetch price for ${fiat}:`, {
        chain: this.config.chainName,
        priceAddr: this.hubInfo.hubConfig.price_addr,
        denom,
        error: e?.message || e
      })
      throw DefaultError.fromError(e)
    }
  }

  async batchUpdateFiatPrices(fiats: FiatCurrency[], denom: Denom): Promise<DenomFiatPrice[]> {
    if (!this.cwClient) {
      await this.init()
    }
    
    // Check if price oracle is configured
    if (!this.hubInfo.hubConfig.price_addr) {
      console.warn(`[CosmosChain.batchUpdateFiatPrices] Price oracle address not configured for ${this.config.chainName}`)
      return []
    }
    
    console.log(`[CosmosChain.batchUpdateFiatPrices] Fetching prices for ${fiats.length} fiats with denom`, denom, 'on', this.config.chainName)
    console.log(`[CosmosChain.batchUpdateFiatPrices] Price oracle address: ${this.hubInfo.hubConfig.price_addr}`)
    
    // Create batch of query promises - these will be executed in parallel
    const queryPromises = fiats.map(fiat => {
      const queryMsg = { price: { fiat, denom } }
      console.log(`[CosmosChain.batchUpdateFiatPrices] Querying ${fiat}:`, queryMsg)
      
      return this.cwClient!.queryContractSmart(
        this.hubInfo.hubConfig.price_addr,
        queryMsg
      ).then(result => {
        console.log(`[CosmosChain.batchUpdateFiatPrices] Success for ${fiat}:`, result)
        return result
      }).catch(e => {
        console.log(`[CosmosChain.batchUpdateFiatPrices] Failed for ${fiat}, checking USDC special case:`, e.message)
        
        // Handle USDC special case: 1 USDC = 1 USD
        const denomStr = 'native' in denom ? denom.native : denom.cw20
        const isUSDC = denomStr === 'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013' ||
                      denomStr === 'usdc' ||
                      denomStr?.toLowerCase().includes('usdc')
        
        console.log(`[CosmosChain.batchUpdateFiatPrices] Denom string: ${denomStr}, is USDC: ${isUSDC}`)
        
        if (isUSDC && (e.message?.includes('No price route') || e.message?.includes('not found'))) {
          console.log(`[CosmosChain.batchUpdateFiatPrices] Using USDC special handling for ${fiat}`)
          // For USDC, we know 1 USDC = 1 USD
          // We need to use the exchange rate we already fetched
          if (fiat === FiatCurrency.USD || fiat === 'USD') {
            // 1 USDC = 1 USD = 100 cents
            return {
              price: 100,
              denom: denom,
              fiat: fiat
            } as DenomFiatPrice
          }
          
          // For non-USD, we should have already fetched the exchange rate
          // Return null here to trigger the fallback that uses exchange rates
          return null
        }
        
        // Return null for other errors
        console.error(`[CosmosChain.batchUpdateFiatPrices] Failed to fetch price for ${fiat}:`, {
          chain: this.config.chainName,
          priceAddr: this.hubInfo.hubConfig.price_addr,
          denom,
          error: e.message || e
        })
        return null
      })
    })
    
    // Execute all queries in parallel
    const results = await Promise.all(queryPromises)
    
    // Filter out null results and return
    const validResults = results.filter(r => r !== null) as DenomFiatPrice[]
    
    console.log(`[CosmosChain.batchUpdateFiatPrices] Returning ${validResults.length} valid results out of ${results.length} queries`)
    
    // If all results are null, log warning but still return empty array to trigger fallback
    if (results.every(r => r === null)) {
      console.warn(`[CosmosChain.batchUpdateFiatPrices] All price queries failed - check contract query format and oracle configuration`)
    }
    
    return validResults
  }

  // TODO encrypt maker_contact field
  async acceptTradeRequest(tradeId: number, makerContact: string) {
    await this.changeTradeState(this.hubInfo.hubConfig.trade_addr, {
      accept_request: { trade_id: tradeId, maker_contact: makerContact },
    })
  }

  async cancelTradeRequest(tradeId: number) {
    await this.changeTradeState(this.hubInfo.hubConfig.trade_addr, {
      cancel_request: { trade_id: tradeId },
    })
  }

  async fundEscrow(tradeInfo: TradeInfo, makerContact?: string) {
    const hubConfig = this.hubInfo.hubConfig
    
    // Parse amount as BigInt to avoid precision issues
    const baseAmount = BigInt(tradeInfo.trade.amount)
    console.log('base amount (microdenomination): ', baseAmount.toString())

    let fundAmount = baseAmount

    // If current user is the maker, add the fee to the amount to fund
    if (tradeInfo.offer.offer.owner === this.getWalletAddress()) {
      // Calculate fees using BigInt arithmetic to avoid precision issues
      // Fee percentages are stored as string decimals (e.g., "0.002" = 0.2%)
      // Convert to basis points (multiply by 10000) to avoid floating point issues
      const burnFeeBps = BigInt(Math.floor(Number(hubConfig.burn_fee_pct) * 10000))
      const chainFeeBps = BigInt(Math.floor(Number(hubConfig.chain_fee_pct) * 10000))
      const warchestFeeBps = BigInt(Math.floor(Number(hubConfig.warchest_fee_pct) * 10000))
      
      const burnAmount = (baseAmount * burnFeeBps) / BigInt(10000)
      const chainAmount = (baseAmount * chainFeeBps) / BigInt(10000)
      const warchestAmount = (baseAmount * warchestFeeBps) / BigInt(10000)
      const totalFee = burnAmount + chainAmount + warchestAmount
      
      console.log('burn fee:', burnAmount.toString())
      console.log('chain fee:', chainAmount.toString())
      console.log('warchest fee:', warchestAmount.toString())
      console.log('total fee:', totalFee.toString())
      
      fundAmount = baseAmount + totalFee
      console.log('amount + fees: ', fundAmount.toString())
    }

    const funds: Coin[] = [
      {
        amount: fundAmount.toString(),
        denom: denomToValue(tradeInfo.trade.denom),
      },
    ]
    console.log('funds', funds)
    await this.changeTradeState(
      this.hubInfo.hubConfig.trade_addr,
      { fund_escrow: { trade_id: tradeInfo.trade.id, maker_contact: makerContact } },
      funds
    )
  }

  async setFiatDeposited(tradeId: number) {
    await this.changeTradeState(this.hubInfo.hubConfig.trade_addr, {
      fiat_deposited: { trade_id: tradeId },
    })
  }

  async releaseEscrow(tradeId: number) {
    await this.changeTradeState(this.hubInfo.hubConfig.trade_addr, {
      release_escrow: { trade_id: tradeId },
    })
  }

  async refundEscrow(tradeId: number) {
    await this.changeTradeState(this.hubInfo.hubConfig.trade_addr, {
      refund_escrow: { trade_id: tradeId },
    })
  }

  async openDispute(tradeId: number, buyerContact: string, sellerContact: string) {
    await this.changeTradeState(this.hubInfo.hubConfig.trade_addr, {
      dispute_escrow: {
        trade_id: tradeId,
        buyer_contact: buyerContact,
        seller_contact: sellerContact,
      },
    })
  }

  private async changeTradeState(addr: string, msg: Record<string, unknown>, funds?: Coin[]) {
    console.log('Trade State >> ', msg)
    if (this.cwClient instanceof SigningCosmWasmClient && this.signer) {
      try {
        const result = await this.cwClient.execute(this.getWalletAddress(), addr, msg, 'auto', undefined, funds)
        console.log('Trade State result >> ', result)
      } catch (e) {
        throw DefaultError.fromError(e)
      }
    } else {
      throw new WalletNotConnected()
    }
  }

  async newArbitrator(arbitrator: Arbitrator) {
    const msg = { new_arbitrator: arbitrator }
    console.log('New Arbitrator msg >> ', msg)
    if (this.cwClient instanceof SigningCosmWasmClient && this.signer) {
      try {
        const result = await this.cwClient.execute(
          this.getWalletAddress(),
          this.hubInfo.hubConfig.trade_addr,
          msg,
          'auto'
        )
        console.log('New arbitrator result >> ', result)
      } catch (e) {
        throw DefaultError.fromError(e)
      }
    } else {
      throw new WalletNotConnected()
    }
  }

  async settleDispute(tradeId: number, winner: string) {
    const msg = { settle_dispute: { trade_id: tradeId, winner } }
    console.log('msg >> ', msg)
    if (this.cwClient instanceof SigningCosmWasmClient && this.signer) {
      try {
        const result = await this.cwClient.execute(
          this.getWalletAddress(),
          this.hubInfo.hubConfig.trade_addr,
          msg,
          'auto'
        )
        console.log('result >> ', result)
      } catch (e) {
        throw DefaultError.fromError(e)
      }
    } else {
      throw new WalletNotConnected()
    }
  }

  // TODO extract this method
  private static async suggestChain(config: CosmosConfig) {
    try {
      await window.keplr?.experimentalSuggestChain({
        // Chain-id of the Osmosis chain.
        chainId: config.chainId,
        // The name of the chain to be displayed to the user.
        chainName: config.chainName,
        // RPC endpoint of the chain. In this case we are using blockapsis, as it's accepts connections from any host currently. No Cors limitations.
        rpc: config.rpcUrl,
        // REST endpoint of the chain.
        rest: config.lcdUrl,
        // Staking coin information
        stakeCurrency: {
          // Coin denomination to be displayed to the user.
          coinDenom: config.coinDenom,
          // Actual denom (i.e. uatom, uscrt) used by the blockchain.
          coinMinimalDenom: config.coinMinimalDenom,
          // # of decimal points to convert minimal denomination to user-facing denomination.
          coinDecimals: config.coinDecimals,
        },
        bip44: {
          // You can only set the coin type of BIP44.
          // 'Purpose' is fixed to 44.
          coinType: 118,
        },
        bech32Config: {
          bech32PrefixAccAddr: `${config.addressPrefix}`,
          bech32PrefixAccPub: `${config.addressPrefix}pub`,
          bech32PrefixValAddr: `${config.addressPrefix}valoper`,
          bech32PrefixValPub: `${config.addressPrefix}valoperpub`,
          bech32PrefixConsAddr: `${config.addressPrefix}valcons`,
          bech32PrefixConsPub: `${config.addressPrefix}valconspub`,
        },
        // List of all coin/tokens used in this chain.
        currencies: [
          {
            coinDenom: config.coinDenom,
            coinMinimalDenom: config.coinMinimalDenom,
            coinDecimals: config.coinDecimals,
          },
        ],
        // List of coin/tokens used as a fee token in this chain.
        feeCurrencies: [
          {
            coinDenom: config.coinDenom,
            coinMinimalDenom: config.coinMinimalDenom,
            coinDecimals: config.coinDecimals,
          },
        ],
      })
    } catch (e) {
      console.log(e)
    }
  }
}
