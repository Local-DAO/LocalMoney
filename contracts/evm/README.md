# LocalMoney Protocol - EVM Implementation

This directory contains the EVM-compatible smart contracts for the LocalMoney protocol, translated from the original CosmWasm implementation.

## Overview

LocalMoney is a decentralized P2P trading platform facilitating fiat-to-cryptocurrency exchanges through an escrow mechanism with integrated dispute resolution. This EVM implementation provides the same functionality using Solidity smart contracts.

## Architecture

The protocol consists of the following core contracts:

### Phase 1 (Implemented)
- **Hub**: Central orchestrator managing configuration and administration
- **Profile**: User profile and reputation management

### Future Phases
- **Offer**: Buy/sell offer lifecycle management (Phase 2)
- **Trade**: Core trading engine with escrow (Phase 2) 
- **PriceOracle**: Price feeds and oracle integration (Phase 3)

## Contracts

### Hub Contract
The Hub contract serves as the central configuration and administration point for the entire protocol.

**Key Features:**
- Upgradeable using UUPS proxy pattern
- Role-based access control (Admin, Emergency roles)
- Circuit breaker functionality for emergency pauses
- Fee management and validation
- Trading limits configuration

**Configuration Parameters:**
- Contract addresses for all protocol contracts
- Fee percentages (burn, chain, warchest, conversion)
- Trading limits (min/max amounts, active limits)
- Timers (expiration, dispute windows)
- Circuit breaker flags

### Profile Contract
The Profile contract manages user data, trading statistics, and reputation.

**Key Features:**
- User contact information (encrypted)
- Trading statistics tracking
- Active offers/trades counters
- Reputation scoring
- Authorization checks for limit enforcement

## Installation

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm run test

# Generate coverage report
npm run coverage

# Gas report
npm run gas-report
```

## Deployment

### Local Development
```bash
# Start local hardhat node
npx hardhat node

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost
```

### Testnet Deployment
```bash
# Deploy to testnet (configure network in hardhat.config.js)
npx hardhat run scripts/deploy.js --network <testnet-name>
```

### Mainnet Deployment
```bash
# Deploy to mainnet (ensure proper configuration)
npx hardhat run scripts/deploy.js --network mainnet
```

## Testing

The test suite provides comprehensive coverage for all implemented contracts:

```bash
# Run all tests
npm run test

# Run specific test file
npx hardhat test test/Hub.test.js
npx hardhat test test/Profile.test.js

# Run with gas reporting
npm run gas-report

# Generate coverage report
npm run coverage
```

### Test Coverage
- Hub Contract: Initialization, configuration, admin management, circuit breaker, access control
- Profile Contract: Contact management, trading statistics, authorization, reputation scoring

## Gas Optimization

The contracts are optimized for gas efficiency:

- **Storage packing**: Efficient struct layouts to minimize storage slots
- **Access control**: Role-based permissions to reduce redundant checks  
- **Circuit breakers**: Granular pause functionality
- **Upgradeable patterns**: UUPS proxy for future improvements

### Gas Costs (Approximate)
- Hub deployment: < 200k gas
- Profile deployment: < 200k gas
- Configuration updates: < 100k gas
- Profile updates: < 80k gas

## Security

### Access Control
- **Admin Role**: Full configuration and upgrade authority
- **Emergency Role**: Circuit breaker activation
- **Contract Authorization**: Only registered contracts can modify user data

### Circuit Breakers
- **Global Pause**: Stops all protocol operations
- **Granular Pauses**: 
  - Pause new trades
  - Pause deposits
  - Pause withdrawals

### Validation
- Fee percentage limits (max 10% total)
- Timer parameter ranges
- Address validation for critical contracts
- Trading limit validation

## Upgrade Process

The contracts use OpenZeppelin's UUPS upgradeable proxy pattern:

1. Deploy new implementation contract
2. Call upgrade function (admin only)
3. Verify upgrade succeeded
4. Update documentation

```bash
# Upgrade example
npx hardhat run scripts/upgrade.js --network <network>
```

## Configuration

### Hub Configuration Structure
```solidity
struct HubConfig {
    address offerContract;        // Offer contract address
    address tradeContract;        // Trade contract address  
    address profileContract;      // Profile contract address
    address priceContract;        // Price oracle address
    address treasury;             // Treasury for fees
    address localMarket;          // Local market address
    address priceProvider;        // Price provider address
    
    uint16 burnFeePct;           // Burn fee (basis points)
    uint16 chainFeePct;          // Chain fee (basis points)
    uint16 warchestFeePct;       // Warchest fee (basis points)
    uint16 conversionFeePct;     // Conversion fee (basis points)
    
    uint256 minTradeAmount;      // Min trade (USD cents)
    uint256 maxTradeAmount;      // Max trade (USD cents)
    uint256 maxActiveOffers;     // Max active offers per user
    uint256 maxActiveTrades;     // Max active trades per user
    
    uint256 tradeExpirationTimer;  // Trade expiration time
    uint256 tradeDisputeTimer;     // Dispute window
    
    bool globalPause;            // Global pause flag
    bool pauseNewTrades;         // Pause new trades
    bool pauseDeposits;          // Pause deposits
    bool pauseWithdrawals;       // Pause withdrawals
}
```

## API Reference

### Hub Contract

#### Administrative Functions
- `initialize(HubConfig)`: Initialize contract with configuration
- `updateConfig(HubConfig)`: Update configuration (admin only)
- `updateAdmin(address)`: Transfer admin role
- `emergencyPause(string)`: Activate emergency pause
- `resume()`: Resume operations

#### View Functions
- `getConfig()`: Get current configuration
- `getAdmin()`: Get admin address
- `isPaused()`: Check if globally paused
- `isPausedByType(string)`: Check specific pause type

### Profile Contract

#### User Functions
- `updateContact(string, string)`: Update encrypted contact info
- `getProfile(address)`: Get user profile
- `getTradingStats(address)`: Get trading statistics
- `getReputationScore(address)`: Get reputation percentage

#### Contract Functions (Authorized Only)
- `updateTradeCount(address, bool)`: Update trade statistics
- `updateActiveOffers(address, int256)`: Update active offers count
- `updateActiveTrades(address, int256)`: Update active trades count

## Development Guidelines

### Adding New Features
1. Create interface in `contracts/interfaces/`
2. Implement contract with proper NatSpec comments
3. Add comprehensive tests
4. Update deployment scripts
5. Document API changes

### Code Style
- Follow Solidity best practices
- Use NatSpec comments for all public functions
- Implement proper error handling with custom errors
- Use events for important state changes

## Troubleshooting

### Common Issues

**Compilation Errors**
- Ensure Solidity version 0.8.24 is used
- Check OpenZeppelin version compatibility

**Test Failures** 
- Verify contract addresses in test setup
- Check for proper role assignments
- Ensure correct configuration parameters

**Deployment Issues**
- Verify network configuration
- Check gas limits and prices
- Ensure sufficient ETH balance

### Getting Help
- Check contract interfaces for function signatures
- Review test files for usage examples
- Consult OpenZeppelin documentation for upgradeable patterns

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Security Considerations

⚠️ **Important Security Notes:**
- Always test on testnets before mainnet deployment
- Use multi-signature wallets for admin roles in production
- Monitor contract events for suspicious activity
- Keep dependencies updated
- Conduct security audits before production use

## Roadmap

### Phase 1 ✅ 
- Hub and Profile contracts
- Basic infrastructure and testing

### Phase 2 (Next)
- Offer contract implementation
- Trade contract implementation
- Integration testing

### Phase 3 (Future)
- Price oracle integration
- Advanced features
- Mainnet deployment