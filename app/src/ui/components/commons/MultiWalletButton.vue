<script setup lang="ts">
import { ref, computed } from 'vue'
import WalletWidget from './WalletWidget.vue'
import { useClientStore } from '~/stores/client'
import { formatAddress } from '~/shared'
import useNotificationSystem from '~/notification/Notification'
import { WalletEvents, trackWalletConnection } from '~/analytics/analytics'
import { ChainType, WalletProvider, WalletService } from '~/services/wallet'
import { WalletType } from '~/network/evm/EVMChain'

const notification = useNotificationSystem()
const client = useClientStore()
const userWallet = computed(() => client.userWallet)
const showWalletSelector = ref(false)

watch(userWallet, async (wallet) => {
  if (wallet.isConnected) {
    await notification.register()
    trackWalletConnection(WalletEvents.connected, wallet.address)
  } else {
    await notification.unregister()
    trackWalletConnection(WalletEvents.disconnected)
  }
})

const availableWallets = computed(() => {
  const chainType = client.client.getChainType()
  const allWallets = WalletService.detectAvailableWallets()
  
  // Filter wallets compatible with current chain
  return allWallets.filter(wallet => {
    const walletChainType = WalletService.getChainTypeForWallet(wallet)
    return walletChainType === chainType
  })
})

async function connectWithWallet(provider: WalletProvider) {
  showWalletSelector.value = false
  
  // Track wallet selection
  trackWalletConnection(WalletEvents.select_wallet, { wallet: provider })
  
  try {
    const chainType = client.client.getChainType()
    
    if (chainType === 'cosmos' && provider === WalletProvider.KEPLR) {
      await client.connectWallet()
    } else if (chainType === 'evm') {
      // For EVM chains, pass the wallet type to the connect function
      const walletType = provider === WalletProvider.METAMASK ? WalletType.METAMASK : WalletType.PHANTOM
      await client.connectWallet(walletType)
    }
  } catch (error) {
    console.error('Failed to connect wallet:', error)
  }
}

function disconnectWallet() {
  nextTick(async () => await client.disconnectWallet())
}

const walletWidget = ref()
function toggleWalletWidget() {
  if (userWallet.value.isConnected) {
    walletWidget.value.toggleWidget()
  } else {
    showWalletSelector.value = !showWalletSelector.value
  }
}

// Close selector when clicking outside
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  notification.unregister()
})

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.multi-wallet-button')) {
    showWalletSelector.value = false
  }
}
</script>

<template>
  <div class="multi-wallet-button">
    <button class="wallet" @click="toggleWalletWidget()">
      <slot v-if="userWallet.isConnected">
        <p>{{ formatAddress(userWallet.address) }}</p>
        <img src="../../assets/ic_wallet.svg" alt="Wallet" />
      </slot>
      <slot v-else>
        <p>Connect Wallet</p>
        <img src="../../assets/ic_wallet.svg" alt="Connect Wallet" />
      </slot>
    </button>

    <!-- Wallet Selector Dropdown -->
    <div v-if="showWalletSelector && !userWallet.isConnected" class="wallet-selector">
      <div class="selector-header">Select Wallet</div>
      
      <div v-if="availableWallets.length === 0" class="no-wallets">
        <p>No compatible wallets detected</p>
        <small>Please install a wallet extension compatible with {{ client.client.getChainType() }} chains</small>
      </div>
      
      <button
        v-for="wallet in availableWallets"
        :key="wallet"
        class="wallet-option"
        @click="connectWithWallet(wallet)"
      >
        <span class="wallet-icon">{{ WalletService.getWalletIcon(wallet) }}</span>
        <span class="wallet-name">{{ WalletService.getWalletDisplayName(wallet) }}</span>
        <svg class="arrow-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      
      <div class="selector-footer">
        <small>{{ availableWallets.length }} wallet(s) available</small>
      </div>
    </div>

    <WalletWidget v-if="userWallet.isConnected" ref="walletWidget" @disconnect="disconnectWallet()" />
  </div>
</template>

<style lang="scss" scoped>
@import '../../style/tokens.scss';

.multi-wallet-button {
  position: relative;
}

button.wallet {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: $bg-secondary;
  border: 1px solid $border;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $bg-hover;
    border-color: $primary;
    color: $primary;
  }

  p {
    font-weight: 500;
  }

  img {
    width: 20px;
    height: 20px;
  }

  @media only screen and (max-width: $mobile) {
    margin: 16px 16px 0 0;
  }
}

.wallet-selector {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 260px;
  background: $bg-primary;
  border: 1px solid $border;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow: hidden;

  .selector-header {
    padding: 12px 16px;
    font-weight: 600;
    border-bottom: 1px solid $border;
    color: $text-primary;
    background: $bg-secondary;
  }

  .no-wallets {
    padding: 24px 16px;
    text-align: center;
    
    p {
      color: $text-primary;
      margin-bottom: 8px;
      font-weight: 500;
    }

    small {
      color: $text-secondary;
      font-size: 12px;
    }
  }

  .wallet-option {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid $border;
    cursor: pointer;
    transition: background 0.2s;
    text-align: left;

    &:last-of-type {
      border-bottom: none;
    }

    &:hover {
      background: $bg-hover;
    }

    .wallet-icon {
      font-size: 24px;
    }

    .wallet-name {
      flex: 1;
      color: $text-primary;
      font-weight: 500;
      font-size: 14px;
    }

    .arrow-icon {
      color: $text-secondary;
    }
  }

  .selector-footer {
    padding: 8px 16px;
    background: $bg-secondary;
    border-top: 1px solid $border;
    text-align: center;

    small {
      color: $text-secondary;
      font-size: 11px;
    }
  }
}
</style>