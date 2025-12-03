<script setup lang="ts">
// https://github.com/vueuse/head
// you can use this to manipulate the document head in any components,
// they will be rendered correctly in the html results with vite-ssg
import { ChainClient } from '~/network/Chain'
import { useClientStore } from '~/stores/client'
import './ui/style/reset.scss'
import 'vue-toastification/dist/index.css'

const client = useClientStore()
// Default chain based on environment variable, falling back to Solana Devnet
const getDefaultChain = (): ChainClient => {
  const envChain = import.meta.env.VITE_DEFAULT_CHAIN
  if (envChain && Object.values(ChainClient).includes(envChain)) {
    return envChain as ChainClient
  }
  // Default to Solana Devnet for dev mode, BSC Mainnet for production
  return import.meta.env.DEV ? ChainClient.solanaDevnet : ChainClient.bscMainnet
}
const defaultChain = getDefaultChain()
client.setClient(defaultChain) // required to properly init chain
const loading = computed(() => client.loadingState)

let title: string
switch (client.chainClient) {
  case ChainClient.kujiraMainnet:
    title = 'Local Money'
    break
  case ChainClient.terra:
    title = 'LunaPay - Powered by Local Money'
    break
  case ChainClient.neutron:
    title = 'Local Money - powered by Neutron'
    break
  case ChainClient.bscMainnet:
    title = 'Local Money - BNB Chain'
  default:
    title = 'Local Money'
    break
}

useHead({
  title,
  meta: [
    {
      name: 'description',
      content: 'Local is a decentralized P2P marketplace for the multi-chain world.',
    },
  ],
})
</script>

<template>
  <Header />
  <RouterView />
  <!-- Loading Modal -->
  <ModalLoading :loading="loading" />
</template>

<style lang="scss">
@import './ui/style/tokens.scss';
@import './ui/style/pages.scss';

/* Main Style */
body {
  margin: 0 auto;
  font-family: 'Poppins', sans-serif;
  color: $base-text;
  background-color: $background;
  min-width: 1000px;

  @media only screen and (max-width: 550px) {
    min-width: 0px;
  }
}

button {
  height: 40px;
  border-radius: 8px;
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  cursor: pointer;
}

::selection {
  color: $base-text;
  background-color: $primary;
}
</style>
