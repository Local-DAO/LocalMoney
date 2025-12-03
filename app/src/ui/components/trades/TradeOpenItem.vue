<script setup lang="ts">
import { formatAddress, formatAmount } from '~/shared'
import { useClientStore } from '~/stores/client'
import type { TradeInfo } from '~/types/components.interface'
import { microDenomToDisplay } from '~/utils/denom'
import { formatTimer } from '~/utils/formatters'
import { checkTradeNeedsRefund } from '~/utils/validations'
import { TradeState } from '~/types/components.interface'
import { addressesEqual } from '~/utils/address'

const props = defineProps<{ tradeInfo: TradeInfo }>()
const trade = ref()
const client = useClientStore()
let refreshTradeDetailInterval: NodeJS.Timer | undefined
const secondsUntilTradeDetailRefresh = ref(0)
const tradeTimer = ref('')
let tradeTimerInterval: NodeJS.Timer
const walletAddress = computed(() => client.userWallet.address)
const stepLabels = {
  buy: {
    buyer: [
      'Review trade request',
      'Waiting for funds',
      'Waiting for fiat payment',
      'Waiting for funds release',
      'Trade finished',
      'In dispute',
    ],
    seller: [
      'Waiting for buyer',
      'Please fund the trade',
      'Waiting for payment',
      'Please release the funds',
      'Trade finished',
      'In dispute',
    ],
  },
  sell: {
    buyer: [
      'Waiting for funds',
      'Waiting for fiat payment',
      'Waiting for funds release',
      'Trade finished',
      'In dispute',
    ],
    seller: [
      'Please fund the trade',
      'Waiting for payment',
      'Please release the funds',
      'Trade finished',
      'In dispute',
    ],
  },
}

const step = computed(() => {
  const trade = props.tradeInfo.trade
  if (props.tradeInfo.offer.offer.offer_type === 'buy') {
    switch (trade.state) {
      case 'request_created':
        return 1
      case 'request_accepted':
        return 2
      case 'escrow_funded':
        return 3
      case 'fiat_deposited':
        return 4
      case 'escrow_released':
        return 5
      case 'escrow_disputed':
        return 6
      default:
        return 0
    }
  } else {
    switch (trade.state) {
      case 'request_created':
        return 1
      case 'escrow_funded':
        return 2
      case 'fiat_deposited':
        return 3
      case 'escrow_released':
        return 4
      case 'escrow_disputed':
        return 5
      default:
        return 0
    }
  }
})

const counterparty = computed(() => {
  const trade = props.tradeInfo.trade
  return addressesEqual(walletAddress.value, trade.seller) ? trade.buyer : trade.seller
})

const isBuying = computed(() => {
  return !addressesEqual(props.tradeInfo.trade.seller, walletAddress.value)
})

const buyOrSell = computed(() => {
  return isBuying.value ? 'Buy' : 'Sell'
})

const fromTo = computed(() => {
  return isBuying.value ? 'from' : 'to'
})

const stepLabel = computed(() => {
  const labelIdx = step.value - 1
  const type = props.tradeInfo.offer.offer.offer_type
  if (isBuying.value) {
    return stepLabels[type].buyer[labelIdx]
  } else {
    if (checkTradeNeedsRefund(props.tradeInfo.trade, walletAddress.value)) {
      return 'Refund available'
    } else {
      return stepLabels[type].seller[labelIdx]
    }
  }
})

const isMyTurn = computed(() => {
  const trade = props.tradeInfo.trade
  const offerType = props.tradeInfo.offer.offer.offer_type
  const userIsBuyer = isBuying.value
  const userIsSeller = !userIsBuyer
  
  // Check for refund needed first
  if (checkTradeNeedsRefund(trade, walletAddress.value)) {
    return true
  }
  
  // For BUY offers (maker wants to buy crypto, is the buyer)
  if (offerType === 'buy') {
    switch (trade.state) {
      case 'request_created':
        return userIsBuyer // Buyer (maker) needs to accept
      case 'request_accepted':
        return userIsSeller // Seller (taker) needs to fund
      case 'escrow_funded':
        return userIsBuyer // Buyer (maker) needs to mark as paid
      case 'fiat_deposited':
        return userIsSeller // Seller (taker) needs to release funds
      case 'escrow_released':
      case 'escrow_refunded':
      case 'request_canceled':
      case 'request_expired':
        return false // Trade complete or canceled
      case 'escrow_disputed':
        return false // Waiting for arbitrator
      default:
        return false
    }
  } 
  // For SELL offers (maker wants to sell crypto, is the seller)
  else {
    switch (trade.state) {
      case 'request_created':
        // For sell offers, taker initiates, maker (seller) needs to accept
        return userIsSeller // Seller (maker) needs to accept
      case 'request_accepted':
        return userIsSeller // Seller (maker) needs to fund
      case 'escrow_funded':
        return userIsBuyer // Buyer (taker) needs to mark as paid
      case 'fiat_deposited':
        return userIsSeller // Seller (maker) needs to release funds
      case 'escrow_released':
      case 'escrow_refunded':
      case 'request_canceled':
      case 'request_expired':
        return false // Trade complete or canceled
      case 'escrow_disputed':
        return false // Waiting for arbitrator
      default:
        return false
    }
  }
})

const turnIndicator = computed(() => {
  if (checkTradeNeedsRefund(props.tradeInfo.trade, walletAddress.value)) {
    return { isMyTurn: true, text: 'Action required' }
  }
  
  const trade = props.tradeInfo.trade
  if (['escrow_released', 'escrow_refunded', 'request_canceled', 'request_expired'].includes(trade.state)) {
    return { isMyTurn: false, text: 'Completed' }
  }
  
  if (trade.state === 'escrow_disputed') {
    return { isMyTurn: false, text: 'Waiting for arbitrator' }
  }
  
  return {
    isMyTurn: isMyTurn.value,
    text: isMyTurn.value ? 'Your turn' : "Waiting for counterparty"
  }
})

function startTradeDetailRefresh() {
  let seconds = 60
  const countdownInterval = 1000
  refreshTradeDetailInterval = setInterval(async () => {
    secondsUntilTradeDetailRefresh.value = --seconds
    if (seconds === 0) {
      await client.fetchTradeDetail(props.tradeInfo.trade.id)
      seconds = 60
    }
  }, countdownInterval)
}

function startTradeTimer() {
  tradeTimerInterval = setInterval(tradeTimerTick, 10)
}

function tradeTimerTick() {
  const currentTime = Date.now()
  const expiresAt = props.tradeInfo.trade.expires_at * 1000
  const timer = new Date(expiresAt - currentTime)
  tradeTimer.value = formatTimer(timer, '00m 00s')
}

function stopTradeTimer() {
  clearInterval(tradeTimerInterval)
}

onMounted(() => {
  startTradeTimer()
  nextTick(() => {
    startTradeDetailRefresh()
  })
})

onUnmounted(() => {
  stopTradeTimer()
  clearInterval(refreshTradeDetailInterval)
})
</script>

<template>
  <div class="card offer collapsed" v-bind="(trade = tradeInfo.trade)">
    <div class="trade-type">
      <p class="type">{{ buyOrSell }}ing {{ microDenomToDisplay(trade.denom.native, client.chainClient) }}</p>
      <p class="wallet-addr">{{ fromTo }} {{ formatAddress(counterparty) }}</p>
    </div>

    <div class="inner-wrap">
      <div class="info">
        <div class="wrap">
          <p class="label">Amount</p>
          <p class="content">
            {{ formatAmount(trade.amount, true, 6) }}
            {{ microDenomToDisplay(trade.denom.native, client.chainClient) }}
          </p>
        </div>

        <div class="divider" />

        <div class="wrap">
          <p class="label">Status</p>
          <p class="content current-action">
            {{ stepLabel }}
          </p>
        </div>

        <div class="divider" />

        <div class="wrap">
          <p class="label">Turn</p>
          <p class="content turn-indicator" :class="{ 'my-turn': turnIndicator.isMyTurn, 'their-turn': !turnIndicator.isMyTurn }">
            <span class="indicator-dot" :class="{ active: turnIndicator.isMyTurn }" />
            {{ turnIndicator.text }}
          </p>
        </div>

        <template v-if="tradeInfo.trade.state !== TradeState.request_expired && tradeInfo.trade.expires_at > 0">
          <div class="divider" />
          <div class="wrap">
            <p class="label">Time remaining</p>
            <p class="content">{{ tradeTimer }}</p>
          </div>
        </template>
      </div>

      <div class="price">
        <router-link :to="`/trade/${trade.id}`">
          <button class="primary bg-gray300">view trade</button>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import '../../style/tokens.scss';

.collapsed {
  margin-bottom: 24px;

  .trade-type {
    display: flex;
    flex-direction: column;

    .type {
      font-size: 18px;
      font-weight: 600;
      color: $base-text;
    }

    .wallet-addr {
      font-size: 14px;
      color: $gray700;
      margin-top: 4px;
    }
  }
  p.current-action {
    color: $primary !important;
  }
  
  .turn-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    
    &.my-turn {
      color: #10b981; // Green for user's turn
    }
    
    &.their-turn {
      color: $gray700;
    }
    
    .indicator-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: $gray600;
      display: inline-block;
      
      &.active {
        background-color: #10b981; // Green dot when it's user's turn
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
