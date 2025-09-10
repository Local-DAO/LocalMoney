# Axelar Network Integration Plan for Local Money Protocol

## Executive Summary

This document outlines a comprehensive strategy to integrate Axelar Network with Local Money Protocol, leveraging the existing BSC deployment as an EVM hub for cross-chain expansion without requiring full protocol redeployment on each chain.

## Current State Analysis

### Local Money BSC Deployment
- **Network**: BSC Mainnet (Chain ID: 56)
- **Core Contracts**:
  - Hub: `0x696F771E329DF4550044686C995AB9028fD3a724`
  - Trade: `0xe0cdc4bDb60fCeC0ED1FFedcbbFb86839206862f`
  - Escrow: `0xA07BfE2A3eE903Dde4e62ADc76cC32b57B0e0Cd2`
  - Offer: `0x5B1E3C79A6A84BD436Fe2141A13E1767C178E621`
  - Profile: `0x9a1AD40c90E5f282152Aa9F56d18B99F31794B68`

### Axelar Network Capabilities
- **Cross-Chain Communication**: General Message Passing (GMP) for contract calls
- **Token Transfers**: Interchain Token Service (ITS) for cross-chain token movement
- **Supported Networks**: 80+ blockchains including major EVM chains
- **Key Infrastructure**:
  - Gateway Contracts on each chain
  - Validator network for security
  - Relayer service for message delivery

## Integration Architecture

### Hub-and-Spoke Model
BSC deployment serves as the primary hub, with satellite contracts on other chains communicating through Axelar.

```
┌─────────────────────────────────────────────────────────────┐
│                        BSC Hub                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Local Money Core Protocol (Full Deployment)         │   │
│  │  - Hub, Trade, Escrow, Offer, Profile               │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│                    Axelar Gateway BSC                        │
└─────────────────────────────────────────────────────────────┘
                             │
                    Axelar Network (GMP)
                    /        │        \
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ Ethereum │    │ Polygon  │    │Arbitrum  │
        │ Satellite│    │ Satellite│    │ Satellite│
        └──────────┘    └──────────┘    └──────────┘
```

## Implementation Strategy

### Phase 1: Core Infrastructure (Weeks 1-2)

#### 1.1 Axelar Integration Contracts
Create new contracts for cross-chain functionality:

```solidity
// contracts/evm/contracts/crosschain/AxelarBridge.sol
contract AxelarBridge is AxelarExecutable {
    // Handles incoming messages from other chains
    // Routes to appropriate Local Money contracts
}

// contracts/evm/contracts/crosschain/SatelliteContract.sol
contract SatelliteContract {
    // Lightweight contract deployed on other chains
    // Forwards operations to BSC hub via Axelar
}
```

#### 1.2 Message Types Definition
Define standardized message formats for cross-chain operations:

```solidity
enum MessageType {
    CREATE_OFFER,
    CREATE_TRADE,
    FUND_ESCROW,
    RELEASE_FUNDS,
    DISPUTE_TRADE,
    UPDATE_PROFILE
}

struct CrossChainMessage {
    MessageType messageType;
    address sender;
    uint256 sourceChainId;
    bytes payload;
}
```

### Phase 2: Token Bridge Integration (Weeks 3-4)

#### 2.1 Interchain Token Service Integration
- Deploy ITS-compatible token wrappers
- Enable cross-chain USDT/USDC support
- Implement fee collection across chains

#### 2.2 Escrow Enhancement
```solidity
contract CrossChainEscrow {
    // Extends current Escrow contract
    // Handles multi-chain token locks
    // Coordinates with Axelar ITS
}
```

### Phase 3: Satellite Contract Deployment (Weeks 5-6)

#### 3.1 Target Chains (Revised Priority - Cost Optimized)
**Phase 1 - Ultra Low Cost Chains**
1. **Polygon** - $0.01-0.05 per tx, massive adoption
2. **Avalanche** - $0.05-0.20 per tx, fast finality
3. **Base** - $0.05-0.15 per tx, Coinbase ecosystem

**Phase 2 - Medium Cost**
4. **Arbitrum** - $0.10-0.50 per tx, high DeFi activity
5. **Optimism** - $0.20-0.80 per tx, growing ecosystem

**Phase 3 - Premium Markets (Later)**
6. **Ethereum** - $5-50 per tx, only after proven traction

#### 3.2 Satellite Contract Features
Minimal contracts on each chain that:
- Accept user interactions
- Validate basic parameters
- Forward requests to BSC hub
- Handle response callbacks
- Manage local state caching

### Phase 4: Cross-Chain Trade Flow (Weeks 7-8)

#### 4.1 User Journey Example
1. **Offer Creation (Polygon)**
   ```
   User → Polygon Satellite → Axelar GMP → BSC Hub → Store Offer
   ```

2. **Trade Initiation (Ethereum)**
   ```
   User → Ethereum Satellite → Axelar GMP → BSC Hub → Create Trade
   ```

3. **Escrow Funding (Cross-chain)**
   ```
   User → Source Chain → Axelar ITS → BSC Escrow → Lock Funds
   ```

4. **Settlement (Any Chain)**
   ```
   BSC Hub → Axelar GMP → Destination Chain → Release Funds
   ```

## Technical Implementation Details

### Smart Contract Modifications

#### Hub Contract Enhancement
```solidity
contract HubV2 is Hub {
    mapping(uint256 => address) public chainGateways;
    mapping(uint256 => address) public satelliteContracts;

    function registerChain(
        uint256 chainId,
        address gateway,
        address satellite
    ) external onlyAdmin {
        chainGateways[chainId] = gateway;
        satelliteContracts[chainId] = satellite;
    }

    function processCrossChainMessage(
        string memory sourceChain,
        string memory sourceAddress,
        bytes calldata payload
    ) external onlyAxelarGateway {
        // Process incoming cross-chain requests
    }
}
```

#### Satellite Contract Template
```solidity
contract LocalMoneySatellite {
    IAxelarGateway public gateway;
    IAxelarGasService public gasService;
    string public hubChain = "binance";
    string public hubAddress;

    function createOffer(OfferParams memory params) external payable {
        bytes memory payload = abi.encode(
            MessageType.CREATE_OFFER,
            msg.sender,
            params
        );

        gasService.payNativeGasForContractCall{value: msg.value}(
            address(this),
            hubChain,
            hubAddress,
            payload,
            msg.sender
        );

        gateway.callContract(hubChain, hubAddress, payload);
    }
}
```

### Gas Management Strategy

#### Cross-Chain Gas Payment
1. **Prepaid Model**: Users pay gas upfront on source chain
2. **Gas Service Integration**: Use AxelarGasService for estimation
3. **Refund Mechanism**: Return excess gas to users
4. **Fee Structure**:
   - Base protocol fee (unchanged)
   - Cross-chain relay fee (dynamic)
   - Destination chain execution fee

### Security Considerations

#### 1. Message Validation
- Verify source chain and contract
- Validate message signatures
- Implement replay protection
- Rate limiting for cross-chain calls

#### 2. Access Control
```solidity
modifier onlyAxelarGateway() {
    require(msg.sender == address(gateway), "Only Axelar Gateway");
    _;
}

modifier onlyRegisteredSatellite(string memory sourceChain) {
    require(
        keccak256(bytes(satelliteContracts[sourceChain])) ==
        keccak256(bytes(sourceAddress)),
        "Unknown satellite"
    );
    _;
}
```

#### 3. Emergency Controls
- Circuit breakers for each chain
- Pause individual chain connections
- Upgrade mechanism for satellites

## Deployment Roadmap

### Month 1: Foundation
- Week 1-2: Develop and test Axelar integration contracts
- Week 3-4: Implement ITS for token bridging

### Month 2: Expansion
- Week 5-6: Deploy satellites on 3 priority chains
- Week 7-8: Implement complete cross-chain trade flow

### Month 3: Production
- Week 9-10: Security audits and testing
- Week 11-12: Mainnet deployment and monitoring

## Cost-Benefit Analysis

### Benefits
1. **No Full Redeployment**: Save deployment costs and complexity
2. **Unified Liquidity**: All trades settle through BSC hub
3. **Simplified Management**: Single point of protocol upgrades
4. **Wider Reach**: Access users on 80+ chains
5. **Consistent State**: BSC as single source of truth

### Realistic Costs (Bootstrap Approach)
1. **Development**: $0 (self-developed)
2. **Audits**: $0 (AI-based review + community testing)
3. **Infrastructure**: $0-50/month (free tiers)
4. **Deployment Gas**: ~$50-200 one-time
5. **Cross-chain Messages**: ~$0.10-1.00 per transaction

## Risk Mitigation

### Technical Risks
- **Axelar Downtime**: Implement fallback mechanisms
- **Message Delays**: Set appropriate timeouts
- **Gas Spikes**: Dynamic fee adjustment

### Security Risks
- **Bridge Exploits**: Limit value per transaction
- **Replay Attacks**: Nonce-based protection
- **Satellite Compromise**: Minimal logic on satellites

## Success Metrics

### Key Performance Indicators
1. **Cross-chain Transaction Volume**: Target 1000+ trades/month
2. **New Chain Users**: 10% monthly growth
3. **Gas Efficiency**: <$1 average cross-chain cost
4. **System Uptime**: 99.9% availability
5. **Settlement Time**: <5 minutes cross-chain

## Next Steps

### Immediate Actions
1. [ ] Review and approve integration plan
2. [ ] Set up Axelar testnet environment
3. [ ] Begin AxelarBridge contract development
4. [ ] Create satellite contract templates
5. [ ] Design cross-chain message formats

### Prerequisites
1. [ ] Axelar account and API access
2. [ ] Test tokens on multiple chains
3. [ ] Multi-chain wallet setup
4. [ ] Monitoring infrastructure

## Appendix

### A. Supported Chains Priority List (Cost-Optimized)
Based on transaction costs and adoption:

**Phase 1 - Bootstrap Launch (Immediate)**
- Polygon (Gas: $0.01-0.05)
- Avalanche (Gas: $0.05-0.20)
- Base (Gas: $0.05-0.15)

**Infrastructure Requirements Per Phase**
- Phase 1: Free tiers only ($0/month)

### B. Technical Resources
- [Axelar Docs](https://docs.axelar.dev/)
- [GMP Examples](https://github.com/axelarnetwork/axelar-examples)
- [ITS Documentation](https://docs.axelar.dev/dev/its/intro)
- [Gas Service Guide](https://docs.axelar.dev/dev/gas-service/intro)
