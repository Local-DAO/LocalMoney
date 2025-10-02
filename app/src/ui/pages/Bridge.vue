<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { Page, trackPage } from '~/analytics/analytics'
import WalletConnect from '~/ui/components/bridge/WalletConnect.vue'
import BridgeForm from '~/ui/components/bridge/BridgeForm.vue'
import TransactionStatus from '~/ui/components/bridge/TransactionStatus.vue'
import { useMetaMaskStore } from '~/stores/metamask'
import { useBridgeStore } from '~/stores/bridge'
import { TransactionStatus as TxStatus } from '~/types/bridge'
import { useConfetti } from '~/utils/confetti'

const isClient = ref(false)
const metamaskStore = useMetaMaskStore()
const bridgeStore = useBridgeStore()
const { triggerOrangeConfetti } = useConfetti()

const showBridgeForm = computed(() => {
  if (!isClient.value) return false
  return (
    bridgeStore.isKujiraConnected &&
    metamaskStore.isConnected &&
    metamaskStore.isCorrectNetwork
  )
})

// Watch for transaction completion and trigger confetti
watch(
  () => bridgeStore.currentTransaction?.status,
  (newStatus, oldStatus) => {
    if (oldStatus !== TxStatus.Completed && newStatus === TxStatus.Completed) {
      triggerOrangeConfetti()
    }
  }
)

onMounted(() => {
  isClient.value = true
  trackPage(Page.home)
})
</script>

<template>
  <main class="bridge-page">
    <div class="bridge-hero">
      <h1>🌉 Kujira-BSC Bridge</h1>
      <p class="subtitle">Transfer LOCAL tokens from Kujira to BSC</p>
    </div>

    <div v-if="isClient" class="bridge-container">
      <WalletConnect />

      <div v-if="showBridgeForm" class="bridge-section">
        <BridgeForm />
      </div>

      <div v-if="bridgeStore.currentTransaction || bridgeStore.transactions.length > 0" class="status-section">
        <TransactionStatus />
      </div>
    </div>
    <div v-else class="bridge-container">
      <p style="text-align: center; color: #999;">Loading...</p>
    </div>
  </main>
</template>

<style lang="scss" scoped>
@import '~/ui/style/tokens.scss';

.bridge-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 140px 24px 40px;
  overflow-x: hidden;

  @include responsive(mobile) {
    padding: 24px 16px;
    min-width: 0;
  }
}

.bridge-hero {
  text-align: center;
  margin-bottom: 48px;

  @include responsive(mobile) {
    margin-bottom: 32px;
  }

  h1 {
    font-size: 48px;
    margin-top: 0;
    margin-bottom: 16px;
    color: $base-text;
    font-weight: $extra-bold;
    word-wrap: break-word;
    overflow-wrap: break-word;

    @include responsive(mobile) {
      font-size: 28px;
      padding: 0 8px;
    }
  }

  .subtitle {
    font-size: 18px;
    color: $gray700;
    margin: 0;

    @include responsive(mobile) {
      font-size: 16px;
    }
  }
}

.bridge-container {
  width: 100%;
}

.bridge-section,
.status-section {
  margin-top: 24px;
}
</style>
