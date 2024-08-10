<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import type { Denom, OfferResponse } from '~/types/components.interface'
import { FiatCurrency, OfferOrder, OfferType, isFiatCurrency, isOfferType } from '~/types/components.interface'
import { useClientStore } from '~/stores/client'
import { ExpandableItem } from '~/ui/components/util/ExpandableItem'
import { defaultMicroDenomAvailable, denomsAvailable, displayToDenom } from '~/utils/denom'
import { fiatsAvailable } from '~/utils/fiat'
import { checkValidOffer } from '~/utils/validations'
import { AppEvents, trackAppEvents } from '~/analytics/analytics'
import { AxelarQueryAPI, Environment } from '@axelar-network/axelarjs-sdk'
import { defaultAbiCoder, arrayify, hexZeroPad, hexlify, toUtf8Bytes } from 'ethers/lib/utils'

const client = useClientStore()
const route = useRoute()
const offersResult = computed(() => client.offers)
const page = reactive({ offers: [] as ExpandableItem<OfferResponse>[] })
client.$subscribe((mutation, state) => {
  if (state.offers.isSuccess()) {
    page.offers = state.offers.data
      .filter((offerResponse) => checkValidOffer(offerResponse.offer, client.chainClient))
      .flatMap((offerResponse) => new ExpandableItem(offerResponse))
  }
})

const selectedDenom = useLocalStorage<string>('selected_offer_denom', defaultMicroDenomAvailable(client.chainClient))
const selectedFiat = useLocalStorage<FiatCurrency>('selected_offer_fiat', FiatCurrency.USD)
const selectedType = useLocalStorage<OfferType>('selected_offer_type', OfferType.sell)

const selectedOfferItem = ref<ExpandableItem<OfferResponse> | null>(null)
const paginationLastItem = ref<number>(0)

function selectOffer(offerItem: ExpandableItem<OfferResponse>) {
  if (selectedOfferItem.value !== null) {
    selectedOfferItem.value.isExpanded = false
  }
  offerItem.isExpanded = true
  selectedOfferItem.value = offerItem
}

function unselectOffer(offerItem: ExpandableItem<OfferResponse>) {
  offerItem.isExpanded = false
}

async function fetchOffers() {
  const filterArgs = {
    fiatCurrency: selectedFiat.value,
    offerType: selectedType.value,
    denom: { native: selectedDenom.value },
    order: OfferOrder.trades_count,
  }
  await client.fetchOffers(filterArgs)
  trackAppEvents(AppEvents.list_offers, filterArgs)
}

async function fetchMoreOffers() {
  const lastIndex = offersResult.value.data.length
  paginationLastItem.value = lastIndex > 0 ? offersResult.value.data[lastIndex - 1].offer.id : 0
  await client.fetchMoreOffers(
    {
      fiatCurrency: selectedFiat.value,
      offerType: selectedType.value,
      denom: { native: selectedDenom.value },
      order: OfferOrder.trades_count,
    },
    paginationLastItem.value
  )
}

async function updateFiatPrice() {
  const denom: Denom = { native: selectedDenom.value }
  await client.updateFiatPrice(selectedFiat.value, denom)
}

onBeforeMount(() => {
  const denomDisplayName = (route.params.token as string) ?? ''
  const fiat = (route.params.fiat as string) ?? ''
  const type = (route.params.type as string) ?? ''
  const denom = displayToDenom(denomDisplayName, client.chainClient)
  if (denom && isFiatCurrency(fiat) && isOfferType(type)) {
    selectedDenom.value = denom
    selectedFiat.value = fiat as FiatCurrency
    selectedType.value = type === OfferType.buy ? OfferType.sell : OfferType.buy
  }
})

onMounted(async () => {
  await updateFiatPrice()
  await fetchOffers()
  // Estimate AxelarGateway fees
  const axlApi = new AxelarQueryAPI({
    environment: Environment.MAINNET
  })
  const sourceChainId = 'avalanche'
  const destinationChainId = 'kujira'
  const gasLimit = 3700000
  axlApi.estimateGasFee(sourceChainId, destinationChainId, gasLimit).then((res) => {
    console.log('AxelarGateway fees', res)
  })
  const contractCallParams = {"create":{
    "offer_id": 182,
    "amount": "2000000",
    "taker": "kujira1ngs0lz0d95r48vnalk8rnz2qp4mr3vdywj4mu6",
    "profile_taker_contact": "WUmDNsy4+LITT25RBzKxfVy3zaQIvrhIfWvP30Bng2xo4ylu2F5YwgqfUIpG41yA14WZhCMVvdFJnkjbxiRuxaBkmcB7b1xlNqKB1at99HbHwB1kO7e9Aer6c1KPP9VciTzg5w+TPlO8GyaDFbUzuHyOOU2++QEpB66NmudY/dSIN4y1MEkJFTGBwCMu9uq7tImcyI8Pazkyq3VEdCL6vOMThYUqBLzNL+aCMHAyJ0yndE7RTZT4YkG7cqKY9yAvRK7oehzicvNjAEKlOyVeNKtruP1yoAByrO/PiRqMtsWRZ7kXXlXUcMXrWDKRkrY5HoCFn4/gDiQ7D+2DPex3oA==",
    "taker_contact": "ZWcdq2GFr7EC+pxs7DL6vHgLHwvVby4oe4nxSSqXZq3bSel5jHFMxeSfoT9JnYdASwWdn0bEsxqElbgRvpjYHSZxBrGV+R6fVaWhvYSyXcH70b6uT8q2ao5LnAVeXeSEsBOJJT9dceF1ghaGIeXTaxBjBt+7cS0t526ad/D23/iGpCeaPq2M/s4t0E4OTXYlrzbS1T0dUIXTGHnwstNUEAHGe+g9qoSqCesn9675UQEeyD4p1BnJy6rW3j9kzQTGNoJa46sttUlk9N2m3Es7aK5g8hqp87/QNp2/3eeW0zyB0aKcFoj4J2DOKCp5se4OWNcPF2XYKxYRUzmx15TBAw==",
    "profile_taker_encryption_key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqH3WvZyV55VoVC8ToaApn16tJ4QxAib4ujgbP2fsP7v4+4Y3QvIjIcrABjJC0V/l46g55iQgUwAz96gctqOsrm0fVyYmKRw9HmJMRi8qZwuNkmPX0aFTiUTAsExPVESBRqrb4cRB9yrrQmV45TPxT4P/3pgmeaQRHTKLq431zMQLV3j9SdLT3T3TdWasOwlQBVrQmdkey95NwTlxkDbt/whDshSTphXj+tsBQVMnXvSYEzMYqJUaueXPTfbluQ4SdydP7c0gbYw5Q+6Ngmkf9Os5AZ7X9K4ZmQGqqlXfX3CweS9+fbkB+rYSwYIDIVPIBKxbe5B0OwqbuveVxwnDswIDAQAB"
  }}
  const newTradeString = JSON.stringify(contractCallParams)
  const payload = toUtf8Bytes(newTradeString)
  const versionPrefix = arrayify(hexZeroPad(hexlify(2), 4))
  const versionedPayload = concatenate([ versionPrefix, payload ])
  console.log('versionedPayload', uint8ArrayToHex(versionedPayload))

  // const newTradeBytes = abiEncoder.encode([ "string" ], [ newTradeString ])

})

/**
 * Combine multiple Uint8Arrays into one.
 *
 * @param {Uint8Array[]} uint8arrays
 * @returns {Uint8Array}
 */
function concatenate(uint8arrays: Uint8Array[]): Uint8Array {
  const totalLength = uint8arrays.reduce(
    (total, uint8array) => total + uint8array.byteLength,
    0
  );

  const result = new Uint8Array(totalLength);

  let offset = 0;
  uint8arrays.forEach((uint8array) => {
    result.set(uint8array, offset);
    offset += uint8array.byteLength;
  });

  return result;
}

function uint8ArrayToHex(uint8array: Uint8Array): string {
  return '0x' + Array.from(uint8array)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

watch(selectedFiat, async () => {
  await updateFiatPrice()
  await fetchOffers()
})
watch(selectedDenom, async () => {
  await updateFiatPrice()
  await fetchOffers()
})
watch(selectedOfferItem, async () => {
  console.log('selectedOfferItem', selectedOfferItem.value)
})
watch(selectedType, async () => await fetchOffers())
</script>

<template>
  <section class="page">
    <p class="offers-section-title">Top offers from the community</p>
    <section class="offers-filter">
      <div class="buy-sell">
        <button class="buy" :class="{ focus: selectedType === OfferType.sell }" @click="selectedType = OfferType.sell">
          buy
        </button>
        <button class="sell" :class="{ focus: selectedType === OfferType.buy }" @click="selectedType = OfferType.buy">
          sell
        </button>
      </div>
      <div class="filter">
        <label for="crypto">Crypto</label>
        <CustomSelect v-model="selectedDenom" :options="denomsAvailable(client.chainClient)" />
      </div>
      <div class="filter">
        <label for="currency">Currency (FIAT)</label>
        <CustomSelect v-model="selectedFiat" :options="fiatsAvailable" />
      </div>
    </section>

    <section class="offers-list">
      <h3 v-if="selectedType === OfferType.sell">Buy from these sellers</h3>
      <h3 v-if="selectedType === OfferType.buy">Sell to these buyers</h3>
      <!-- Offers for -->
      <ListContentResult
        :result="offersResult"
        emptyStateMsg="There are no offers available yet"
        @loadMore="fetchMoreOffers()"
      >
        <ul>
          <li v-for="offer in page.offers" :key="offer.data.id" :class="offer.isExpanded ? 'card-active' : ''">
            <!-- Collapsed Offer -->
            <CollapsedOffer v-if="!offer.isExpanded" :offerResponse="offer.data" @select="selectOffer(offer)" />
            <!-- Expanded Offer Desktop -->
            <ExpandedOffer v-else :offerResponse="offer.data" @cancel="unselectOffer(offer)" />
          </li>
        </ul>
      </ListContentResult>
    </section>
  </section>
</template>

<style lang="scss" scoped>
@import '../../style/tokens.scss';

section {
  margin-top: 0;
}

/* ----------- BUY SELL ROW */
.separator {
  margin: 0 auto 80px;
  display: flex;
  height: 1px;
  background-color: $border;

  @media only screen and (max-width: $mobile) {
    margin: 0 auto 32px;
  }
}

.offers-filter {
  display: flex;
  margin-bottom: 56px;

  @media only screen and (max-width: $mobile) {
    display: block;
    margin-bottom: 32px;
  }
}

.filter {
  display: inline-flex;
  flex-direction: column;
  width: 100%;
  max-width: 216px;
  margin-left: 24px;

  @media only screen and (max-width: $mobile) {
    max-width: none;
    margin-left: 0;
    margin-bottom: 16px;
  }

  label {
    font-size: 12px;
    color: $gray600;
    margin-bottom: 8px;
  }
}

.offers-section-title {
  font-size: 24px;
  margin-bottom: 40px;
  color: $gray900;
  font-weight: 600;

  @media only screen and (max-width: $mobile) {
    font-size: 18px;
    margin-bottom: 32px;
    text-align: center;
  }
}

/* ----------- OFFER LIST */
.offers-list {
  margin-top: 40px;
  margin-bottom: 56px;

  @media only screen and (max-width: $mobile) {
    margin-top: 24px;
  }

  h3 {
    color: $base-text;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 32px;

    @media only screen and (max-width: $mobile) {
      margin: 16px 0 32px;
    }
  }

  li {
    list-style: none;
    margin-bottom: 24px;
  }

  .load-more {
    display: flex;
    justify-content: center;
    margin-top: 32px;

    button {
      padding: 0 48px;
    }
  }
}
</style>
