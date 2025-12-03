# BSC Mainnet Deployment Guide

## Prerequisites
```bash
cd /Users/samb/workspace/desamtralized/local-money/contracts/evm
```

Ensure your `.env` file contains:
```
DEPLOYER_PRIVATE_KEY=<your_private_key_here>
BSC_RPC=https://bsc-dataseed1.binance.org/
```

**Required Balance**: Minimum 0.05 BNB in deployer wallet

## 🎯 Current Deployment Configuration

### Zero-Fee Configuration (Active)
- **All fees set to 0%** for initial launch
- **Trade limits**: $1 minimum, $500 maximum
- **No transaction fees** on trades
- **Free arbitrator services** during launch phase

### Deployed Contracts (BSC Mainnet)
| Contract | Address |
|----------|---------|
| Hub | 0xf4FcdA8CAf5d63781516Dea3A076E6c43E2ed9BA |
| Profile | 0xeD30d77f043610bE0F57aA32Ab5bcCEb7B330cBf |
| PriceOracle | 0x3f8f71c3A10907A196F427A3C98e01045f6008de |
| Offer | 0x3c98809073f76dC6d8581981E64fA69d34fb0eAF |
| Trade | 0x9c9380A5054eA364Fc41f319dF397DF0E094Da4A |
| Escrow | 0x9ed1c2784B185A0614Ad1d51C2ffF61a7ef813cf |
| ArbitratorManager | 0xe9Cc43Ad09958FaF8f3CfE92c1514A0736ff0392 |

## 🔒 Security Audit Fixes Implemented

This deployment includes critical security fixes from the audit report:

### HIGH Severity (Fixed)
- **AUTH-006**: Escrow deposit authorization - prevents arbitrary token theft
- **AUTH-007**: VRF arbitrator selection - true randomness via Chainlink VRF
- **EXT-017**: CEI pattern in Trade.fundEscrow - prevents reentrancy
- **MATH-026**: PriceOracle storage initialization - proper initialization

### MEDIUM Severity (Fixed)
- **EXT-021/DOS-054**: Pull payment pattern - prevents ETH send attacks
- **EXT-018**: Comprehensive reentrancy protection - all functions protected
- **UPG-012**: UUPS upgrade with timelock - secure upgrade mechanism

## ✅ Pre-Deployment Checklist

### Security Requirements
- [ ] Slither analysis completed with no high/medium issues
- [ ] All contracts under 24KB size limit
- [ ] Constructor protection enabled on all upgradeable contracts
- [ ] Multi-sig wallet deployed and configured
- [ ] Emergency procedures documented
- [ ] Audit completed (for mainnet)
- [ ] Security tests pass

### Infrastructure Requirements
- [ ] RPC endpoints configured for target networks
- [ ] Private keys securely stored (hardware wallet recommended)
- [ ] Block explorer API keys configured
- [ ] Multi-sig team members confirmed
- [ ] Emergency contact list prepared
- [ ] Chainlink VRF subscription (if applicable)

### Environment Setup
- [ ] `.env` file configured with required variables
- [ ] Gas price strategy determined
- [ ] Treasury and fee collector addresses prepared
- [ ] Price oracle feeds identified

## 🔧 Environment Configuration

Create a `.env` file in the `contracts/evm/` directory:

```bash
# Network RPC URLs
MAINNET_RPC=https://mainnet.infura.io/v3/YOUR_KEY
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC=https://mainnet.optimism.io
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_KEY
MUMBAI_RPC=https://polygon-mumbai.infura.io/v3/YOUR_KEY

# Deployment Private Key (Use hardware wallet for mainnet!)
DEPLOYER_PRIVATE_KEY=0x...

# Multi-sig and Treasury Addresses
MAINNET_MULTISIG=0x...
MAINNET_TREASURY=0x...
ARBITRUM_MULTISIG=0x...
ARBITRUM_TREASURY=0x...
OPTIMISM_MULTISIG=0x...
OPTIMISM_TREASURY=0x...

# API Keys for Verification
ETHERSCAN_API_KEY=...
ARBISCAN_API_KEY=...
OPTIMISM_API_KEY=...
POLYGONSCAN_API_KEY=...

# Chainlink VRF (if applicable)
VRF_SUBSCRIPTION_ID=YOUR_SUBSCRIPTION_ID
```

## 🚀 Deployment Process

### Quick Deploy (Zero Fees Configuration)

For deploying with zero fees and $1-$500 trade limits:

```bash
# Deploy all contracts with zero fees
npx hardhat run scripts/complete-zero-fee-deployment.js --network bsc
```

This script will:
1. Deploy all 7 contracts with proper initialization
2. Set up circular dependencies correctly
3. Configure zero fees (0% for all fee types)
4. Set trade limits ($1 min, $500 max)
5. Register deployer as arbitrator

### Step 1: Pre-Deployment Validation

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile
# or
npx hardhat compile

# Run security analysis
slither . --exclude informational,optimization

# Check contract sizes
npx hardhat size-contracts

# Run all tests
npm test

# Run security-specific tests
npm run test:security

# Generate coverage report
npm run coverage
```

### Step 2: Deploy to Testnet First

```bash
# Deploy to Sepolia testnet
npm run deploy:testnet sepolia
# or
npx hardhat run scripts/deploy-production.js --network sepolia

# Deploy to Mumbai
npm run deploy:testnet mumbai

# Validate deployment
npx hardhat run scripts/validate-deployment.js -- deployments/sepolia-latest.json
```

The deployment script will:
- Deploy all contracts with security fixes
- Set up timelock controller (2-day delay)
- Configure access control roles
- Save deployment addresses to JSON file

### Step 3: Verify Contracts on Testnet

```bash
# Set deployment file
export DEPLOYMENT_FILE=deployment-sepolia-1234567890.json

# Run verification
npm run verify sepolia
```

### Step 4: Run Integration Tests

```bash
# Set deployment file
export DEPLOYMENT_FILE=deployment-sepolia-1234567890.json

# Run integration tests
npm run test:integration sepolia
```

### Step 5: Production Deployment

⚠️ **CRITICAL**: Only proceed after successful testnet deployment and validation.

```bash
# Deploy to Mainnet
npx hardhat run scripts/deploy-production.js --network mainnet

# Deploy to Arbitrum
npx hardhat run scripts/deploy-production.js --network arbitrum

# Deploy to Optimism  
npx hardhat run scripts/deploy-production.js --network optimism
```

### Step 6: Post-Deployment Validation

```bash
# Validate each deployment
npx hardhat run scripts/validate-deployment.js -- deployments/mainnet-latest.json
npx hardhat run scripts/validate-deployment.js -- deployments/arbitrum-latest.json
npx hardhat run scripts/validate-deployment.js -- deployments/optimism-latest.json
```

## 🔐 Security Configuration

### Multi-Sig Setup

1. **Deploy Multi-Sig Wallet** (if not already deployed)
   - Use Gnosis Safe or similar
   - Minimum 3/5 threshold recommended
   - Include team members from different geographic locations

2. **Transfer Ownership**
   - All contracts deployed with deployer as initial admin
   - Ownership automatically transferred to multi-sig during deployment
   - Verify transfer completed successfully

3. **Configure Emergency Roles**
   - Grant emergency role to trusted operators
   - Test emergency pause functionality
   - Document emergency procedures

### Access Control Verification

```bash
# Check Hub admin
npx hardhat console --network mainnet
> const hub = await ethers.getContractAt("Hub", "HUB_ADDRESS")
> await hub.getAdmin()

# Verify multi-sig ownership
> const admin = await hub.getAdmin()
> console.log("Admin is multi-sig:", admin === "MULTISIG_ADDRESS")

# Assign emergency roles
> const EMERGENCY_ROLE = await hub.EMERGENCY_ROLE();
> await hub.grantRole(EMERGENCY_ROLE, emergencyAdmin);
```

## ⚙️ Configuration Management

### Initial Configuration

The current deployment uses zero-fee configuration:

- **Fees**: All fees set to 0%
  - Burn Fee: 0%
  - Chain Fee: 0%
  - Warchest Fee: 0%
  - Arbitrator Fee: 0%
  - Conversion Fee: 0%

- **Trading Limits**:
  - Minimum Trade: $1
  - Maximum Trade: $500
  - Max Active Offers: 10
  - Max Active Trades: 5

- **Timers**:
  - Trade Expiration: 24 hours
  - Dispute Window: 7 days

To update fees later (requires timelock):
```javascript
// After 2-day timelock period
await hub.updateConfig({
  burnFeePct: 100,       // 1%
  chainFeePct: 150,      // 1.5%
  warchestFeePct: 250,   // 2.5%
  // ... other config
});
```

### Chainlink VRF Setup (if supported)

For networks with Chainlink VRF support:

1. Create VRF subscription at [vrf.chain.link](https://vrf.chain.link)
2. Fund subscription with LINK tokens
3. Add ArbitratorManager as consumer
4. Configure VRF in ArbitratorManager:

```javascript
await arbitratorManager.configureVRF(
    vrfCoordinator,    // Network-specific address
    subscriptionId,    // Your subscription ID
    keyHash,          // Network-specific key hash
    100000,           // Callback gas limit
    3                 // Confirmations
);
```

### Price Oracle Configuration

Set up price feeds:

```javascript
// Update fiat prices
await priceOracle.updateFiatPrices(
    ["USD", "EUR", "GBP"],
    [100000000, 108000000, 127000000] // 8 decimals
);

// Register token price routes
await priceOracle.registerPriceRoute(
    tokenAddress,
    [token, WETH],           // Path
    [3000],                  // Fee tiers
    chainlinkFeedAddress,    // Optional Chainlink feed
    600                      // TWAP period
);
```

### Register Arbitrators

```javascript
// Arbitrator registration
await arbitratorManager.connect(arbitrator).registerArbitrator(
    ["USD", "EUR"],          // Supported currencies
    "encryption-public-key"   // Public key for secure communication
);
```

## 📊 Contract Addresses (BSC Mainnet - Live)

| Contract | Address | Purpose |
|----------|---------|---------|
| Hub | [0xf4FcdA8CAf5d63781516Dea3A076E6c43E2ed9BA](https://bscscan.com/address/0xf4FcdA8CAf5d63781516Dea3A076E6c43E2ed9BA) | Central configuration & timelock |
| Trade | [0x9c9380A5054eA364Fc41f319dF397DF0E094Da4A](https://bscscan.com/address/0x9c9380A5054eA364Fc41f319dF397DF0E094Da4A) | P2P trading with CEI pattern |
| Escrow | [0x9ed1c2784B185A0614Ad1d51C2ffF61a7ef813cf](https://bscscan.com/address/0x9ed1c2784B185A0614Ad1d51C2ffF61a7ef813cf) | Pull payment pattern for funds |
| ArbitratorManager | [0xe9Cc43Ad09958FaF8f3CfE92c1514A0736ff0392](https://bscscan.com/address/0xe9Cc43Ad09958FaF8f3CfE92c1514A0736ff0392) | VRF-based arbitrator selection |
| Profile | [0xeD30d77f043610bE0F57aA32Ab5bcCEb7B330cBf](https://bscscan.com/address/0xeD30d77f043610bE0F57aA32Ab5bcCEb7B330cBf) | User profiles & reputation |
| Offer | [0x3c98809073f76dC6d8581981E64fA69d34fb0eAF](https://bscscan.com/address/0x3c98809073f76dC6d8581981E64fA69d34fb0eAF) | Trade offer management |
| PriceOracle | [0x3f8f71c3A10907A196F427A3C98e01045f6008de](https://bscscan.com/address/0x3f8f71c3A10907A196F427A3C98e01045f6008de) | Price feeds & validation |

## 📊 Monitoring & Maintenance

### Health Checks

Create monitoring for:
- [ ] Contract upgrade events
- [ ] Emergency pause events  
- [ ] Fee distribution events
- [ ] Large trade events
- [ ] Failed transaction patterns
- [ ] VRF subscription balance

### Regular Maintenance

- [ ] Monitor gas usage patterns
- [ ] Review fee collection rates
- [ ] Update price feeds as needed
- [ ] Security patch assessments
- [ ] Performance optimization reviews
- [ ] Keep VRF subscription funded with LINK

## 🚨 Emergency Procedures

### Emergency Pause

If critical vulnerability discovered:

1. **Immediate Response**
   ```bash
   # Connect to multi-sig
   # Execute emergency pause
   hub.emergencyPause("Critical vulnerability detected")
   ```

2. **Communication**
   - Notify all stakeholders immediately
   - Publish incident report
   - Coordinate with security team

3. **Resolution**
   - Deploy fixes to testnet first
   - Complete security review
   - Coordinate upgrade timing
   - Resume operations

### Resume Operations

```javascript
await hub.resume(); // Admin only, after issue resolved
```

### Specific Operation Pause

```javascript
await hub.pauseOperation(OP_CREATE_TRADE);
```

### Upgrade Process

For contract upgrades:

1. **Preparation**
   - Deploy new implementation to testnet
   - Complete security audit
   - Prepare upgrade proposal

2. **Execution**
   - Submit to multi-sig
   - Wait for timelock delay (2 days)
   - Execute upgrade
   - Verify upgrade success

3. **Validation**
   - Run validation script
   - Monitor for issues
   - Communication to users

## 🧪 Testing Checklist

- [ ] All unit tests pass
- [ ] Security tests pass
- [ ] Integration tests pass on testnet
- [ ] Gas costs within acceptable range
- [ ] Upgrade mechanism tested
- [ ] Emergency pause tested
- [ ] VRF functionality verified (if applicable)
- [ ] Pull payment withdrawals work
- [ ] Access controls enforced

## 📋 Deployment Verification Checklist

### Contract Deployment
- [ ] All contracts deployed successfully
- [ ] Contract sizes under 24KB limit
- [ ] All contracts verified on block explorer
- [ ] Proxy deployment working correctly

### Security Configuration
- [ ] Ownership transferred to multi-sig
- [ ] Emergency roles configured
- [ ] Access controls verified
- [ ] Upgrade authorization working
- [ ] Timelock delays active

### Functional Testing
- [ ] Basic functionality tested
- [ ] Fee calculation working
- [ ] Emergency pause working
- [ ] Price oracle responding
- [ ] VRF randomness working (if applicable)

### Documentation
- [ ] Deployment addresses recorded
- [ ] Configuration documented
- [ ] Emergency procedures ready
- [ ] User documentation published

## 🔐 Security Considerations

1. **Timelock Delays**: All upgrades subject to 2-day timelock
2. **Access Control**: Role-based permissions for all admin functions
3. **Pull Payments**: ETH withdrawals use pull pattern to prevent attacks
4. **Reentrancy Guards**: All external functions protected
5. **VRF Randomness**: True randomness for arbitrator selection
6. **CEI Pattern**: State changes before external calls

## 📚 Additional Resources

- [Audit Report](./PRPs/security-audit-fixes.md)
- [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades)
- [Chainlink VRF Docs](https://docs.chain.link/vrf/v2/introduction)
- [Gnosis Safe Documentation](https://docs.safe.global)

## 🔗 Important Links

- **Multi-Sig Wallet**: [Link to Gnosis Safe]
- **Monitoring Dashboard**: [Link to monitoring]
- **Incident Response**: [Link to procedures]
- **Security Audit**: [Link to audit report]

## 📞 Emergency Contacts

- **Protocol Team Lead**: [Contact info]
- **Security Team**: [Contact info]
- **Multi-Sig Signers**: [Contact list]
- **Emergency Response**: [24/7 contact]

## 🤝 Support

For deployment support or security questions:
- GitHub Issues: [LocalMoney/issues](https://github.com/LocalMoney/issues)
- Security: security@localmoney.com (PGP key available)

---

⚠️ **REMEMBER**: This is a financial protocol handling real user funds. Double-check everything and never rush production deployments.

**Last Updated**: December 2024
**Version**: 2.0.0 (Consolidated Post-Audit)