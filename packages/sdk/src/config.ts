/**
 * Network configuration for the LocalMoney SDK
 */

import { Connection, Commitment, PublicKey } from "@solana/web3.js";
import {
  NetworkName,
  ProgramIds,
  getProgramIds,
  RPC_ENDPOINTS,
  LOCALNET_PROGRAM_IDS,
  DEVNET_PROGRAM_IDS,
  MAINNET_PROGRAM_IDS,
} from "./constants";

/**
 * Network configuration options
 */
export interface NetworkConfig {
  /** Network name */
  name: NetworkName;
  /** RPC endpoint URL */
  endpoint: string;
  /** Program IDs for this network */
  programIds: ProgramIds;
  /** WebSocket endpoint (optional) */
  wsEndpoint?: string;
  /** Commitment level (default: confirmed) */
  commitment?: Commitment;
}

/**
 * Pre-configured localnet configuration
 */
export const LOCALNET_CONFIG: NetworkConfig = {
  name: "localnet",
  endpoint: RPC_ENDPOINTS.localnet,
  programIds: LOCALNET_PROGRAM_IDS,
  commitment: "confirmed",
};

/**
 * Pre-configured devnet configuration
 */
export const DEVNET_CONFIG: NetworkConfig = {
  name: "devnet",
  endpoint: RPC_ENDPOINTS.devnet,
  programIds: DEVNET_PROGRAM_IDS,
  commitment: "confirmed",
};

/**
 * Pre-configured mainnet configuration
 */
export const MAINNET_CONFIG: NetworkConfig = {
  name: "mainnet-beta",
  endpoint: RPC_ENDPOINTS["mainnet-beta"],
  programIds: MAINNET_PROGRAM_IDS,
  commitment: "confirmed",
};

/**
 * Get network configuration by name
 *
 * @param network - Network name
 * @returns Network configuration
 */
export function getNetworkConfig(network: NetworkName): NetworkConfig {
  switch (network) {
    case "localnet":
      return LOCALNET_CONFIG;
    case "devnet":
      return DEVNET_CONFIG;
    case "mainnet-beta":
      return MAINNET_CONFIG;
    default:
      throw new Error(`Unknown network: ${network as string}`);
  }
}

/**
 * Create a custom network configuration
 *
 * @param options - Configuration options
 * @returns Network configuration
 */
export function createNetworkConfig(options: {
  name?: NetworkName;
  endpoint: string;
  programIds?: Partial<ProgramIds>;
  wsEndpoint?: string;
  commitment?: Commitment;
}): NetworkConfig {
  const baseProgramIds = options.name ? getProgramIds(options.name) : LOCALNET_PROGRAM_IDS;

  return {
    name: options.name || "localnet",
    endpoint: options.endpoint,
    programIds: {
      ...baseProgramIds,
      ...options.programIds,
    } as ProgramIds,
    wsEndpoint: options.wsEndpoint,
    commitment: options.commitment || "confirmed",
  };
}

/**
 * Create a Solana connection from network config
 *
 * @param config - Network configuration
 * @returns Solana connection
 */
export function createConnection(config: NetworkConfig): Connection {
  return new Connection(config.endpoint, {
    commitment: config.commitment || "confirmed",
    wsEndpoint: config.wsEndpoint,
  });
}

/**
 * Validate a network configuration
 *
 * @param config - Configuration to validate
 * @returns true if valid
 * @throws Error if invalid
 */
export function validateNetworkConfig(config: NetworkConfig): boolean {
  if (!config.endpoint) {
    throw new Error("Network config must have an endpoint");
  }

  if (!config.programIds) {
    throw new Error("Network config must have programIds");
  }

  const requiredPrograms = [
    "HUB",
    "PROFILE",
    "OFFER",
    "TRADE",
    "ESCROW",
    "ARBITRATOR",
    "PRICE_ORACLE",
  ] as const;

  for (const program of requiredPrograms) {
    if (!config.programIds[program]) {
      throw new Error(`Network config missing program ID: ${program}`);
    }
    try {
      // Validate it's a valid PublicKey
      new PublicKey(config.programIds[program].toBase58());
    } catch {
      throw new Error(`Invalid program ID for ${program}`);
    }
  }

  return true;
}

/**
 * Program ID helper for a specific network config
 */
export class ProgramIdHelper {
  constructor(private readonly programIds: ProgramIds) {}

  get hub(): PublicKey {
    return this.programIds.HUB;
  }

  get profile(): PublicKey {
    return this.programIds.PROFILE;
  }

  get offer(): PublicKey {
    return this.programIds.OFFER;
  }

  get trade(): PublicKey {
    return this.programIds.TRADE;
  }

  get escrow(): PublicKey {
    return this.programIds.ESCROW;
  }

  get arbitrator(): PublicKey {
    return this.programIds.ARBITRATOR;
  }

  get priceOracle(): PublicKey {
    return this.programIds.PRICE_ORACLE;
  }

  /**
   * Get all program IDs as an object
   */
  getAll(): ProgramIds {
    return this.programIds;
  }
}
