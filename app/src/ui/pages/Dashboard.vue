<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useClientStore } from '~/stores/client'
import { Page, trackPage } from '~/analytics/analytics'
import type { Denom } from '~/types/components.interface'
import { getFiatInfo } from '~/utils/fiat'
import { denomToValue } from '~/utils/denom'
import { FiatCurrency, OfferState, TradeState } from '~/types/components.interface'

const client = useClientStore()
const { fiatPrices, offers, trades, myOffers, userWallet } = storeToRefs(client)

interface Stats {
  totalOffers: number
  activeOffers: number
  completedTrades: number
  activeTrades: number
}

interface PriceData {
  fiat: string
  price: number
  loading: boolean
}

interface FiatRanking {
  fiat: string
  activeOffers: number
  completedTrades: number
}

const stats = ref<Stats>({
  totalOffers: 0,
  activeOffers: 0,
  completedTrades: 0,
  activeTrades: 0,
})

const fiatRankings = ref<FiatRanking[]>([])

const currencyPrices = ref<PriceData[]>([])
const isLoading = ref(true)
const lastUpdated = ref(new Date())

const supportedFiats = [
  FiatCurrency.USD,
  FiatCurrency.EUR,
  FiatCurrency.GBP,
  FiatCurrency.CAD,
  FiatCurrency.ARS,
  FiatCurrency.BRL,
  FiatCurrency.CLP,
  FiatCurrency.COP,
  FiatCurrency.MXN,
  FiatCurrency.NGN,
  FiatCurrency.THB,
  FiatCurrency.VES,
  FiatCurrency.IDR,
  FiatCurrency.PHP,
  FiatCurrency.VND,
  FiatCurrency.MYR,
  FiatCurrency.SGD,
  FiatCurrency.ZAR,
  FiatCurrency.EGP,
  FiatCurrency.KES,
]

const denomOptions = [
  { value: 'uusdc', display: 'USDC' },
]

const selectedDenom = ref('uusdc')

async function fetchAllPrices() {
  const denom: Denom = { native: selectedDenom.value }
  
  // Sort currencies alphabetically
  const sortedFiats = [...supportedFiats].sort((a, b) => a.localeCompare(b))
  
  // Initialize currency prices with loading state
  currencyPrices.value = sortedFiats.map(fiat => ({
    fiat: fiat as string,
    price: 0,
    loading: true,
  }))

  try {
    // Use batched price fetching for better performance
    const results = await client.batchUpdateFiatPrices(sortedFiats, denom)
    
    // Get the denomination key
    const denomKey = denomToValue(denom)
    
    // Update the currency prices from the results directly
    if (results && results.length > 0) {
      currencyPrices.value = sortedFiats.map(fiat => {
        // Find the result for this fiat currency
        const result = results.find(r => r && r.fiat === fiat)
        if (result && result.success) {
          let priceValue = typeof result.price === 'string' ? parseInt(result.price) : result.price
          
          // Check if we're on an EVM chain or Cosmos chain by checking the client type
          const isEVMChain = client.client.constructor.name === 'EVMChain'
          
          if (isEVMChain) {
            // EVM returns raw prices with 8 decimals
            // Use the chain's formatFiatPrice method to convert properly
            const formattedPrice = client.client.formatFiatPrice(priceValue)
            // Convert to cents for consistent storage (100 cents = 1 USD)
            priceValue = Math.round(formattedPrice * 100)
          } else {
            // Cosmos returns prices already in cents (2 decimals where 100 = $1)
            // No conversion needed, price is already in cents
            priceValue = priceValue
          }
          
          return {
            fiat: fiat as string,
            price: priceValue,
            loading: false,
          }
        }
        
        // Fallback to store if not in results
        const priceMap = client.fiatPrices.get(fiat)
        const price = priceMap?.get(denomKey)
        return {
          fiat: fiat as string,
          price: typeof price === 'number' ? price : 0,
          loading: false,
        }
      })
    } else {
      // No results, try to get from store
      currencyPrices.value = sortedFiats.map(fiat => {
        const priceMap = client.fiatPrices.get(fiat)
        const price = priceMap?.get(denomKey)
        return {
          fiat: fiat as string,
          price: typeof price === 'number' ? price : 0,
          loading: false,
        }
      })
    }
  } catch (error) {
    console.error('Failed to fetch prices:', error)
    // Set all currencies to not loading on error
    currencyPrices.value = currencyPrices.value.map(p => ({
      ...p,
      loading: false,
    }))
  }
  
  lastUpdated.value = new Date()
}

async function fetchStats() {
  try {
    // Use the new count queries for more efficient stats fetching
    const activeOffersCount = await client.client.fetchOffersCountByStates(['active'])
    // Only count trades that are actually in progress (not just requested)
    const activeTradesCount = await client.client.fetchTradesCountByStates([
      'request_accepted', 
      'escrow_funded',
      'fiat_deposited'
    ])
    
    let userActiveOffers = 0
    let userActiveTrades = 0
    
    // Fetch user-specific stats if wallet is connected
    if (userWallet.value.isConnected) {
      try {
        await client.fetchMyOffers()
        userActiveOffers = myOffers.value.data.filter(o => o.offer.state === OfferState.active).length
      } catch (e) {
      }
      
      try {
        await client.fetchTrades()
        userActiveTrades = trades.value.data.filter(t => 
          t.trade.state === TradeState.request_accepted ||
          t.trade.state === TradeState.escrow_funded ||
          t.trade.state === TradeState.fiat_deposited
        ).length
      } catch (e) {
      }
    }
    
    stats.value = {
      totalOffers: activeOffersCount, // Now showing ACTIVE offers count (system-wide)
      activeOffers: activeTradesCount, // Now showing ACTIVE trades count (system-wide)
      completedTrades: userActiveOffers, // Now showing YOUR active offers
      activeTrades: userActiveTrades, // Now showing YOUR active trades
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  }
}

async function fetchFiatRankings() {
  try {
    // Fetch offers count by fiat
    const offersCountByFiat = await client.client.fetchAllFiatsOffersCount(['active'])
    
    // Fetch completed trades count by fiat  
    const tradesCountByFiat = await client.client.fetchAllFiatsTradesCount([
      'escrow_released',
      'escrow_refunded'
    ])
    
    // Combine the data
    const rankingMap = new Map<string, FiatRanking>()
    
    // Add offers data
    offersCountByFiat.forEach(item => {
      rankingMap.set(item.fiat, {
        fiat: item.fiat,
        activeOffers: item.count,
        completedTrades: 0
      })
    })
    
    // Add trades data
    tradesCountByFiat.forEach(item => {
      const existing = rankingMap.get(item.fiat)
      if (existing) {
        existing.completedTrades = item.count
      } else {
        rankingMap.set(item.fiat, {
          fiat: item.fiat,
          activeOffers: 0,
          completedTrades: item.count
        })
      }
    })
    
    // Convert to array and sort by total activity
    fiatRankings.value = Array.from(rankingMap.values())
      .sort((a, b) => (b.activeOffers + b.completedTrades) - (a.activeOffers + a.completedTrades))
      .slice(0, 10) // Top 10
  } catch (error) {
    console.error('Failed to fetch fiat rankings:', error)
  }
}

async function refreshData() {
  isLoading.value = true
  try {
    // Fetch prices first, then stats, then rankings
    await fetchAllPrices()
    await fetchStats()
    await fetchFiatRankings()
  } catch (error) {
    console.error('Error refreshing data:', error)
  } finally {
    isLoading.value = false
  }
}

function formatPrice(price: number | undefined): string {
  if (price === undefined || price === null || price === 0) return '—'
  let num = Number(price)
  if (isNaN(num)) return '—'
  
  // Convert from cents to currency value (price is stored as cents in the contract)
  num = num / 100
  
  // Format to at most 2 decimals, removing unnecessary trailing zeros
  const formatted = num.toFixed(2)
  // Remove trailing zeros after decimal point
  return formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString()
}

onMounted(async () => {
  trackPage(Page.home)
  await refreshData()
})

watch(selectedDenom, async () => {
  await fetchAllPrices()
})

// Refetch stats when wallet connection changes
watch(() => userWallet.value.isConnected, async (isConnected) => {
  if (isConnected) {
    await fetchStats()
  }
})
</script>

<template>
  <section class="page">
    <div class="dashboard-header">
      <h3>Market Dashboard</h3>
      <button class="btn-refresh" @click="refreshData" :disabled="isLoading">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M1 4V10H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M23 20V14H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Refresh</span>
      </button>
    </div>

    <div class="stats-grid">
      <div class="stat-card card">
        <div class="stat-label">Active Offers</div>
        <div class="stat-value">{{ stats.totalOffers }}</div>
      </div>
      <div class="stat-card card">
        <div class="stat-label">Active Trades</div>
        <div class="stat-value">{{ stats.activeOffers }}</div>
      </div>
      <div class="stat-card card" :class="{ 'wallet-required': !userWallet.isConnected }">
        <div class="stat-label">{{ userWallet.isConnected ? 'Your Active Offers' : 'Your Active Offers' }}</div>
        <div class="stat-value" v-if="userWallet.isConnected">{{ stats.completedTrades }}</div>
        <div class="stat-value" v-else>
          <span class="connect-prompt">—</span>
        </div>
      </div>
      <div class="stat-card card" :class="{ 'wallet-required': !userWallet.isConnected }">
        <div class="stat-label">{{ userWallet.isConnected ? 'Your Active Trades' : 'Your Active Trades' }}</div>
        <div class="stat-value" v-if="userWallet.isConnected">{{ stats.activeTrades }}</div>
        <div class="stat-value" v-else>
          <span class="connect-prompt">—</span>
        </div>
      </div>
    </div>

    <div v-if="!userWallet.isConnected" class="wallet-notice">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7V12C2 16.5 4.23 20.68 7.62 23.15L12 26L16.38 23.15C19.77 20.68 22 16.5 22 12V7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 8V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="16" r="1" fill="currentColor"/>
      </svg>
      <span>Connect wallet to view your trades</span>
    </div>

    <div class="prices-section">
      <div class="prices-header">
        <h3>Currency Prices</h3>
        <div class="controls">
          <select v-model="selectedDenom" class="denom-select">
            <option v-for="option in denomOptions" :key="option.value" :value="option.value">
              {{ option.display }}
            </option>
          </select>
          <span class="last-updated">Last updated: {{ formatTime(lastUpdated) }}</span>
        </div>
      </div>

      <div class="prices-grid">
        <div v-for="priceData in currencyPrices" :key="priceData.fiat" class="price-card card">
          <div class="currency-info">
            <img :src="getFiatInfo(priceData.fiat)?.icon" :alt="priceData.fiat" class="currency-flag">
            <span class="currency-code">{{ priceData.fiat }}</span>
          </div>
          <div class="price-value" v-if="!priceData.loading">
            <span class="price">{{ formatPrice(priceData.price) }}</span>
            <span class="unit">{{ priceData.fiat }}/{{ denomOptions.find(d => d.value === selectedDenom)?.display }}</span>
          </div>
          <div class="price-loading" v-else>
            <Loading />
          </div>
        </div>
      </div>
    </div>
    
    <div class="rankings-section">
      <div class="rankings-header">
        <h3>Top Fiat Currencies</h3>
        <p class="subtitle">Most active currencies on the platform</p>
      </div>
      <div class="rankings-table" v-if="fiatRankings.length > 0">
        <div class="table-header">
          <div class="col-rank">#</div>
          <div class="col-currency">Currency</div>
          <div class="col-offers">Active Offers</div>
          <div class="col-trades">Completed Trades</div>
          <div class="col-total">Total Activity</div>
        </div>
        <div class="table-row" v-for="(ranking, index) in fiatRankings" :key="ranking.fiat">
          <div class="col-rank">{{ index + 1 }}</div>
          <div class="col-currency">
            <span class="currency-flag">{{ getFiatInfo(ranking.fiat).flag }}</span>
            <span class="currency-code">{{ ranking.fiat }}</span>
            <span class="currency-name">{{ getFiatInfo(ranking.fiat).name }}</span>
          </div>
          <div class="col-offers">{{ ranking.activeOffers }}</div>
          <div class="col-trades">{{ ranking.completedTrades }}</div>
          <div class="col-total">{{ ranking.activeOffers + ranking.completedTrades }}</div>
        </div>
      </div>
      <div class="no-data" v-else>
        <p>No fiat currency data available</p>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
@import '../style/pages.scss';

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;

  h3 {
    margin: 0;
  }

  .btn-refresh {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background-color: $surface;
    color: $primary;
    border: 1px solid $border;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background-color: $gray100;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
  margin-bottom: 48px;

  .stat-card {
    text-align: center;
    padding: 32px 24px;

    .stat-label {
      font-size: 14px;
      color: $gray600;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-value {
      font-size: 36px;
      font-weight: $bold;
      color: $primary;
    }
  }
}

.wallet-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: $gray100;
  border: 1px solid $border;
  border-radius: 8px;
  margin-bottom: 48px;
  color: $gray600;
  font-size: 14px;
  
  svg {
    flex-shrink: 0;
  }
}

.stat-card.wallet-required {
  opacity: 0.5;
  
  .connect-prompt {
    color: $gray600;
  }
}

.prices-section {
  .prices-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    h3 {
      margin: 0;
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 16px;

      .denom-select {
        padding: 8px 12px;
        background-color: $surface;
        border: 1px solid $border;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;

        &:focus {
          outline: none;
          border-color: $primary;
        }
      }

      .last-updated {
        font-size: 12px;
        color: $gray600;
      }
    }
  }

  .prices-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;

    .price-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;

      .currency-info {
        display: flex;
        align-items: center;
        gap: 12px;

        .currency-flag {
          width: 24px;
          height: 24px;
          object-fit: contain;
        }

        .currency-code {
          font-weight: $semi-bold;
          font-size: 16px;
        }
      }

      .price-value {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .price {
          font-size: 20px;
          font-weight: $bold;
          color: $primary;
        }

        .unit {
          font-size: 12px;
          color: $gray600;
        }
      }

      .price-loading {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 48px;
      }
    }
  }
}

@media only screen and (max-width: $mobile) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .prices-section {
    .prices-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;

      .controls {
        width: 100%;
        justify-content: space-between;
      }
    }

    .prices-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }
  }
}

.rankings-section {
  margin-top: 48px;
  
  .rankings-header {
    margin-bottom: 24px;
    
    h3 {
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: $bold;
    }
    
    .subtitle {
      margin: 0;
      color: $gray600;
      font-size: 14px;
    }
  }
  
  .rankings-table {
    background: $gray100;
    border: 1px solid $border;
    border-radius: 12px;
    overflow: hidden;
    
    .table-header,
    .table-row {
      display: grid;
      grid-template-columns: 60px 2fr 1fr 1fr 1fr;
      padding: 16px 24px;
      align-items: center;
      gap: 16px;
      
      @media (max-width: 768px) {
        grid-template-columns: 40px 2fr 1fr;
        
        .col-trades,
        .col-total {
          display: none;
        }
      }
    }
    
    .table-header {
      background: $gray200;
      border-bottom: 1px solid $border;
      font-weight: $semi-bold;
      font-size: 12px;
      text-transform: uppercase;
      color: $gray600;
    }
    
    .table-row {
      transition: background-color 0.2s;
      
      &:hover {
        background: $gray150;
      }
      
      &:not(:last-child) {
        border-bottom: 1px solid $border;
      }
    }
    
    .col-rank {
      font-weight: $bold;
      color: $primary;
    }
    
    .col-currency {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .currency-flag {
        font-size: 20px;
      }
      
      .currency-code {
        font-weight: $semi-bold;
      }
      
      .currency-name {
        color: $gray600;
        font-size: 14px;
        
        @media (max-width: 768px) {
          display: none;
        }
      }
    }
    
    .col-offers,
    .col-trades,
    .col-total {
      font-weight: 500;
    }
    
    .col-total {
      font-weight: $bold;
      color: $primary;
    }
  }
  
  .no-data {
    text-align: center;
    padding: 48px;
    color: $gray600;
  }
}
</style>