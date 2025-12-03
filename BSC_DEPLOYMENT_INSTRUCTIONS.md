# BSC (BNB Chain) EVM Contract Deployment Instructions

## Overview
Deploy and configure the Local Money EVM contracts on BSC (BNB Chain) mainnet.

## Prerequisites
- Access to deployer wallet with at least 0.05 BNB for gas fees (deployment costs ~0.003 BNB)
- Private key for deployer account stored as `DEPLOYER_PRIVATE_KEY` in `/contracts/evm/.env`
- All contracts compiled and ready in `/contracts/evm/`
- Ensure consistent private key across all .env files for proper admin access

## Automated Deployment Scripts

The following scripts have been created to automate the BSC deployment process:

### Main Scripts
1. **deploy-all-bsc-mainnet.js** - Complete deployment of all contracts
2. **initialize-bsc-mainnet.js** - Initialize contracts after deployment (prices, arbitrator, etc.)
3. **update-env-variables.js** - Automatically update all .env files with deployed addresses
4. **verify-bsc-deployment.js** - Comprehensive verification of deployment status
5. **test-bsc-integration.js** - Integration test suite for the deployed system
6. **fix-hub-config.js** - Fix Hub configuration if addresses are incorrect after deployment

### Usage
```bash
# Deploy all contracts
npx hardhat run scripts/deploy-all-bsc-mainnet.js --network bsc

# Initialize the system (prices, arbitrator registration)
npx hardhat run scripts/initialize-bsc-mainnet.js --network bsc

# Update environment variables
node scripts/update-env-variables.js

# Verify deployment
npx hardhat run scripts/verify-bsc-deployment.js --network bsc

# Run integration tests
npx hardhat run scripts/test-bsc-integration.js --network bsc

# If Hub configuration is wrong after deployment, fix it:
npx hardhat run scripts/fix-hub-config.js --network bsc
```

### Recommended Deployment Order
1. Run `deploy-all-bsc-mainnet.js` to deploy all contracts
2. Run `update-env-variables.js` to update all .env files
3. Run `initialize-bsc-mainnet.js` to initialize prices and register arbitrator
4. Run `verify-bsc-deployment.js` to check everything is correct
5. If Hub config is wrong, run `fix-hub-config.js`
6. Update `/app/src/network/evm/config/bsc.ts` with new addresses
7. Rebuild frontend application

## Manual Deployment Steps (Alternative)

### 1. Deploy Contracts
Deploy the following contracts to BSC mainnet in this order:
- **Hub**: Central contract managing the entire ecosystem
- **Profile**: Manages user profiles and reputation
- **PriceOracle**: Manages fiat currency exchange rates (requires admin address and PancakeSwap router: 0x10ED43C718714eb63d5aA57B78B54704E256024E)
- **Offer**: Handles individual trade offers (with description update support)
- **Trade**: Manages active trades between users
- **Escrow**: Handles secure fund escrow for trades (requires Hub, PriceOracle, and Trade addresses)
- **ArbitratorManager**: Manages arbitrators and dispute resolution

### 2. Initialize Contracts
After deployment:
- Initialize the Hub contract with proper configuration (zero fees)
- Set up the PriceOracle with initial price feeds (using the fiat-prices-aggregator rust app)
- Configure role-based access control (grant PRICE_UPDATER_ROLE to the oracle updater address, same address as of the deployer)
- Update Trade contract with Escrow and ArbitratorManager addresses
- Update Hub configuration with all deployed contract addresses

### 3. Update Environment Variables
Update `.env` files in the following locations with the deployed contract addresses:

#### `/app/.env`
- `VITE_BSC_HUB_ADDRESS=<deployed_hub_address>`
- `VITE_BSC_PROFILE_ADDRESS=<deployed_profile_address>`
- `VITE_BSC_PRICE_ORACLE_ADDRESS=<deployed_price_oracle_address>`
- `VITE_BSC_OFFER_ADDRESS=<deployed_offer_address>`
- `VITE_BSC_TRADE_ADDRESS=<deployed_trade_address>`
- `VITE_BSC_ESCROW_ADDRESS=<deployed_escrow_address>`
- `VITE_BSC_ARBITRATOR_MANAGER_ADDRESS=<deployed_arbitrator_manager_address>`

#### `/contracts/evm/.env`
- `BSC_HUB_ADDRESS=<deployed_hub_address>`
- `BSC_PROFILE_ADDRESS=<deployed_profile_address>`
- `BSC_PRICE_ORACLE_ADDRESS=<deployed_price_oracle_address>`
- `BSC_OFFER_ADDRESS=<deployed_offer_address>`
- `BSC_TRADE_ADDRESS=<deployed_trade_address>`
- `BSC_ESCROW_ADDRESS=<deployed_escrow_address>`
- `BSC_ARBITRATOR_MANAGER_ADDRESS=<deployed_arbitrator_manager_address>`
- `BSC_DEPLOYER_PRIVATE_KEY=<deployer_private_key>`

#### `/fiat-prices-aggregator/.env`
- `BSC_PRICE_ORACLE_ADDRESS=<deployed_price_oracle_address>`
- `BSC_HUB_ADDRESS=<deployed_hub_address>`
- `BSC_ORACLE_UPDATER_PRIVATE_KEY=<oracle_updater_private_key>`
- `BSC_RPC_URL=https://bsc-dataseed.binance.org/`
- `EVM_PRICE_ORACLE_ADDRESS=<deployed_price_oracle_address>` (same as BSC_PRICE_ORACLE_ADDRESS)
- `EVM_PRIVATE_KEY=<oracle_updater_private_key>` (same as BSC_ORACLE_UPDATER_PRIVATE_KEY)

### 4. Initialize Price Oracle
Run the fiat-prices-aggregator to:
- Set initial prices for all configured fiat currencies on the PriceOracle contract
- Ensure the price updater has the necessary role permissions

### 5. Register Arbitrator
Register the deployer address as the arbitrator for all fiat currencies:
- Use the Hub contract to register as arbitrator
- Configure for all fiat currencies defined in `fiat-prices-aggregator`

## Verification Steps
After deployment:
1. Verify all contract addresses are correctly set in environment files
2. Confirm PriceOracle is receiving and storing price updates
3. Test that the deployer is registered as arbitrator for all currencies
4. Verify Hub contract can interact with PriceOracle and Offer contracts
5. Run an integration test suite to ensure full system functionality

## Quick Start
To verify the current deployment status:
```bash
# Check deployment verification
npx hardhat run scripts/verify-bsc-deployment.js --network bsc

# Run integration tests
npx hardhat run scripts/test-bsc-integration.js --network bsc
```

## Important Notes
- Keep private keys secure and never commit them to version control
- Ensure sufficient BNB balance for gas fees during deployment and operations (minimum 0.05 BNB recommended)
- Document all deployed contract addresses for future reference
- Consider using a hardware wallet or secure key management system for mainnet deployments
- Always update the frontend configuration file `/app/src/network/evm/config/bsc.ts` after deployment

## Common Issues and Solutions

### 1. PriceOracle Initialization Error
**Issue**: PriceOracle contract expects admin address and swap router during initialization
**Solution**: Ensure deployment script passes `[deployer.address, "0x10ED43C718714eb63d5aA57B78B54704E256024E"]` to PriceOracle initialization

### 2. Escrow Contract Initialization
**Issue**: Escrow expects 3 parameters: Hub, PriceOracle, and Trade addresses
**Solution**: Deploy in correct order and pass all three addresses during Escrow initialization

### 3. Hub Configuration Not Updating
**Issue**: Hub getConfig() returns wrong contract addresses after deployment
**Solution**: After deployment, call `hub.updateConfig()` with all correct contract addresses. May need to be done separately from deployment script.

### 4. Frontend Shows Old Contract Addresses
**Issue**: App still connects to old Hub after redeployment
**Solution**: Update `/app/src/network/evm/config/bsc.ts` with new contract addresses and rebuild frontend

### 5. Admin Access Issues
**Issue**: Cannot initialize contracts due to missing admin rights
**Solution**: Ensure the deployer account has admin rights. For redeployments, use the same private key or transfer admin rights from old account

### 6. Environment Variable Consistency
**Issue**: Different private keys in different .env files
**Solution**: Ensure `DEPLOYER_PRIVATE_KEY`, `EVM_PRIVATE_KEY`, and `BSC_ORACLE_UPDATER_PRIVATE_KEY` all use the same private key

## Current Contract Addresses (Redeployed 2025-08-31)
- **Hub**: `0x45Ea91961F00fD0452273Aa4DB128e07B2FC9E9c`
- **Profile**: `0x4D5Ff987926159C27CF40d2B14580C1A164E81bf`
- **PriceOracle**: `0x89876349f314255bD06bC5C354662d0dA6D1E58d`
- **Offer**: `0x8057C2fc06B5C1ceB0A7D723D75d672eE52AB914`
- **Trade**: `0xFEfC8C3A108D44C9cCc2E1559796dfAa408ed361`
- **Escrow**: `0xCE0Db55B56df81adEbdBFB548C5f59379435a1b0`
- **ArbitratorManager**: `0x9bD53D5F0C91cF20a820080bB681c13F45F3F571`
- **Deployer/Arbitrator Address**: `0x6d16709103235a95Dd314DaFaD37E6594298BD52`
- **Price Updater Address**: `0x6d16709103235a95Dd314DaFaD37E6594298BD52`

## Previous Contract Addresses (Deployed 2025-08-30 - Deprecated)
- Hub: `0x6393FC78A62aFdBbE8589E025De3Ae34237F74A3`
- Profile: `0x2216863c6A126910Fe05530D22e1b07aFA996EEc`
- PriceOracle: `0xde582A3DA43d05D16165476A0AbB2CF24dFD63de`
- Offer: `0x3b40EF590C73cd8bA99Bf94e918Bc5F18b042808`
- Trade: `0xfEeA43a29e096209E71dCbE5ae2DE2910DC823e2`
- Escrow: `0x406394A750ac1e8A636AE7F48092C9B1ae4E30Fa`
- ArbitratorManager: `0x2D40d7dD4d479ED17357cbE89F2AAb4c9C87D201`
- Deployer/Arbitrator Address: `0x5f6acb320B94b2A954dC0C28e037D5A761C76571`
