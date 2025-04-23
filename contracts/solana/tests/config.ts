import { PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import * as path from 'path';
import * as fs from 'fs';

// Try to load environment variables from different locations
function loadEnvVariables() {
  // Try current directory
  dotenv.config();
  
  // Try parent directory
  if (!process.env.HUB_PROGRAM_ID) {
    const parentEnvPath = path.resolve(process.cwd(), '../.env');
    if (fs.existsSync(parentEnvPath)) {
      dotenv.config({ path: parentEnvPath });
    }
  }
  
  // Try tests directory
  if (!process.env.HUB_PROGRAM_ID) {
    const testsEnvPath = path.resolve(process.cwd(), 'tests/.env');
    if (fs.existsSync(testsEnvPath)) {
      dotenv.config({ path: testsEnvPath });
    }
  }
  
  // Try integration directory
  if (!process.env.HUB_PROGRAM_ID) {
    const integrationEnvPath = path.resolve(process.cwd(), 'tests/integration/.env');
    if (fs.existsSync(integrationEnvPath)) {
      dotenv.config({ path: integrationEnvPath });
    }
  }
}

// Load environment variables
// loadEnvVariables(); // Disable env loading for tests to ensure hardcoded IDs are used

// Helper to get environment variable or fallback to default programId
// function getProgramId(key: string, defaultValue: string): string {
//   return process.env[key] || defaultValue;
// }

// Program IDs from Anchor.toml (Now used as direct source)
// const DEFAULT_IDS = {
//   HUB_PROGRAM_ID: "3dF7ebo6DErpveMLxGAg6KTkTanGYLHmVXvqTWkqhpmL",
//   OFFER_PROGRAM_ID: "8V7KPa396tMUbU1HpuGGWAWMddfsuQ5K5vLMnxdAurFv",
//   PRICE_PROGRAM_ID: "HpUVnehKAfNRzC12m9EYwhwjMwbWKTbcaCwPpwVGoNrC",
//   PROFILE_PROGRAM_ID: "HNKH412Fsfe8vdBudCnsbmB9PwYxcxYfktfmyTWgiKbd",
//   TRADE_PROGRAM_ID: "c4zS4D2VUbXrp48rUVWTSuFbJf9iSdd4Qn2aJSyBpXN"
// };

// Program IDs configuration - Directly using latest deployed IDs
export const PROGRAM_IDS = {
  hub: new PublicKey("3dF7ebo6DErpveMLxGAg6KTkTanGYLHmVXvqTWkqhpmL"),
  offer: new PublicKey("8V7KPa396tMUbU1HpuGGWAWMddfsuQ5K5vLMnxdAurFv"),
  trade: new PublicKey("c4zS4D2VUbXrp48rUVWTSuFbJf9iSdd4Qn2aJSyBpXN"),
  price: new PublicKey("HpUVnehKAfNRzC12m9EYwhwjMwbWKTbcaCwPpwVGoNrC"),
  profile: new PublicKey("HNKH412Fsfe8vdBudCnsbmB9PwYxcxYfktfmyTWgiKbd"),
} as const;

// Additional configuration settings can be added here
export const MOCK_USDC_MINT_DECIMALS = 6; 