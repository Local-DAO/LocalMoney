<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { Page, trackPage } from '~/analytics/analytics'
import { FiatCurrency } from '~/types/components.interface'

const selectedFiat = useLocalStorage<FiatCurrency>('selected_offer_fiat', FiatCurrency.COP)

onMounted(() => {
  trackPage(Page.home)
  selectedFiat.value = FiatCurrency.COP
})
</script>

<template>
  <main>
    <HomeHero />
    <ListOffers />
  </main>
</template>

<style lang="scss">
@import '../style/pages.scss';
</style>
