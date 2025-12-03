<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useClientStore } from '~/stores/client'
import { isSolanaChain } from '~/network/Chain'
import {
  isDevMode,
  isDevWalletEnabled,
  getDevWalletName,
  setupDevWalletMode,
  disableDevWalletMode,
  DEV_WALLET_ADDRESSES,
  type DevWalletName,
} from '~/network/solana/dev-wallet-loader'

const client = useClientStore()

// Only show in dev mode and for Solana chains
const shouldShow = computed(() => {
  return isDevMode() && isSolanaChain(client.chainClient)
})

const devWalletEnabled = ref(false)
const selectedWallet = ref<DevWalletName>('maker')
const isLoading = ref(false)
const error = ref<string | null>(null)

// Initialize from localStorage on mount and auto-setup if enabled
onMounted(async () => {
  devWalletEnabled.value = isDevWalletEnabled()
  selectedWallet.value = getDevWalletName()

  // Auto-initialize dev wallet if it was previously enabled
  if (devWalletEnabled.value && isSolanaChain(client.chainClient)) {
    isLoading.value = true
    try {
      await setupDevWalletMode(selectedWallet.value)
      // Don't auto-connect, let user click connect button
    } catch (e) {
      console.error('Failed to auto-init dev wallet:', e)
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }
})

async function toggleDevWallet() {
  isLoading.value = true
  error.value = null

  try {
    if (!devWalletEnabled.value) {
      // Disable dev wallet
      await disableDevWalletMode()
      devWalletEnabled.value = false

      // Disconnect the current wallet connection
      if (client.userWallet.isConnected) {
        await client.disconnectWallet()
      }
    } else {
      // Enable dev wallet
      await setupDevWalletMode(selectedWallet.value)
      devWalletEnabled.value = true

      // Connect the wallet through the store
      await client.connectWallet()
    }
  } catch (e) {
    console.error('Failed to toggle dev wallet:', e)
    error.value = (e as Error).message
    devWalletEnabled.value = false
  } finally {
    isLoading.value = false
  }
}

async function switchWallet() {
  if (!devWalletEnabled.value) return

  isLoading.value = true
  error.value = null

  try {
    // Disconnect current wallet
    if (client.userWallet.isConnected) {
      await client.disconnectWallet()
    }

    // Setup new wallet
    await setupDevWalletMode(selectedWallet.value)

    // Connect the wallet through the store
    await client.connectWallet()
  } catch (e) {
    console.error('Failed to switch dev wallet:', e)
    error.value = (e as Error).message
  } finally {
    isLoading.value = false
  }
}

function formatAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}
</script>

<template>
  <div v-if="shouldShow" class="dev-wallet-selector">
    <div class="dev-badge">DEV</div>

    <div class="toggle-section">
      <label class="toggle-label">
        <input
          v-model="devWalletEnabled"
          type="checkbox"
          :disabled="isLoading"
          @change="toggleDevWallet"
        />
        <span class="toggle-text">Dev Wallet</span>
      </label>
    </div>

    <div v-if="devWalletEnabled" class="wallet-section">
      <select
        v-model="selectedWallet"
        :disabled="isLoading"
        class="wallet-select"
        @change="switchWallet"
      >
        <option value="maker">
          Maker ({{ formatAddress(DEV_WALLET_ADDRESSES.maker) }})
        </option>
        <option value="taker">
          Taker ({{ formatAddress(DEV_WALLET_ADDRESSES.taker) }})
        </option>
      </select>
    </div>

    <div v-if="isLoading" class="loading">
      Loading...
    </div>

    <div v-if="error" class="error">
      {{ error }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import '../../style/tokens.scss';

.dev-wallet-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(255, 152, 0, 0.1);
  border: 1px dashed rgba(255, 152, 0, 0.5);
  border-radius: 8px;
  font-size: 12px;
  margin-right: 12px;

  .dev-badge {
    background: #ff9800;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 0.5px;
  }

  .toggle-section {
    .toggle-label {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;

      input[type="checkbox"] {
        width: 14px;
        height: 14px;
        cursor: pointer;
      }

      .toggle-text {
        color: $text-primary;
        font-weight: 500;
      }
    }
  }

  .wallet-section {
    .wallet-select {
      padding: 4px 8px;
      border: 1px solid $border;
      border-radius: 4px;
      background: $bg-secondary;
      color: $text-primary;
      font-size: 11px;
      cursor: pointer;
      min-width: 140px;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &:focus {
        outline: none;
        border-color: $primary;
      }
    }
  }

  .loading {
    color: #ff9800;
    font-weight: 500;
    animation: pulse 1s infinite;
  }

  .error {
    color: #f44336;
    font-size: 11px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
}
</style>
