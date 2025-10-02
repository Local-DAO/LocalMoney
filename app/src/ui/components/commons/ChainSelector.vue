<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChainClient } from '~/network/Chain'
import { useClientStore } from '~/stores/client'
import { ChainType, WalletService } from '~/services/wallet'

const client = useClientStore()
const showDropdown = ref(false)

interface ChainOption {
  id: ChainClient
  name: string
  type: ChainType
  icon: string
  isTestnet: boolean
}

const chainOptions: ChainOption[] = [
  // Cosmos chains
  { id: ChainClient.cosmoshub, name: 'Cosmos Hub', type: ChainType.COSMOS, icon: '/tokens/cosmos.png', isTestnet: false },
  // EVM chains
  { id: ChainClient.bscMainnet, name: 'BNB Smart Chain', type: ChainType.EVM, icon: '/tokens/bnb.png', isTestnet: false },
]

const selectedChain = computed(() => {
  return chainOptions.find(chain => chain.id === client.chainClient) || chainOptions[0]
})

const availableWallets = computed(() => {
  return WalletService.detectAvailableWallets()
})

const walletsForChain = computed(() => {
  const chainType = selectedChain.value.type
  return availableWallets.value.filter(wallet => 
    WalletService.isWalletCompatibleWithChain(wallet, chainType)
  )
})

async function selectChain(chain: ChainOption) {
  showDropdown.value = false
  
  // Disconnect current wallet if chain type is different
  const currentChainType = client.client.getChainType()
  if (currentChainType !== chain.type && client.userWallet.isConnected) {
    await client.disconnectWallet()
  }
  
  // Switch to the new chain
  await client.setClient(chain.id)
}

function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

// Close dropdown when clicking outside
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.chain-selector')) {
    showDropdown.value = false
  }
}
</script>

<template>
  <div class="chain-selector">
    <button class="chain-button" @click="toggleDropdown">
      <img class="chain-icon" :src="selectedChain.icon" :alt="selectedChain.name" />
      <svg 
        class="dropdown-arrow"
        :class="{ 'rotate': showDropdown }"
        xmlns="http://www.w3.org/2000/svg" 
        width="14" 
        height="8" 
        viewBox="0 0 14 8"
      >
        <path 
          d="M1 1L7 7L13 1"
          fill="none" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <div v-if="showDropdown" class="dropdown">
      <div class="dropdown-header">Select Network</div>
      
      <div class="chain-group">
        <div class="group-label">Mainnet</div>
        <button
          v-for="chain in chainOptions.filter(c => !c.isTestnet)"
          :key="chain.id"
          class="chain-option"
          :class="{ 'selected': chain.id === selectedChain.id }"
          @click="selectChain(chain)"
        >
          <img class="chain-icon" :src="chain.icon" :alt="chain.name" />
          <span class="chain-name">{{ chain.name }}</span>
          <span class="chain-type">{{ chain.type.toUpperCase() }}</span>
          <svg v-if="chain.id === selectedChain.id" class="check-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 4.5L6 12L2.5 8.5" stroke="#4CAF50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <div v-if="walletsForChain.length > 0" class="wallet-info">
        <div class="info-label">Compatible Wallets:</div>
        <div class="wallet-list">
          <span v-for="wallet in walletsForChain" :key="wallet" class="wallet-chip">
            {{ WalletService.getWalletIcon(wallet) }} {{ WalletService.getWalletDisplayName(wallet) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import '../../style/tokens.scss';

.chain-selector {
  position: relative;
}

.chain-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px 8px 8px;
  background: $surface;
  border: 1px solid #33363c;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  height: 40px;
  min-width: 64px;

  @media only screen and (max-width: $mobile) {
    height: 48px;
  }

  &:hover {
    background: $gray300;
  }

  .chain-icon {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }

  .dropdown-arrow {
    transition: transform 0.15s cubic-bezier(1, -0.115, 0.975, 0.855);
    transition-timing-function: cubic-bezier(1, 0.005, 0.24, 1);
    color: $gray600;
    
    &.rotate {
      transform: rotate(180deg);
    }
  }
}

.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 280px;
  background: $surface;
  border: 1px solid #33363c;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  overflow: hidden;

  .dropdown-header {
    padding: 12px 16px;
    font-weight: 600;
    border-bottom: 1px solid $border;
    color: $base-text;
    font-size: 14px;
  }

  .chain-group {
    // No border needed as we only have one group now

    .group-label {
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 500;
      color: $gray600;
      text-transform: uppercase;
      background: transparent;
    }
  }

  .chain-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    margin: 4px 0;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
    text-align: left;

    &:hover {
      background: $gray300;
    }

    &.selected {
      background: $gray300;
    }

    .chain-icon {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }

    .chain-name {
      flex: 1;
      color: $base-text;
      font-weight: 600;
      font-size: 14px;
      line-height: 1;
    }

    .chain-type {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: $background;
      color: $gray700;
      font-weight: 600;
    }

    .check-icon {
      margin-left: 8px;
    }
  }

  .wallet-info {
    padding: 12px 16px;
    background: $background;
    border-top: 1px solid $border;

    .info-label {
      font-size: 12px;
      color: $gray600;
      margin-bottom: 8px;
    }

    .wallet-list {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

      .wallet-chip {
        padding: 4px 8px;
        background: $surface;
        border: 1px solid $border;
        border-radius: 6px;
        font-size: 12px;
        color: $base-text;
      }
    }
  }
}
</style>