<template>
  <div class="bridge-form card">
    <h2>Bridge LOCAL to BSC</h2>

    <div class="health-status" :class="{ 'health-ok': bridgeStore.isMonitorHealthy, 'health-error': !bridgeStore.isMonitorHealthy && !bridgeStore.isCheckingHealth, 'health-checking': bridgeStore.isCheckingHealth }">
      <span v-if="bridgeStore.isCheckingHealth" class="status-indicator">⏳ Checking bridge monitor status...</span>
      <span v-else-if="bridgeStore.isMonitorHealthy" class="status-indicator">✅ Bridge monitor is operational</span>
      <span v-else class="status-indicator">❌ Bridge monitor is unavailable</span>
    </div>

    <div class="form-group">
      <label for="amount">Amount (LOCAL)</label>
      <input
        id="amount"
        v-model="amount"
        type="text"
        inputmode="decimal"
        placeholder="1.00"
        :disabled="!canUseForm"
        @input="validateForm"
      />
      <div v-if="bridgeStore.kujiraBalance" class="balance-info">
        Available: {{ bridgeStore.kujiraBalance }} LOCAL
        <button
          @click="setMaxAmount"
          class="btn-max"
          :disabled="!canUseForm"
        >
          MAX
        </button>
      </div>
      <div v-if="amountError" class="error-text">
        {{ amountError }}
      </div>
    </div>

    <div class="form-group">
      <label for="bscAddress">BSC Recipient Address</label>
      <input
        id="bscAddress"
        v-model="bscAddress"
        type="text"
        placeholder="0x..."
        :disabled="!canUseForm"
        @input="validateForm"
      />
      <div v-if="metamaskStore.isConnected" class="address-helper">
        <button
          @click="useMetaMaskAddress"
          class="btn-helper"
          :disabled="!canUseForm"
        >
          Use MetaMask Address
        </button>
      </div>
      <div v-if="addressError" class="error-text">
        {{ addressError }}
      </div>
    </div>

    <div v-if="isValid" class="fee-section card">
      <div class="fee-row">
        <span>Bridge Fee:</span>
        <span class="fee-value">{{ calculatedFee }} LOCAL (0%)</span>
      </div>
      <div class="fee-row">
        <span>You will receive:</span>
        <span class="receive-value">{{ amountAfterFee }} LOCAL</span>
      </div>
      <div class="fee-row">
        <span>Estimated time:</span>
        <span class="time-value">~{{ estimatedTime }} minutes</span>
      </div>
    </div>

    <button
      @click="handleBridge"
      :disabled="!canBridge"
      class="primary center-text btn-bridge"
    >
      {{ bridgeButtonText }}
    </button>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMetaMaskStore } from '~/stores/metamask'
import { useBridgeStore } from '~/stores/bridge'
import { isValidAmount, isBSCAddress } from '~/utils/bridge-validation'
import { MIN_BRIDGE_AMOUNT } from '~/utils/bridge-constants'

const metamaskStore = useMetaMaskStore()
const bridgeStore = useBridgeStore()

onMounted(async () => {
  // Check monitor health on mount
  await bridgeStore.checkMonitorHealth()
})

const amount = ref('')
const bscAddress = ref('')
const amountError = ref('')
const addressError = ref('')
const error = ref('')
const bridging = ref(false)

const canUseForm = computed(() => {
  return bridgeStore.isKujiraConnected && !bridging.value
})

const isValid = computed(() => {
  return (
    isValidAmount(amount.value) &&
    isBSCAddress(bscAddress.value) &&
    !amountError.value &&
    !addressError.value
  )
})

const canBridge = computed(() => {
  return (
    canUseForm.value &&
    isValid.value &&
    metamaskStore.isConnected &&
    metamaskStore.isCorrectNetwork &&
    bridgeStore.isMonitorHealthy
  )
})

const calculatedFee = computed(() => {
  if (!isValidAmount(amount.value)) return '0'
  return bridgeStore.calculateFee(amount.value)
})

const amountAfterFee = computed(() => {
  if (!isValidAmount(amount.value)) return '0'
  return bridgeStore.calculateAmountAfterFee(amount.value)
})

const estimatedTime = computed(() => {
  return bridgeStore.getEstimatedTime()
})

const bridgeButtonText = computed(() => {
  if (bridging.value) return 'Processing...'
  if (bridgeStore.isCheckingHealth) return 'Checking Monitor Status...'
  if (!bridgeStore.isMonitorHealthy) return 'Bridge Monitor Unavailable'
  if (!bridgeStore.isKujiraConnected) return 'Connect Kujira Wallet'
  if (!metamaskStore.isConnected) return 'Connect MetaMask'
  if (!metamaskStore.isCorrectNetwork) return 'Switch to BSC Network'
  if (!isValid.value) return 'Enter Valid Details'
  return 'Bridge Tokens'
})

const validateForm = () => {
  // Validate amount
  amountError.value = ''
  if (amount.value && !isValidAmount(amount.value)) {
    amountError.value = 'Please enter a valid amount'
  } else if (amount.value) {
    const amountNum = parseFloat(amount.value)

    // Check minimum amount
    if (amountNum < MIN_BRIDGE_AMOUNT) {
      amountError.value = `Minimum bridge amount is ${MIN_BRIDGE_AMOUNT} LOCAL`
    } else {
      const balanceNum = parseFloat(bridgeStore.kujiraBalance)
      if (amountNum > balanceNum) {
        amountError.value = 'Insufficient balance'
      }
    }
  }

  // Validate address
  addressError.value = ''
  if (bscAddress.value && !isBSCAddress(bscAddress.value)) {
    addressError.value = 'Please enter a valid BSC address'
  }
}

const setMaxAmount = () => {
  amount.value = bridgeStore.kujiraBalance
  validateForm()
}

const useMetaMaskAddress = () => {
  bscAddress.value = metamaskStore.account
  validateForm()
}

const handleBridge = async () => {
  if (!canBridge.value) return

  // Double-check monitor health before proceeding
  const isHealthy = await bridgeStore.checkMonitorHealth()
  if (!isHealthy) {
    error.value = 'Bridge monitor is unavailable. Please try again later.'
    return
  }

  error.value = ''
  bridging.value = true

  try {
    await bridgeStore.initiateBridge(amount.value, bscAddress.value)

    // Clear form on success
    amount.value = ''
    bscAddress.value = ''
    amountError.value = ''
    addressError.value = ''
  } catch (e: any) {
    error.value = e.message || 'Failed to initiate bridge transaction'
    console.error('Bridge error:', e)
  } finally {
    bridging.value = false
  }
}
</script>

<style scoped lang="scss">
@import '~/ui/style/tokens.scss';

.bridge-form {
  max-width: 600px;
  margin: 24px auto;

  @include responsive(mobile) {
    margin: 16px 0;
  }

  h2 {
    margin-top: 0;
    margin-bottom: 16px;
    color: $base-text;
    text-align: center;
    font-size: 24px;
    font-weight: $bold;
  }
}

.health-status {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  text-align: center;
  font-size: 14px;
  font-weight: $semi-bold;
  transition: all 0.3s ease;

  &.health-ok {
    background-color: rgba(40, 167, 69, 0.1);
    border: 1px solid rgba(40, 167, 69, 0.3);
    color: #28a745;
  }

  &.health-error {
    background-color: rgba(220, 53, 69, 0.1);
    border: 1px solid rgba(220, 53, 69, 0.3);
    color: #dc3545;
  }

  &.health-checking {
    background-color: rgba(255, 193, 7, 0.1);
    border: 1px solid rgba(255, 193, 7, 0.3);
    color: #ffc107;
  }

  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
}

.form-group {
  margin-bottom: 24px;

  label {
    display: block;
    margin-bottom: 8px;
    font-weight: $semi-bold;
    color: $gray700;
    font-size: 14px;
  }

  input {
    width: 100%;
    padding: 12px 16px;
    background-color: $gray150;
    border: 1px solid $border;
    border-radius: 8px;
    font-size: 14px;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: $primary;
    }

    &:disabled {
      background: $gray100;
      cursor: not-allowed;
      opacity: 0.6;
    }
  }
}

.balance-info {
  margin-top: 8px;
  font-size: 12px;
  color: $gray700;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-max {
  padding: 4px 12px;
  background: $primary;
  color: $white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: $bold;
  cursor: pointer;
  transition: background 0.2s;
  height: 34px;

  &:hover:not(:disabled) {
    background: $secondary;
  }

  &:disabled {
    background: $gray600;
    cursor: not-allowed;
  }
}

.address-helper {
  margin-top: 8px;
}

.btn-helper {
  padding: 8px 16px;
  background-color: $gray300;
  color: $base-text;
  border: 1px solid $border;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  height: 34px;

  &:hover:not(:disabled) {
    background: $bg-hover;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.fee-section {
  padding: 16px;
  background-color: $gray150;
  border-radius: 8px;
  margin-bottom: 24px;
}

.fee-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  color: $gray700;
  font-size: 14px;
}

.fee-value {
  font-weight: $bold;
  color: $secondary;
}

.receive-value {
  font-weight: $bold;
  color: $primary;
  font-size: 16px;
}

.time-value {
  font-weight: $bold;
  color: $base-text;
}

.btn-bridge {
  width: 100%;
  padding: 16px;
  font-size: 16px;
  justify-content: center;
}

.error-text {
  color: #dc3545;
  font-size: 12px;
  margin-top: 4px;
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
</style>
