import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { Decimal } from '@cosmjs/math'
import { kujiraService } from '~/services/kujira-bridge'
import { monitorService } from '~/services/monitor-bridge'
import type { BridgeTransaction, TransactionStatus } from '~/types/bridge'
import { TransactionStatus as TxStatus } from '~/types/bridge'
import { BRIDGE_FEE_BPS, ESTIMATED_TIME_MINUTES, KUJIRA_CONFIG } from '~/utils/bridge-constants'

const POLL_INTERVAL_MS = 5000 // Poll every 5 seconds
const MAX_POLL_ATTEMPTS = 240 // 20 minutes max (5s * 240 = 1200s = 20min)

export const useBridgeStore = defineStore('bridge', () => {
  // State
  const kujiraAddress = ref<string>('')
  const kujiraBalance = ref<string>('0')
  const isKujiraConnected = ref(false)
  const transactions = ref<BridgeTransaction[]>([])
  const currentTransaction = ref<BridgeTransaction | null>(null)
  const pollingIntervals = ref<Map<string, NodeJS.Timeout>>(new Map())
  const isMonitorHealthy = ref<boolean>(false)
  const isCheckingHealth = ref<boolean>(false)

  // Computed
  const pendingTransactions = computed(() =>
    transactions.value.filter(tx =>
      tx.status === TxStatus.Pending ||
      tx.status === TxStatus.Burning ||
      tx.status === TxStatus.WaitingForConfirmation
    )
  )

  const completedTransactions = computed(() =>
    transactions.value.filter(tx =>
      tx.status === TxStatus.Completed ||
      tx.status === TxStatus.Failed
    )
  )

  /**
   * Calculate bridge fee
   * Uses Decimal for precise financial calculations
   */
  const calculateFee = (amount: string): string => {
    try {
      const amountDecimal = Decimal.fromUserInput(amount, KUJIRA_CONFIG.coinDecimals)
      // Fee = amount * BRIDGE_FEE_BPS / 10000
      const feeAtomics = (BigInt(amountDecimal.atomics) * BigInt(BRIDGE_FEE_BPS)) / BigInt(10000)
      return Decimal.fromAtomics(feeAtomics.toString(), KUJIRA_CONFIG.coinDecimals).toString()
    } catch {
      return '0'
    }
  }

  /**
   * Calculate amount after fee
   * Uses Decimal for precise financial calculations
   */
  const calculateAmountAfterFee = (amount: string): string => {
    try {
      const amountDecimal = Decimal.fromUserInput(amount, KUJIRA_CONFIG.coinDecimals)
      const feeDecimal = Decimal.fromUserInput(calculateFee(amount), KUJIRA_CONFIG.coinDecimals)

      const afterFeeAtomics = BigInt(amountDecimal.atomics) - BigInt(feeDecimal.atomics)
      return Decimal.fromAtomics(afterFeeAtomics.toString(), KUJIRA_CONFIG.coinDecimals).toString()
    } catch {
      return '0'
    }
  }

  /**
   * Connect to Kujira wallet
   */
  const connectKujira = async (): Promise<void> => {
    try {
      const address = await kujiraService.connect()
      kujiraAddress.value = address
      isKujiraConnected.value = true

      // Update balance
      await updateKujiraBalance()
    } catch (error: any) {
      console.error('Error connecting to Kujira:', error)
      throw new Error(error.message || 'Failed to connect to Kujira wallet')
    }
  }

  /**
   * Disconnect from Kujira wallet
   */
  const disconnectKujira = (): void => {
    kujiraService.disconnect()
    // Clear all polling intervals to prevent memory leak
    pollingIntervals.value.forEach(interval => clearInterval(interval))
    pollingIntervals.value.clear()
    kujiraAddress.value = ''
    kujiraBalance.value = '0'
    isKujiraConnected.value = false
  }

  /**
   * Update Kujira balance
   */
  const updateKujiraBalance = async (): Promise<void> => {
    if (!isKujiraConnected.value) return

    try {
      const balance = await kujiraService.getBalance()
      kujiraBalance.value = balance
    } catch (error) {
      console.error('Error updating Kujira balance:', error)
    }
  }

  /**
   * Initiate bridge transaction
   */
  const initiateBridge = async (amount: string, bscRecipient: string): Promise<string> => {
    if (!isKujiraConnected.value) {
      throw new Error('Kujira wallet not connected')
    }

    try {
      // Create transaction record
      const txId = Date.now().toString()
      const transaction: BridgeTransaction = {
        id: txId,
        amount,
        bscRecipient,
        kujiraAddress: kujiraAddress.value,
        status: TxStatus.Pending,
        timestamp: Date.now(),
      }

      transactions.value.push(transaction)
      currentTransaction.value = transaction

      // Update status to burning
      updateTransactionStatus(txId, TxStatus.Burning)

      // Execute burn transaction
      const txHash = await kujiraService.burnTokens(amount, bscRecipient)

      // Update transaction with hash
      updateTransaction(txId, {
        kujiraTxHash: txHash,
        status: TxStatus.WaitingForConfirmation,
      })

      // Start polling for transaction status
      startPollingTransactionStatus(txHash, txId)

      // Update balance
      await updateKujiraBalance()

      return txHash
    } catch (error: any) {
      console.error('Error initiating bridge:', error)

      // Update transaction status to failed
      if (currentTransaction.value) {
        updateTransaction(currentTransaction.value.id, {
          status: TxStatus.Failed,
          errorMessage: error.message || 'Transaction failed',
        })
      }

      throw new Error(error.message || 'Failed to initiate bridge transaction')
    }
  }

  /**
   * Update transaction status
   */
  const updateTransactionStatus = (txId: string, status: TransactionStatus): void => {
    const tx = transactions.value.find(t => t.id === txId)
    if (tx) {
      tx.status = status
    }
  }

  /**
   * Update transaction
   */
  const updateTransaction = (txId: string, updates: Partial<BridgeTransaction>): void => {
    const index = transactions.value.findIndex(t => t.id === txId)
    if (index !== -1) {
      transactions.value[index] = {
        ...transactions.value[index],
        ...updates,
      }

      // Update current transaction if it's the one being updated
      if (currentTransaction.value && currentTransaction.value.id === txId) {
        currentTransaction.value = transactions.value[index]
      }
    }
  }

  /**
   * Get transaction by ID
   */
  const getTransaction = (txId: string): BridgeTransaction | undefined => {
    return transactions.value.find(t => t.id === txId)
  }

  /**
   * Clear current transaction
   */
  const clearCurrentTransaction = (): void => {
    currentTransaction.value = null
  }

  /**
   * Start polling for transaction status
   */
  const startPollingTransactionStatus = (txHash: string, txId: string): void => {
    let attempts = 0

    const poll = async () => {
      attempts++

      try {
        const status = await monitorService.getTransactionStatus(txHash)

        if (status) {
          // Update transaction status based on monitor response
          if (status.status === 'completed' && status.bsc_tx_hash) {
            updateTransaction(txId, {
              status: TxStatus.Completed,
              bscTxHash: status.bsc_tx_hash,
            })
            stopPollingTransactionStatus(txHash)
          } else if (status.status === 'failed') {
            updateTransaction(txId, {
              status: TxStatus.Failed,
              errorMessage: status.error_message || 'Bridge transaction failed',
            })
            stopPollingTransactionStatus(txHash)
          }
          // Keep polling if status is pending or processing
        }

        // Stop polling after max attempts
        if (attempts >= MAX_POLL_ATTEMPTS) {
          console.warn(`Max poll attempts reached for transaction ${txHash}`)
          updateTransaction(txId, {
            status: TxStatus.Failed,
            errorMessage: 'Transaction timeout - please check manually',
          })
          stopPollingTransactionStatus(txHash)
        }
      } catch (error) {
        console.error('Error polling transaction status:', error)
        // Continue polling on error
      }
    }

    // Start polling immediately, then every POLL_INTERVAL_MS
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    pollingIntervals.value.set(txHash, interval)
  }

  /**
   * Stop polling for transaction status
   */
  const stopPollingTransactionStatus = (txHash: string): void => {
    const interval = pollingIntervals.value.get(txHash)
    if (interval) {
      clearInterval(interval)
      pollingIntervals.value.delete(txHash)
    }
  }

  /**
   * Get estimated time
   */
  const getEstimatedTime = (): number => {
    return ESTIMATED_TIME_MINUTES
  }

  /**
   * Check monitor health
   */
  const checkMonitorHealth = async (): Promise<boolean> => {
    isCheckingHealth.value = true
    try {
      const healthy = await monitorService.checkHealth()
      isMonitorHealthy.value = healthy
      return healthy
    } catch (error) {
      console.error('Error checking monitor health:', error)
      isMonitorHealthy.value = false
      return false
    } finally {
      isCheckingHealth.value = false
    }
  }

  /**
   * Reset store state and cleanup resources
   * Clears all polling intervals to prevent memory leaks
   */
  const $reset = (): void => {
    // Clear all polling intervals
    pollingIntervals.value.forEach(interval => clearInterval(interval))
    pollingIntervals.value.clear()

    // Reset state
    transactions.value = []
    currentTransaction.value = null
    kujiraAddress.value = ''
    kujiraBalance.value = '0'
    isKujiraConnected.value = false

    // Disconnect service
    kujiraService.disconnect()
  }

  return {
    // State
    kujiraAddress,
    kujiraBalance,
    isKujiraConnected,
    transactions,
    currentTransaction,
    isMonitorHealthy,
    isCheckingHealth,

    // Computed
    pendingTransactions,
    completedTransactions,

    // Actions
    connectKujira,
    disconnectKujira,
    updateKujiraBalance,
    initiateBridge,
    updateTransactionStatus,
    updateTransaction,
    getTransaction,
    clearCurrentTransaction,
    calculateFee,
    calculateAmountAfterFee,
    getEstimatedTime,
    checkMonitorHealth,
    $reset,
  }
})
