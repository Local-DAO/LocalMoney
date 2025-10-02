<script setup lang="ts">
import type { TradeInfo } from '~/types/components.interface'
import { TradeState } from '~/types/components.interface'
import { useClientStore } from '~/stores/client'
import { formatAddress } from '~/shared'
import { decryptData, encryptData } from '~/utils/crypto'
import { formatTimer } from '~/utils/formatters'

const props = defineProps<{
  tradeInfo: TradeInfo
  walletAddress: String
}>()
const client = useClientStore()
const secrets = computed(() => client.getSecrets())
const profile = computed(() => client.profile)

const isBuyer = computed(() => props.tradeInfo.trade.buyer?.toLowerCase() === props.walletAddress?.toLowerCase())
const isSeller = computed(() => props.tradeInfo.trade.seller?.toLowerCase() === props.walletAddress?.toLowerCase())

const timeToEnableDispute = computed(() => {
  const currentTime = Date.now()
  const enablesDisputeAt = (props.tradeInfo.trade.enables_dispute_at ?? 0) * 1000
  return new Date(enablesDisputeAt - currentTime)
})

const disputeWinner = computed(() => {
  const taker = `${formatAddress(getTaker())}`
  const maker = `${formatAddress(getMaker())}`
  const winner = props.tradeInfo.trade.state === 'settled_for_taker' ? taker : maker
  return `${winner}`
})

const lastTradeState = computed(() => {
  const lastIndex = props.tradeInfo.trade.state_history.length - 1
  return props.tradeInfo.trade.state_history[lastIndex].state
})

const isTradeExpired = computed(() => {
  const currentTime = Date.now()
  const expiresAt = (props.tradeInfo.trade.expires_at ?? 0) * 1000
  return expiresAt > 0 && currentTime > expiresAt
})

const isEVM = computed(() => {
  return client.chainClient.includes('BSC') || client.chainClient.includes('ETH') || client.chainClient.includes('POLYGON')
})

function getMaker(): string {
  return props.tradeInfo.offer.offer.owner
}

function getTaker(): string {
  const maker = getMaker()
  return props.tradeInfo.trade.buyer === maker ? props.tradeInfo.trade.seller : props.tradeInfo.trade.buyer
}

async function acceptTradeRequest(id: number) {
  try {
    // Check if we're on an EVM chain (encryption not yet implemented for EVM)
    const isEVM = client.chainClient.includes('BSC') || client.chainClient.includes('ETH') || client.chainClient.includes('POLYGON')
    
    if (isEVM) {
      // For EVM chains, skip encryption for now
      await client.acceptTradeRequest(id, '')
    } else {
      // For Cosmos chains, use encryption
      const takerPubKey = props.tradeInfo.trade.seller_encryption_key
      if (!takerPubKey) {
        throw new Error('Seller does not have an encryption key')
      }
      
      const decryptedContact = await decryptData(secrets.value.privateKey, profile.value.contact!)
      const ownerContact = await encryptData(takerPubKey, decryptedContact)
      await client.acceptTradeRequest(id, ownerContact)
    }
  } catch (e) {
    console.error('Failed to accept trade request:', e)
    throw new Error('Failed to accept trade request. Please check your encryption keys and try again.')
  }
}

async function cancelTradeRequest(id: number) {
  await client.cancelTradeRequest(id)
}

async function fundEscrow(tradeInfo: TradeInfo) {
  try {
    // Check if we're on an EVM chain (encryption not yet implemented for EVM)
    const isEVM = client.chainClient.includes('BSC') || client.chainClient.includes('ETH') || client.chainClient.includes('POLYGON')
    
    if (isEVM) {
      // For EVM chains, skip encryption for now
      await client.fundEscrow(tradeInfo, '')
    } else {
      // For Cosmos chains, use encryption
      const buyerPubKey = props.tradeInfo.trade.buyer_encryption_key
      if (!buyerPubKey) {
        throw new Error('Buyer does not have an encryption key')
      }
      
      const decryptedContact = await decryptData(secrets.value.privateKey, profile.value.contact!)
      const ownerContact = await encryptData(buyerPubKey, decryptedContact)
      await client.fundEscrow(tradeInfo, ownerContact)
    }
  } catch (e: any) {
    console.error('Failed to fund escrow:', e)
    // Pass through specific error messages for balance issues
    if (e?.message?.includes('Insufficient') || e?.message?.includes('balance')) {
      throw e
    }
    throw new Error('Failed to fund escrow. Please check your encryption keys and try again.')
  }
}

async function setFiatDeposited(id: number) {
  await client.setFiatDeposited(id)
}

async function releaseEscrow(id: number) {
  await client.releaseEscrow(id)
}

async function refundEscrow(id: number) {
  await client.refundEscrow(id)
}

async function openDispute(id: number) {
  try {
    // Check if we're on an EVM chain (encryption not yet implemented for EVM)
    const isEVM = client.chainClient.includes('BSC') || client.chainClient.includes('ETH') || client.chainClient.includes('POLYGON')
    
    if (isEVM) {
      // For EVM chains, use plaintext contacts for now
      const buyerContact = props.tradeInfo.trade.buyer_contact || ''
      const sellerContact = props.tradeInfo.trade.seller_contact || ''
      await client.openDispute(id, buyerContact, sellerContact)
    } else {
      // For Cosmos chains, use encryption
      let buyerContact = ''
      let sellerContact = ''
      
      // Decrypt user's own contact
      const userDecryptedContact = await decryptData(secrets.value.privateKey, profile.value.contact!)
      
      if (isBuyer.value) {
        // Decrypt seller's contact
        const sellerDecryptedContact = await decryptData(secrets.value.privateKey, props.tradeInfo.trade.seller_contact!)
        
        // Encrypt both contacts for arbitrator
        if (props.tradeInfo.trade.arbitrator_encryption_key) {
          buyerContact = await encryptData(props.tradeInfo.trade.arbitrator_encryption_key, userDecryptedContact)
          sellerContact = await encryptData(props.tradeInfo.trade.arbitrator_encryption_key, sellerDecryptedContact)
        } else {
          // Fallback to plaintext if no arbitrator encryption key
          console.warn('No arbitrator encryption key, using plaintext contacts')
          buyerContact = userDecryptedContact
          sellerContact = sellerDecryptedContact
        }
      } else {
        // Decrypt buyer's contact
        const buyerDecryptedContact = await decryptData(secrets.value.privateKey, props.tradeInfo.trade.buyer_contact!)
        
        // Encrypt both contacts for arbitrator
        if (props.tradeInfo.trade.arbitrator_encryption_key) {
          sellerContact = await encryptData(props.tradeInfo.trade.arbitrator_encryption_key, userDecryptedContact)
          buyerContact = await encryptData(props.tradeInfo.trade.arbitrator_encryption_key, buyerDecryptedContact)
        } else {
          // Fallback to plaintext if no arbitrator encryption key
          console.warn('No arbitrator encryption key, using plaintext contacts')
          sellerContact = userDecryptedContact
          buyerContact = buyerDecryptedContact
        }
      }
      
      await client.openDispute(id, buyerContact, sellerContact)
    }
  } catch (e) {
    console.error('Failed to open dispute:', e)
    throw new Error('Failed to open dispute. Please check your encryption keys and try again.')
  }
}

async function settleDispute(winner: string) {
  await client.settleDispute(props.tradeInfo.trade.id, winner)
}
</script>

<template>
  <section class="actions card">
    <!-- # If the user is buying crypto (Buyer) -->
    <div v-if="isBuyer">
      <!-- #1 step (Optional) -->
      <!-- # A Seller requested a trade with the Buyer and it should be accepted first. -->
      <TradeAction
        v-if="tradeInfo.offer.offer.offer_type === 'buy' && tradeInfo.trade.state === 'request_created'"
        message="Review the request and accept the trade"
        :buttons="[
          {
            label: 'accept trade',
            action: () => {
              acceptTradeRequest(tradeInfo.trade.id)
            },
          },
        ]"
      />
      <!-- #2 step or #1 step -->
      <!-- if #2 step: The Buyer accepted the request and needs to wait for the Seller to deposit crypto on escrow -->
      <!-- if #1 step: The Buyer requested a trade and the Seller should accept the trade by depositing the crypto on escrow -->
      <TradeAction
        v-if="
          (tradeInfo.offer.offer.offer_type === 'sell' && tradeInfo.trade.state === 'request_created') ||
          tradeInfo.trade.state === 'request_accepted'
        "
        message="Waiting for the trade to be funded"
      />
      <!-- #3 step or #2 step -->
      <!-- The crypto is on the escrow, so the Buyer needs to make the off-chain payment to mark as payed on the blockchain -->
      <TradeAction
        v-if="tradeInfo.trade.state === 'escrow_funded'"
        message="Only press the mark as paid button after you made the payment"
        :buttons="[
          {
            label: 'mark as paid',
            action: () => {
              setFiatDeposited(tradeInfo.trade.id)
            },
          },
        ]"
      />
      <!-- #4 step or #3 step -->
      <!-- After the off-chain payment, the Buyer needs to wait for the Seller to release the funds on escrow -->
      <TradeAction v-if="tradeInfo.trade.state === 'fiat_deposited'" message="Waiting for the funds to be released" />
      <!-- #5 step or #4 step -->
      <!-- The Seller released the funds on escrow, so the Buyer already received the money on his wallet -->
      <TradeAction
        v-if="tradeInfo.trade.state === 'escrow_released'"
        icon="check"
        message="Trade finished successfully"
      />
      <!-- expired state -->
      <TradeAction 
        v-if="tradeInfo.trade.state === TradeState.request_expired || (isTradeExpired && tradeInfo.trade.state !== TradeState.escrow_funded)" 
        message="This trade has expired" 
      />
      <!-- expired state with funds in escrow (EVM chains - buyer can't dispute from this state) -->
      <TradeAction 
        v-if="isTradeExpired && tradeInfo.trade.state === TradeState.escrow_funded" 
        message="This trade has expired. The seller needs to claim their refund." 
      />
      <!-- Trade canceled -->
      <TradeAction
        v-if="['request_canceled', 'escrow_canceled', 'escrow_refunded'].includes(tradeInfo.trade.state)"
        message="This trade has been canceled"
      />
    </div>

    <!-- # If the user is selling crypto (Seller) -->
    <div v-if="isSeller">
      <!-- #1 step (Optional) -->
      <!-- # The Seller opens the trade with the Buyer and it should be accepted first. So the Seller needs to wait. -->
      <TradeAction
        v-if="tradeInfo.offer.offer.offer_type === 'buy' && tradeInfo.trade.state === 'request_created'"
        message="Waiting for the buyer to accept the trade"
      />
      <!-- #1 step for sell offers -->
      <!-- When a buyer requests a trade on a sell offer, the seller needs to accept it first -->
      <TradeAction
        v-if="tradeInfo.offer.offer.offer_type === 'sell' && tradeInfo.trade.state === 'request_created'"
        message="Review the request and accept the trade"
        :buttons="[
          {
            label: 'accept trade',
            action: () => {
              acceptTradeRequest(tradeInfo.trade.id)
            },
          },
        ]"
      />
      <!-- #2 step -->
      <!-- After the trade is accepted, the Seller needs to deposit crypto on escrow -->
      <TradeAction
        v-if="tradeInfo.trade.state === 'request_accepted'"
        message="Please fund the trade"
        :buttons="[
          {
            label: 'fund trade',
            action: () => {
              fundEscrow(tradeInfo)
            },
          },
        ]"
      />
      <!-- #3 step or #2 step -->
      <!-- The crypto is on the escrow, so the Buyer needs to make the off-chain payment to mark as payed on the blockchain -->
      <TradeAction
        v-if="tradeInfo.trade.state === 'escrow_funded'"
        message="Waiting for the buyer to make the payment"
      />
      <!-- #4 step or #3 step -->
      <!-- After the off-chain payment, the Seller needs to check the off-chain payment and release the crypto on the escrow to the Buyer -->
      <TradeAction
        v-if="tradeInfo.trade.state === 'fiat_deposited'"
        message="Only release the funds after confirming the payment"
        :buttons="[
          {
            label: 'release funds',
            action: () => {
              releaseEscrow(tradeInfo.trade.id)
            },
          },
        ]"
      />
      <!-- #5 step or #4 step -->
      <!-- The Seller released the funds on escrow, so the Buyer already received the money on his wallet -->
      <TradeAction
        v-if="tradeInfo.trade.state === 'escrow_released'"
        icon="check"
        message="Trade finished successfully"
      />
      <!-- Expired state -->
      <template v-if="tradeInfo.trade.state === TradeState.request_expired || (isTradeExpired && tradeInfo.trade.state === TradeState.escrow_funded)">
        <!-- With funds -->
        <TradeAction
          v-if="lastTradeState === TradeState.escrow_funded || tradeInfo.trade.state === TradeState.escrow_funded"
          message="This trade has expired. You have funds to be claimed."
          :buttons="[
            {
              label: 'claim funds',
              action: () => {
                refundEscrow(tradeInfo.trade.id)
              },
            },
          ]"
        />
        <!-- When refunded -->
        <TradeAction
          v-else-if="lastTradeState === TradeState.escrow_refunded"
          icon="check"
          message="Funds claimed successfully"
        />
        <!-- Without funds -->
        <TradeAction v-else message="This trade has expired" />
      </template>

      <!-- Trade canceled -->
      <TradeAction v-if="tradeInfo.trade.state === 'request_canceled'" message="This trade has been canceled" />

      <!-- Trade canceled -->
      <TradeAction
        v-if="tradeInfo.trade.state === 'escrow_canceled'"
        message="This trade has been canceled. You have funds to be claimed. "
        :buttons="[
          {
            label: 'claim funds',
            action: () => {
              refundEscrow(tradeInfo.trade.id)
            },
          },
        ]"
      />
      <!-- Trade Refunded -->
      <TradeAction
        v-if="tradeInfo.trade.state === 'escrow_refunded'"
        icon="check"
        message="Funds claimed successfully"
      />
    </div>

    <!-- Trade Disputed -->
    <template v-if="tradeInfo.trade.state === 'escrow_disputed'">
      <TradeAction
        v-if="tradeInfo.trade.arbitrator?.toLowerCase() === client.userWallet.address?.toLowerCase()"
        message="Carefully review the information provided by both parties before reaching a verdict"
        :buttons="[
          {
            label: 'vote maker',
            action: () => {
              settleDispute(getMaker())
            },
          },
          {
            label: 'vote taker',
            action: () => {
              settleDispute(getTaker())
            },
          },
        ]"
      />
      <TradeAction v-else message="Dispute in progress, please wait while a decision is being made." />
    </template>

    <!-- Dispute Settled -->
    <template v-if="['settled_for_taker', 'settled_for_maker'].includes(tradeInfo.trade.state)">
      <TradeAction icon="check" message="Dispute settled for" :subMessage="disputeWinner" />
    </template>
  </section>

  <section class="sub-actions">
    <div
      v-if="
        tradeInfo.trade.state === 'request_created' ||
        tradeInfo.trade.state === 'request_accepted' ||
        (tradeInfo.trade.state === 'escrow_funded' && isBuyer)
      "
      class="wrap"
    >
      <p>Please note that requesting to cancel the transaction could impact on your reputation.</p>
      <p class="btn-action" @click="cancelTradeRequest(tradeInfo.trade.id)">Request cancel</p>
    </div>
    <!-- Show dispute option for trades in fiat_deposited state -->
    <template v-if="tradeInfo.trade.state === 'fiat_deposited'">
      <div v-if="timeToEnableDispute.getTime() > 0" class="wrap">
        <p>
          Depending on your choice of payment method, it can take a little longer to confirm the transaction. If this
          does not happen, an option to open a dispute will be available in
          {{ formatTimer(timeToEnableDispute, '00h 00m 00s') }}.
        </p>
      </div>
      <div v-else class="wrap">
        <p>
          If you run into problems with the transaction you can request to open a dispute. Only do this if you already
          tried to contact the other trader without success.
        </p>
        <p class="btn-action" @click="openDispute(tradeInfo.trade.id)">Request dispute</p>
      </div>
    </template>
    <!-- Show dispute option for expired trades (EVM chains: only from fiat_deposited state) -->
    <template v-if="(tradeInfo.trade.state === 'request_expired' || isTradeExpired) && tradeInfo.trade.state === 'fiat_deposited'">
      <div v-if="timeToEnableDispute.getTime() > 0" class="wrap">
        <p>
          This trade has expired. A dispute option will be available in
          {{ formatTimer(timeToEnableDispute, '00h 00m 00s') }}.
        </p>
      </div>
      <div v-else class="wrap">
        <p>
          This trade has expired. You can open a dispute to resolve this issue.
        </p>
        <p class="btn-action" @click="openDispute(tradeInfo.trade.id)">Request dispute</p>
      </div>
    </template>
    <!-- Show dispute option for expired trades (Cosmos chains: also from escrow_funded) -->
    <template v-if="!isEVM && (tradeInfo.trade.state === 'request_expired' || isTradeExpired) && tradeInfo.trade.state === 'escrow_funded'">
      <div v-if="timeToEnableDispute.getTime() > 0" class="wrap">
        <p>
          This trade has expired with funds in escrow. A dispute option will be available in
          {{ formatTimer(timeToEnableDispute, '00h 00m 00s') }}.
        </p>
      </div>
      <div v-else class="wrap">
        <p>
          This trade has expired with funds in escrow. You can open a dispute to resolve this issue.
        </p>
        <p class="btn-action" @click="openDispute(tradeInfo.trade.id)">Request dispute</p>
      </div>
    </template>
    <!-- Show dispute option for escrow_funded state after dispute deadline (Cosmos only, non-expired) -->
    <template v-if="!isEVM && tradeInfo.trade.state === 'escrow_funded' && !isTradeExpired && isSeller && timeToEnableDispute.getTime() <= 0">
      <div class="wrap">
        <p>
          The buyer has not marked the payment as complete. You can open a dispute to resolve this issue.
        </p>
        <p class="btn-action" @click="openDispute(tradeInfo.trade.id)">Request dispute</p>
      </div>
    </template>
  </section>
</template>

<style lang="scss" scoped>
@import '../../style/pages';

.actions {
  margin-top: 24px;
}

.sub-actions {
  height: 64px;

  .wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: end;
    gap: 8px;
    margin-top: 24px;
    text-align: right;
    font-size: 14px;
    color: $gray700;

    p {
      max-width: 400px;

      &:first-child {
        font-size: 12px;
      }
    }

    .btn-action {
      cursor: pointer;
      text-decoration: underline;
    }
  }
}

button {
  background-color: $gray300;
  color: $primary;
  margin-left: auto;
  margin-top: 24px;
}
</style>
