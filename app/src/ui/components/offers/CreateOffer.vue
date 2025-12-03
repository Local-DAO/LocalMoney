<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import CurrencyInput from '../CurrencyInput.vue'
import {
  calculateFiatPriceByRate,
  convertMarginRateToOfferRate,
  formatAmount,
  formatEncryptedUserContact,
  isTelegramHandleValid,
  removeTelegramHandlePrefix,
} from '~/shared'
import type { Denom } from '~/types/components.interface'
import { FiatCurrency, OfferType } from '~/types/components.interface'
import { useClientStore } from '~/stores/client'
import { defaultMicroDenomAvailable, denomsAvailable, microDenomToDisplay, checkMicroDenomAvailable } from '~/utils/denom'
import { fiatsAvailable } from '~/utils/fiat'

const emit = defineEmits<{
  (e: 'cancel'): void
}>()
const client = useClientStore()
const secrets = computed(() => client.getSecrets())

async function defaultUserContact() {
  const contact = client.profile?.contact
  return formatEncryptedUserContact(secrets.value.privateKey, contact)
}
const minAmount = ref(0)
const maxAmount = ref(0)
const margin = ref('above')
const marginOffset = ref('0')
const ownerContact = ref('')
const description = ref('')
const marginOffsetUnmasked = ref(0)
const rate = ref(100)
const selectedDenom = useLocalStorage<string>('selected_offer_denom', defaultMicroDenomAvailable(client.chainClient))
const selectedFiat = useLocalStorage<FiatCurrency>('selected_offer_fiat', FiatCurrency.USD)
const selectedType = useLocalStorage<OfferType>('selected_offer_type', OfferType.sell)

const valid = computed(() => {
  const denomFiatPrice = client.getFiatPrice(selectedFiat.value, { native: selectedDenom.value })
  return maxAmount.value > minAmount.value && 
         isTelegramHandleValid(ownerContact.value) && 
         denomFiatPrice > 0 // Ensure exchange rate is available
})
const offerPrice = computed(() => {
  const denomFiatPrice = client.getFiatPrice(selectedFiat.value, { native: selectedDenom.value })
  if (denomFiatPrice === 0) {
    // Show loading or unavailable message when price is not available
    return `${selectedFiat.value} -`
  }
  const fiatPrice = calculateFiatPriceByRate(denomFiatPrice * 100, rate.value) / 100
  return `${selectedFiat.value} ${formatAmount(fiatPrice, false)}`
})
const fiatLabel = computed(() => (selectedType.value === 'sell' ? 'receive' : 'pay'))

// Price updates handled by backend/oracle
watch(selectedFiat, () => {
  // Exchange rates will be fetched when needed during price calculations
})

// TODO - Make isMobile global
const width = ref(window.innerWidth)
const listener = () => {
  width.value = window.innerWidth
}
onMounted(() => {
  window.addEventListener('resize', listener)
  nextTick(async () => {
    ownerContact.value = await defaultUserContact()
  })
})
onBeforeMount(async () => {
  // Check if stored denom is valid for current chain
  if (!checkMicroDenomAvailable(selectedDenom.value, client.chainClient)) {
    selectedDenom.value = defaultMicroDenomAvailable(client.chainClient)
  }
  
  
  // Price updates handled by backend/oracle
})
onUnmounted(() => {
  window.removeEventListener('resize', listener)
})
const isMobile = computed(() => width.value <= 550)

// Get the viewport height and store in a variable
const vh = window.innerHeight * 0.01
document.documentElement.style.setProperty('--vh', `${vh}px`)

function calculateMarginRate() {
  // Ensure marginOffsetUnmasked is a valid number
  const offsetValue = Number(marginOffsetUnmasked.value) || 0
  const newRate = convertMarginRateToOfferRate(margin.value, offsetValue)
  rate.value = newRate
  console.log('Calculated rate:', { 
    margin: margin.value, 
    marginOffset: marginOffset.value,
    marginOffsetUnmasked: marginOffsetUnmasked.value,
    offsetValue, 
    newRate,
    rate: rate.value 
  })
}
function onMaskaMargin(e: any) {
  const rawValue = e?.target?.dataset?.maskRawValue ?? e?.detail?.unmasked ?? e?.detail?.masked
  const parsed = Number(typeof rawValue === 'string' ? rawValue : `${rawValue ?? ''}`)
  marginOffsetUnmasked.value = isNaN(parsed) ? 0 : parsed
  calculateMarginRate()
  console.log('Maska event:', { raw: rawValue, parsed: marginOffsetUnmasked.value, rate: rate.value })
}

// Keep rate in sync when marginOffset string changes
watch(marginOffset, (val) => {
  let num = 0
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '')
    num = Number(cleaned)
  } else {
    num = Number(val)
  }
  marginOffsetUnmasked.value = isNaN(num) ? 0 : num
  calculateMarginRate()
})
async function createOffer() {
  // Recalculate rate before creating to ensure it's up to date
  calculateMarginRate()
  
  // Validate rate is a valid number
  if (isNaN(rate.value) || rate.value <= 0) {
    console.error('Invalid rate value:', rate.value)
    return
  }
  
  console.log('Creating offer with rate:', rate.value)
  
  await client.createOffer({
    telegram_handle: removeTelegramHandlePrefix(ownerContact.value),
    offer_type: selectedType.value,
    fiat_currency: selectedFiat.value,
    rate: `${Math.floor(rate.value)}`,
    denom: { native: selectedDenom.value },
    min_amount: minAmount.value,
    max_amount: maxAmount.value,
    description: description.value,
  })
  emit('cancel')
}
// Watch for margin direction changes
watch(margin, () => {
  calculateMarginRate()
})
watch(selectedDenom, async () => {
  // Validate denom when changed
  if (!checkMicroDenomAvailable(selectedDenom.value, client.chainClient)) {
    selectedDenom.value = defaultMicroDenomAvailable(client.chainClient)
  }
})
watch(selectedFiat, async () => {
  // Price updates handled by backend/oracle
})
</script>

<template>
  <div class="main-wrap card">
    <div class="header-wrap">
      <p>Create Offer</p>
      <div v-if="isMobile" class="close" @click="$emit('cancel')">
        <svg class="icon-24" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18" stroke="inherit" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M6 6L18 18" stroke="inherit" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    </div>
    <div class="buy-sell">
      <button :class="{ focus: selectedType === 'buy' }" @click="selectedType = 'buy'">Buy</button>
      <div class="separator" />
      <button :class="{ focus: selectedType === 'sell' }" @click="selectedType = 'sell'">Sell</button>
    </div>

    <div class="inner-content">
      <div class="currency">
        <div class="wrap">
          <label for="crypto">I want to {{ selectedType }}</label>
          <CustomSelect v-model="selectedDenom" :options="denomsAvailable(client.chainClient)" />
        </div>
        <div class="wrap">
          <label for="currency">and {{ fiatLabel }} in</label>
          <CustomSelect v-model="selectedFiat" :options="fiatsAvailable" />
        </div>
      </div>
      <div class="divider" />
      <div class="min-max">
        <div class="wrap">
          <label>Min amount of {{ microDenomToDisplay(selectedDenom, client.chainClient) }}</label>
          <CurrencyInput
            v-model="minAmount"
            placeholder="0"
            :prefix="microDenomToDisplay(selectedDenom, client.chainClient)"
            :isCrypto="true"
            :decimals="6"
          />
        </div>
        <div class="wrap">
          <label>Max amount of {{ microDenomToDisplay(selectedDenom, client.chainClient) }}</label>
          <CurrencyInput
            v-model="maxAmount"
            placeholder="0"
            :prefix="microDenomToDisplay(selectedDenom, client.chainClient)"
            :isCrypto="true"
            :decimals="6"
          />
        </div>
      </div>
      <div class="market-price">
        <div class="wrap">
          <div class="wrap-label">
            <label for="">Market price</label>
            <IconTooltip content="Select if you want to charge above or below the market price." />
          </div>
          <select v-model="margin" class="bg-surface">
            <option value="above">Above</option>
            <option value="below">Below</option>
          </select>
        </div>
        <div class="wrap">
          <div class="wrap-label">
            <label for="">Margin</label>
            <IconTooltip content="Select by how much you would like your price to be adjusted." />
          </div>
          <input
            v-model="marginOffset"
            v-maska="['##%', '#%']"
            type="text"
            placeholder="0%"
            @maska="onMaskaMargin"
          />
        </div>
      </div>

      <div class="divider" />

      <div class="chat">
        <div class="wrap">
          <div class="wrap-label">
            <label for="crypto">Your Telegram username</label>
            <IconTooltip
              content="Share your contact to be able to communicate with the other trader. This information will be encrypted and only visible inside the trade."
            />
          </div>
          <input v-model="ownerContact" type="text" placeholder="@username" />
        </div>
      </div>

      <div class="description">
        <div class="wrap">
          <div class="wrap-label">
            <label>Offer description</label>
            <IconTooltip content="Here you can write the payment options you will be accepting for this offer." />
          </div>
          <textarea v-model="description" maxlength="90" minlength="3" placeholder="Bank transfer, Paypal, Cash..." />
        </div>
      </div>

      <div class="divider" />
    </div>

    <div class="wrap-footer">
      <div class="fiat-price">
        <p class="value">1 {{ microDenomToDisplay(selectedDenom, client.chainClient) }} = {{ offerPrice }}</p>
      </div>
      <div class="btns">
        <button class="secondary" @click="$emit('cancel')">Cancel</button>
        <!-- <button class="primary" :disabled="!valid" @click="createOffer()">Create</button> -->
        <button class="primary" @click="createOffer()">Create</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import '../../style/tokens.scss';
@import '../../style/elements.scss';

.main-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0px;
  background-color: $gray150 !important;

  @media only screen and (max-width: $mobile) {
    width: 100%;
    height: 600vh;
    height: calc(var(--vh, 1vh) * 100);
    overflow-y: scroll;
  }
}

.header-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;

  svg {
    stroke: $gray600;
  }
}

.buy-sell {
  display: flex;
  margin: 24px 0 24px;
}

.inner-content {
  .currency,
  .min-max,
  .market-price,
  .description,
  .chat {
    display: flex;
    gap: 24px;
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }

    .wrap {
      display: flex;
      flex-direction: column;
      width: 100%;

      .wrap-label {
        display: flex;
        gap: 8px;
      }

      label {
        font-size: 14px;
        font-weight: 400;
        color: $gray900;
        margin-bottom: 8px;

        @media only screen and (max-width: $mobile) {
          font-size: 12px;
        }
      }

      input {
        width: 100%;
        background-color: $background;
      }
      textarea {
        background-color: $background;
      }
    }
  }

  .currency {
    @media only screen and (max-width: $mobile) {
      flex-direction: column;
    }
  }
}

.divider {
  width: 100%;
  height: 1px;
  background-color: $border;
  margin: 32px 0;
}

.wrap-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;

  @media only screen and (max-width: $mobile) {
    padding-bottom: 64px;
  }

  .fiat-price {
    @media only screen and (max-width: $mobile) {
      font-size: 12px;
    }
  }

  .btns {
    display: flex;
    justify-content: flex-end;
    gap: 16px;
    margin-top: 0px;
  }
}
</style>
