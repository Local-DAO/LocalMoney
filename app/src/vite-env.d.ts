/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BSC_HUB_ADDRESS: string
  // Escrow and ArbitratorManager addresses are not available in Hub config
  // So we need to keep them in env for now
  readonly VITE_BSC_ESCROW_ADDRESS: string
  readonly VITE_BSC_ARBITRATOR_MANAGER_ADDRESS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}