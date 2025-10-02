<script setup lang="ts">
import { computed } from 'vue'
import { useBridgeStore } from '~/stores/bridge'
import { TransactionStatus } from '~/types/bridge'
import { BSC_CONFIG, KUJIRA_EXPLORER_URL, ESTIMATED_TIME_MINUTES } from '~/utils/bridge-constants'

const bridgeStore = useBridgeStore()

const currentTx = computed(() => bridgeStore.currentTransaction)
const recentTransactions = computed(() => bridgeStore.completedTransactions.slice(0, 5))

function getStatusColor(status: TransactionStatus): string {
  switch (status) {
    case TransactionStatus.Completed: return '#5fce5f'
    case TransactionStatus.Failed: return '#dc2626'
    case TransactionStatus.WaitingForConfirmation: return '#fba367'
    case TransactionStatus.Burning: return '#fba367'
    case TransactionStatus.Pending: return '#999999'
    default: return '#999999'
  }
}

function getStatusIcon(status: TransactionStatus): string {
  switch (status) {
    case TransactionStatus.Completed: return '✅'
    case TransactionStatus.Failed: return '❌'
    case TransactionStatus.WaitingForConfirmation: return '⏳'
    case TransactionStatus.Burning: return '🔥'
    case TransactionStatus.Pending: return '🔄'
    default: return '🔄'
  }
}

function getStatusText(status: TransactionStatus): string {
  switch (status) {
    case TransactionStatus.Pending: return 'Pending'
    case TransactionStatus.Burning: return 'Burning tokens on Kujira'
    case TransactionStatus.WaitingForConfirmation: return 'Waiting for confirmation'
    case TransactionStatus.Completed: return 'Completed'
    case TransactionStatus.Failed: return 'Failed'
    default: return 'Unknown'
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function formatAmount(amount: string): string {
  return Number.parseFloat(amount).toFixed(6)
}

function formatAddress(address: string): string {
  return address.slice(0, 10) + '...' + address.slice(-8)
}

function formatTxHash(txHash: string): string {
  return txHash.slice(0, 10) + '...' + txHash.slice(-8)
}

function getTimeRemaining(): string {
  return `~${ESTIMATED_TIME_MINUTES} minutes`
}

function getKujiraExplorerUrl(txHash: string): string {
  return `${KUJIRA_EXPLORER_URL}/tx/${txHash}`
}

function getBscExplorerUrl(txHash: string): string {
  return `${BSC_CONFIG.blockExplorerUrls[0]}/tx/${txHash}`
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  }
  catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<template>
  <div class="transaction-status">
    <!-- Current Transaction -->
    <div v-if="currentTx" class="current-transaction">
      <h2>Bridge in Progress</h2>

      <div class="transaction-card card current">
        <div class="transaction-header">
          <div class="status-info">
            <span class="status-icon">{{ getStatusIcon(currentTx.status) }}</span>
            <span class="status-text" :style="{ color: getStatusColor(currentTx.status) }">
              {{ getStatusText(currentTx.status) }}
            </span>
          </div>
          <div class="time-info">
            {{ getTimeRemaining() }}
          </div>
        </div>

        <div class="transaction-details">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">Amount:</span>
              <span class="value">{{ formatAmount(currentTx.amount) }} LOCAL</span>
            </div>
            <div class="detail-item">
              <span class="label">From:</span>
              <span class="value monospace">{{ formatAddress(currentTx.kujiraAddress) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">To:</span>
              <span class="value monospace">{{ formatAddress(currentTx.bscRecipient) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Started:</span>
              <span class="value">{{ formatDate(currentTx.timestamp) }}</span>
            </div>
          </div>

          <div v-if="currentTx.kujiraTxHash" class="transaction-hash">
            <div class="hash-row">
              <span class="label">Kujira Tx:</span>
              <div class="hash-actions">
                <span class="hash-value monospace">
                  {{ formatTxHash(currentTx.kujiraTxHash) }}
                </span>
                <button
                  class="copy-btn"
                  title="Copy full hash"
                  @click="copyToClipboard(currentTx.kujiraTxHash!)"
                >
                  📋
                </button>
                <a
                  :href="getKujiraExplorerUrl(currentTx.kujiraTxHash)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="explorer-link"
                  title="View on Kujira explorer"
                >
                  🔗
                </a>
              </div>
            </div>
          </div>

          <div v-if="currentTx.bscTxHash" class="transaction-hash">
            <div class="hash-row">
              <span class="label">BSC Tx:</span>
              <div class="hash-actions">
                <span class="hash-value monospace">
                  {{ formatTxHash(currentTx.bscTxHash) }}
                </span>
                <button
                  class="copy-btn"
                  title="Copy full hash"
                  @click="copyToClipboard(currentTx.bscTxHash!)"
                >
                  📋
                </button>
                <a
                  :href="getBscExplorerUrl(currentTx.bscTxHash)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="explorer-link"
                  title="View on BSC explorer"
                >
                  🔗
                </a>
              </div>
            </div>
          </div>

          <div v-if="currentTx.errorMessage" class="error-display">
            {{ currentTx.errorMessage }}
          </div>
        </div>

        <!-- Progress Steps -->
        <div class="progress-steps">
          <div class="step active" :class="{ completed: currentTx.status !== TransactionStatus.Pending }">
            <div class="step-indicator" />
            <span>Transaction Submitted</span>
          </div>
          <div class="step" :class="{ active: currentTx.status === TransactionStatus.WaitingForConfirmation || currentTx.status === TransactionStatus.Completed, completed: currentTx.status === TransactionStatus.Completed }">
            <div class="step-indicator" />
            <span>Confirming on Kujira</span>
          </div>
          <div class="step" :class="{ active: currentTx.status === TransactionStatus.Completed, completed: currentTx.status === TransactionStatus.Completed }">
            <div class="step-indicator" />
            <span>Tokens Available on BSC</span>
          </div>
        </div>

        <div class="transaction-actions">
          <button
            class="secondary center-text"
            @click="bridgeStore.clearCurrentTransaction"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>

    <!-- Transaction History -->
    <div v-if="recentTransactions.length > 0" class="transaction-history">
      <h3>Recent Transactions</h3>

      <div class="history-list">
        <div
          v-for="tx in recentTransactions"
          :key="tx.id"
          class="transaction-card card history"
        >
          <div class="transaction-summary">
            <div class="summary-left">
              <span class="status-icon">{{ getStatusIcon(tx.status) }}</span>
              <div class="summary-info">
                <div class="amount">
                  {{ formatAmount(tx.amount) }} LOCAL
                </div>
                <div class="date">
                  {{ formatDate(tx.timestamp) }}
                </div>
              </div>
            </div>
            <div class="summary-right">
              <div class="status" :style="{ color: getStatusColor(tx.status) }">
                {{ tx.status }}
              </div>
              <div class="hash-actions">
                <template v-if="tx.kujiraTxHash">
                  <button
                    class="copy-btn small"
                    title="Copy Kujira hash"
                    @click="copyToClipboard(tx.kujiraTxHash)"
                  >
                    📋
                  </button>
                  <a
                    :href="getKujiraExplorerUrl(tx.kujiraTxHash)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="explorer-link small"
                    title="View on Kujira"
                  >
                    K
                  </a>
                </template>
                <template v-if="tx.bscTxHash">
                  <a
                    :href="getBscExplorerUrl(tx.bscTxHash)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="explorer-link small"
                    title="View on BSC"
                  >
                    B
                  </a>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!currentTx && recentTransactions.length === 0" class="empty-state card">
      <div class="empty-icon">
        🌉
      </div>
      <h3>No Transactions Yet</h3>
      <p>Your bridge transactions will appear here</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import '~/ui/style/tokens.scss';

.transaction-status {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;

  @include responsive(mobile) {
    padding: 16px;
  }
}

h2, h3 {
  color: $base-text;
  margin-bottom: 16px;
}

h2 {
  text-align: center;
  font-size: 24px;
  font-weight: $bold;
}

h3 {
  font-size: 18px;
  font-weight: $semi-bold;
}

.current-transaction {
  margin-bottom: 32px;
}

.transaction-card {
  margin-bottom: 16px;

  &.current {
    border-color: $primary;
  }
}

.transaction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  @include responsive(mobile) {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

.status-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  font-size: 20px;
}

.status-text {
  font-weight: $semi-bold;
  font-size: 16px;
}

.time-info {
  color: $gray700;
  font-size: 14px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: $gray150;
  border-radius: 8px;
}

.label {
  color: $gray700;
  font-size: 12px;
  font-weight: $semi-bold;
}

.value {
  color: $base-text;
  font-weight: $semi-bold;
  font-size: 12px;
}

.monospace {
  font-family: 'Courier New', monospace;
}

.transaction-hash {
  background: $gray150;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 20px;
}

.hash-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;

  @include responsive(mobile) {
    flex-direction: column;
    align-items: flex-start;
  }
}

.hash-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hash-value {
  color: $base-text;
  font-weight: $semi-bold;
  font-size: 12px;
}

.copy-btn, .explorer-link {
  padding: 4px 8px;
  border: none;
  background: $gray300;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  font-size: 12px;
  transition: background-color 0.2s ease;
  height: auto;

  &.small {
    padding: 2px 6px;
    font-size: 10px;
  }

  &:hover {
    background: $bg-hover;
  }
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  position: relative;
  gap: 16px;

  @include responsive(mobile) {
    flex-direction: column;
  }

  &::before {
    content: '';
    position: absolute;
    top: 12px;
    left: 20px;
    right: 20px;
    height: 2px;
    background: $gray300;
    z-index: 1;

    @include responsive(mobile) {
      display: none;
    }
  }
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  position: relative;
  z-index: 2;

  @include responsive(mobile) {
    flex-direction: row;
    justify-content: flex-start;
  }

  span {
    font-size: 12px;
    color: $gray700;
    text-align: center;
    max-width: 80px;

    @include responsive(mobile) {
      max-width: none;
      text-align: left;
    }
  }

  &.active span {
    color: $base-text;
    font-weight: $semi-bold;
  }
}

.step-indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: $gray300;
  border: 3px solid $gray200;
  transition: background-color 0.3s ease;
}

.step.active .step-indicator {
  background: $primary;
}

.step.active:not(.completed) .step-indicator {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.step.completed .step-indicator {
  background: $done;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

.transaction-actions {
  display: flex;
  justify-content: center;

  button {
    min-width: 150px;
  }
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transaction-card.history {
  padding: 16px;
}

.transaction-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;

  @include responsive(mobile) {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

.summary-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.summary-info .amount {
  font-weight: $semi-bold;
  color: $base-text;
  font-size: 14px;
}

.summary-info .date {
  font-size: 12px;
  color: $gray700;
}

.summary-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status {
  font-size: 12px;
  font-weight: $semi-bold;
  text-transform: capitalize;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: $gray700;

  h3 {
    margin-bottom: 8px;
    color: $base-text;
  }

  p {
    margin: 0;
  }
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-display {
  padding: 16px;
  background-color: rgba(220, 53, 69, 0.1);
  border: 1px solid #dc3545;
  border-radius: 8px;
  color: #dc3545;
  margin-bottom: 16px;
  font-size: 14px;
}
</style>
