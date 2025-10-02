<template>
  <div class="wallet-connect">
    <div class="wallet-section card">
      <h3>Kujira Wallet (Source)</h3>
      <div v-if="!bridgeStore.isKujiraConnected" class="wallet-disconnected">
        <p>Connect your Keplr wallet to start bridging</p>
        <button
          @click="handleConnectKujira"
          :disabled="connecting"
          class="primary center-text"
        >
          {{ connecting ? 'Connecting...' : 'Connect Keplr' }}
        </button>
      </div>
      <div v-else class="wallet-connected">
        <div class="wallet-info">
          <p class="wallet-label">Address:</p>
          <p class="wallet-address">{{ formatAddress(bridgeStore.kujiraAddress) }}</p>
        </div>
        <div class="wallet-info">
          <p class="wallet-label">Balance:</p>
          <p class="wallet-balance">{{ bridgeStore.kujiraBalance }} LOCAL</p>
        </div>
        <button
          @click="handleDisconnectKujira"
          class="secondary center-text"
        >
          Disconnect
        </button>
      </div>
    </div>

    <div class="wallet-section card">
      <h3>BSC Wallet (Destination)</h3>
      <div v-if="!metamaskStore.isConnected" class="wallet-disconnected">
        <p>Connect MetaMask to receive tokens on BSC</p>
        <button
          @click="handleConnectMetaMask"
          :disabled="connecting"
          class="primary center-text"
        >
          {{ connecting ? 'Connecting...' : 'Connect MetaMask' }}
        </button>
        <p v-if="!metamaskStore.isMetaMaskInstalled()" class="error-text">
          MetaMask not detected. Please install MetaMask extension.
        </p>
      </div>
      <div v-else class="wallet-connected">
        <div class="wallet-info">
          <p class="wallet-label">Address:</p>
          <p class="wallet-address">{{ formatAddress(metamaskStore.account) }}</p>
        </div>
        <div class="wallet-info">
          <p class="wallet-label">BNB Balance:</p>
          <p class="wallet-balance">{{ parseFloat(metamaskStore.balance).toFixed(4) }} BNB</p>
        </div>
        <div class="wallet-info">
          <p class="wallet-label">LOCAL Balance:</p>
          <p class="wallet-balance">{{ parseFloat(metamaskStore.tokenBalance).toFixed(4) }} LOCAL</p>
        </div>
        <div v-if="!metamaskStore.isCorrectNetwork" class="warning">
          <p class="warning-text">⚠️ Please switch to BSC network</p>
          <button
            @click="handleSwitchNetwork"
            class="tertiary center-text"
          >
            Switch to BSC
          </button>
        </div>
        <button
          @click="handleDisconnectMetaMask"
          class="secondary center-text"
        >
          Disconnect
        </button>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMetaMaskStore } from '~/stores/metamask'
import { useBridgeStore } from '~/stores/bridge'

const metamaskStore = useMetaMaskStore()
const bridgeStore = useBridgeStore()

const connecting = ref(false)
const error = ref('')

const formatAddress = (address: string): string => {
  if (!address || address.length < 10) return address
  return address.slice(0, 10) + '...' + address.slice(-8)
}

const handleConnectKujira = async () => {
  connecting.value = true
  error.value = ''

  try {
    await bridgeStore.connectKujira()
  } catch (e: any) {
    error.value = e.message || 'Failed to connect Keplr wallet'
    console.error('Kujira connection error:', e)
  } finally {
    connecting.value = false
  }
}

const handleDisconnectKujira = () => {
  bridgeStore.disconnectKujira()
}

const handleConnectMetaMask = async () => {
  connecting.value = true
  error.value = ''

  try {
    await metamaskStore.connect()
  } catch (e: any) {
    error.value = e.message || 'Failed to connect MetaMask'
    console.error('MetaMask connection error:', e)
  } finally {
    connecting.value = false
  }
}

const handleDisconnectMetaMask = () => {
  metamaskStore.disconnect()
}

const handleSwitchNetwork = async () => {
  try {
    await metamaskStore.switchToBSC()
  } catch (e: any) {
    error.value = e.message || 'Failed to switch network'
    console.error('Network switch error:', e)
  }
}
</script>

<style scoped lang="scss">
@import '~/ui/style/tokens.scss';

.wallet-connect {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  flex-wrap: wrap;

  @include responsive(mobile) {
    flex-direction: column;
  }
}

.wallet-section {
  flex: 1;
  min-width: 300px;

  @include responsive(mobile) {
    min-width: 100%;
  }

  h3 {
    margin-top: 0;
    margin-bottom: 16px;
    color: $base-text;
    font-size: 18px;
    font-weight: $semi-bold;
  }
}

.wallet-disconnected {
  text-align: center;

  p {
    margin-bottom: 16px;
    color: $gray700;
    font-size: 14px;
  }

  button {
    width: 100%;
  }
}

.wallet-connected {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wallet-info {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid $border;

  &:last-of-type {
    border-bottom: none;
  }
}

.wallet-label {
  font-weight: $semi-bold;
  color: $gray700;
  margin: 0;
  font-size: 14px;
}

.wallet-address {
  font-family: monospace;
  color: $base-text;
  margin: 0;
  font-size: 14px;
}

.wallet-balance {
  font-weight: $bold;
  color: $primary;
  margin: 0;
  font-size: 14px;
}

.warning {
  padding: 16px;
  background-color: rgba(239, 97, 0, 0.1);
  border: 1px solid $primary;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.warning-text {
  margin: 0;
  color: $primary;
  font-weight: $semi-bold;
  font-size: 14px;
}

.error-message {
  padding: 16px;
  background-color: rgba(220, 53, 69, 0.1);
  border: 1px solid #dc3545;
  border-radius: 8px;
  color: #dc3545;
  margin-top: 16px;
  font-size: 14px;
}

.error-text {
  color: #dc3545;
  font-size: 12px;
  margin-top: 8px;
}

button {
  width: 100%;
  justify-content: center;
}
</style>
