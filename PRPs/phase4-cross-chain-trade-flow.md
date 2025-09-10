# Phase 4: Cross-Chain Trade Flow Implementation PRP

## Overview
Implement the complete cross-chain trade flow enabling users on any supported chain to create offers, initiate trades, fund escrows, and settle transactions through the BSC hub via Axelar GMP.

## Reference Documentation
- Master Plan: `/Users/samb/workspace/localmoney/AXELAR_INTEGRATION_PLAN.md`
- Trade Contract: `/contracts/evm/contracts/Trade.sol`
- Axelar Callbacks: https://docs.axelar.dev/dev/general-message-passing/gmp-callback
- Two-Way Messaging: https://docs.axelar.dev/dev/general-message-passing/gmp-two-way
- Gas Payment: https://docs.axelar.dev/dev/gas-service/increase-gas

## Context for AI Agent

### Existing Infrastructure (From Previous Phases)
- **Phase 1**: AxelarBridge and message routing ready
- **Phase 2**: Token bridge and CrossChainEscrow functional
- **Phase 3**: Satellites deployed on Polygon, Avalanche, Base
- **BSC Hub**: Full protocol with all contracts

### Trade Flow Components
1. **Offer Creation**: User creates offer from any chain
2. **Trade Initiation**: Counterparty accepts offer from any chain
3. **Escrow Funding**: Tokens bridged and locked cross-chain
4. **Settlement**: Funds released to parties on their chains
5. **Dispute Handling**: Arbitration across chains

### Current Trade Implementation
- Trade states: Created, Funded, Completed, Disputed, Cancelled
- Timer-based expiration
- Arbitrator system for disputes
- Fee distribution logic

## Implementation Blueprint

### 1. Complete Flow Architecture
```
User (Polygon) → Satellite → Axelar → BSC Hub → Process → Response
                                          ↓
                                    State Update
                                          ↓
                              Axelar ← Callback ← BSC Hub
                                ↓
                        Satellite ← Update Cache
                                ↓
                          User Gets Result
```

### 2. Core Implementation Steps

#### Step 1: Enhance Message Types
```solidity
// contracts/evm/contracts/crosschain/MessageTypes.sol
library MessageTypes {
    enum MessageType {
        // ... existing types
        TRADE_STATUS_QUERY,
        BATCH_TRADE_UPDATE,
        ESCROW_STATUS,
        CALLBACK_RESPONSE
    }
    
    struct TradeMessage {
        bytes32 tradeId;
        address buyer;
        address seller;
        address token;
        uint256 amount;
        uint256 sourceChainId;
        uint256 destChainId;
    }
    
    struct CallbackMessage {
        bool success;
        bytes32 requestId;
        bytes data;
        string errorMessage;
    }
}
```

#### Step 2: Implement Two-Way Communication
```solidity
// contracts/evm/contracts/crosschain/AxelarBridge.sol
contract AxelarBridge {
    mapping(bytes32 => PendingCallback) public pendingCallbacks;
    
    struct PendingCallback {
        string sourceChain;
        string sourceAddress;
        bytes32 requestId;
        uint256 timestamp;
    }
    
    function executeWithCallback(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external override {
        // Process message
        bytes32 requestId = keccak256(abi.encodePacked(
            sourceChain, 
            sourceAddress, 
            block.timestamp
        ));
        
        // Store for callback
        pendingCallbacks[requestId] = PendingCallback({
            sourceChain: sourceChain,
            sourceAddress: sourceAddress,
            requestId: requestId,
            timestamp: block.timestamp
        });
        
        // Process and prepare callback
        _processAndCallback(requestId, payload);
    }
}
```

#### Step 3: Complete Trade Flow Functions
```solidity
// contracts/evm/contracts/satellites/LocalMoneySatellite.sol
contract LocalMoneySatellite {
    struct LocalTradeInfo {
        bytes32 tradeId;
        address buyer;
        address seller;
        uint256 amount;
        uint8 status;
        uint256 lastUpdate;
    }
    
    mapping(bytes32 => LocalTradeInfo) public localTrades;
    
    function initiateTradeWithEscrow(
        bytes32 offerId,
        uint256 amount,
        address token,
        uint256 escrowAmount
    ) external payable {
        // 1. Bridge tokens to BSC
        _bridgeTokens(token, escrowAmount);
        
        // 2. Send trade creation message
        bytes memory payload = abi.encode(
            MessageType.CREATE_TRADE,
            msg.sender,
            offerId,
            amount,
            token,
            escrowAmount
        );
        
        // 3. Pay gas and send
        _payGasAndCallContractWithCallback(payload);
        
        // 4. Store local info
        bytes32 tradeId = keccak256(abi.encodePacked(
            offerId, 
            msg.sender, 
            block.timestamp
        ));
        
        localTrades[tradeId] = LocalTradeInfo({
            tradeId: tradeId,
            buyer: msg.sender,
            seller: address(0), // Will be updated
            amount: amount,
            status: 0, // Created
            lastUpdate: block.timestamp
        });
    }
    
    function handleCallback(
        bytes32 requestId,
        bool success,
        bytes memory data
    ) external onlyGateway {
        // Update local state based on callback
        if (success) {
            (bytes32 tradeId, uint8 newStatus) = abi.decode(
                data, 
                (bytes32, uint8)
            );
            localTrades[tradeId].status = newStatus;
            localTrades[tradeId].lastUpdate = block.timestamp;
            
            emit TradeStatusUpdated(tradeId, newStatus);
        }
    }
}
```

#### Step 4: Settlement Flow
```solidity
// contracts/evm/contracts/crosschain/CrossChainEscrow.sol
contract CrossChainEscrow {
    function settleCrossChainTrade(
        bytes32 tradeId,
        uint256 buyerChainId,
        uint256 sellerChainId,
        address buyerAddress,
        address sellerAddress,
        address token,
        uint256 amount
    ) external onlyTradeContract {
        // Calculate settlement amounts
        (uint256 sellerAmount, uint256 fees) = _calculateSettlement(amount);
        
        // If seller is on different chain
        if (sellerChainId != block.chainid) {
            _bridgeToChain(
                sellerChainId,
                sellerAddress,
                token,
                sellerAmount
            );
        } else {
            // Direct transfer if same chain
            IERC20(token).safeTransfer(sellerAddress, sellerAmount);
        }
        
        // Handle fees
        _distributeFees(fees);
        
        // Emit settlement event
        emit CrossChainSettlement(
            tradeId,
            buyerChainId,
            sellerChainId,
            amount
        );
    }
}
```

## Tasks List (In Order)

1. **Enhance Message Types**
   - Add trade-specific message types
   - Create callback message structures
   - Add batch operation support
   - Implement message validation

2. **Implement Two-Way Messaging**
   - Add callback support to AxelarBridge
   - Create request tracking system
   - Implement timeout handling
   - Add retry mechanism

3. **Update Satellite Contracts**
   - Add complete trade functions
   - Implement local state caching
   - Add callback handlers
   - Create query functions

4. **Implement Trade Creation Flow**
   - Cross-chain offer creation
   - Trade initiation with escrow
   - Status tracking
   - Event emission

5. **Implement Escrow Flow**
   - Cross-chain token deposits
   - Lock verification
   - Balance tracking
   - Timeout handling

6. **Implement Settlement Flow**
   - Multi-chain fund release
   - Fee distribution
   - Refund mechanisms
   - Settlement confirmation

7. **Implement Dispute Flow**
   - Cross-chain dispute initiation
   - Evidence submission
   - Arbitrator assignment
   - Resolution execution

8. **Create Helper Scripts**
   - Trade monitoring scripts
   - Gas estimation helpers
   - Status query tools
   - Settlement verifiers

9. **Write Integration Tests**
   - Full trade flow test
   - Multi-hop trade test
   - Dispute resolution test
   - Settlement verification test

## Validation Gates

```bash
# Compile all contracts
cd contracts/evm
just compile

# Run unit tests
just test test/crosschain/TradeFlow.test.js
just test test/crosschain/Settlement.test.js
just test test/crosschain/Callbacks.test.js

# Run integration tests
just test test/integration/FullTradeFlow.test.js
just test test/integration/MultiChainTrade.test.js

# Test on testnets
npx hardhat run scripts/test-trade-flow.js --network polygon-testnet
npx hardhat run scripts/test-trade-flow.js --network avalanche-testnet
npx hardhat run scripts/test-trade-flow.js --network base-testnet

# Monitor cross-chain messages
npx hardhat run scripts/monitor-axelar.js

# Verify settlement
npx hardhat run scripts/verify-settlement.js --trade-id <TRADE_ID>

# Gas report
just gas-report
```

## Error Handling Strategy

1. **Message Failures**
   - Automatic retry with exponential backoff
   - Admin intervention after 3 retries
   - Refund mechanism for stuck funds
   - Event logging for debugging

2. **Trade State Issues**
   - State reconciliation mechanism
   - Manual override by admin
   - Timeout-based cancellation
   - Emergency withdrawal

3. **Settlement Failures**
   - Retry settlement with higher gas
   - Alternative settlement path
   - Admin-assisted settlement
   - User-initiated refund after timeout

## Security Considerations

1. **Trade Security**
   - Validate all trade parameters
   - Check sufficient escrow
   - Verify participant addresses
   - Prevent double-spending

2. **Cross-Chain Security**
   - Verify chain IDs match expected
   - Check message authenticity
   - Validate callback sources
   - Rate limit per user

3. **Settlement Security**
   - Ensure atomic settlement
   - Prevent partial releases
   - Verify fee calculations
   - Check recipient validity

## Test Scenarios

### Scenario 1: Basic Cross-Chain Trade
```javascript
// test/integration/BasicCrossChainTrade.test.js
it("should complete trade from Polygon to Avalanche", async () => {
    // 1. Create offer on Polygon
    // 2. Accept offer from Avalanche
    // 3. Fund escrow cross-chain
    // 4. Complete trade
    // 5. Verify settlement on both chains
});
```

### Scenario 2: Multi-Hop Trade
```javascript
// test/integration/MultiHopTrade.test.js
it("should handle trade with 3+ chain hops", async () => {
    // 1. Offer on Chain A
    // 2. Accept on Chain B
    // 3. Escrow from Chain C
    // 4. Settlement to Chain D
});
```

### Scenario 3: Dispute Resolution
```javascript
// test/integration/DisputeFlow.test.js
it("should resolve dispute across chains", async () => {
    // 1. Create and fund trade
    // 2. Initiate dispute from buyer chain
    // 3. Submit evidence from seller chain
    // 4. Arbitrator decision on BSC
    // 5. Execute resolution cross-chain
});
```

## Performance Metrics

### Expected Performance
- **Trade Creation**: 10-30 seconds (cross-chain)
- **Escrow Funding**: 1-3 minutes (with bridging)
- **Settlement**: 1-2 minutes (cross-chain)
- **Query Response**: 5-15 seconds

### Gas Costs (Estimated)
- **Create Trade**: $0.20-0.50 (including Axelar fee)
- **Fund Escrow**: $0.30-1.00 (including bridge fee)
- **Complete Trade**: $0.20-0.50
- **Settlement**: $0.30-0.80

## Implementation Notes

### Critical Integration Points
1. **With Existing Trade Contract**
   - Maintain state machine compatibility
   - Preserve timer logic
   - Keep fee structure
   - Support existing events

2. **With CrossChainEscrow**
   - Coordinate token locks
   - Track multi-chain deposits
   - Handle settlement distribution
   - Manage refunds

3. **With Satellites**
   - Consistent message format
   - Proper callback routing
   - State synchronization
   - Event propagation

### Production Considerations
1. **Monitoring Setup**
   - Axelar message tracking
   - Trade state monitoring
   - Settlement verification
   - Gas usage tracking

2. **Operational Procedures**
   - Daily reconciliation
   - Stuck trade handling
   - Gas price management
   - Emergency procedures

## Success Criteria

1. ✅ Complete trade flow working across all chains
2. ✅ Escrow funding and release functional
3. ✅ Settlement completes within 5 minutes
4. ✅ Callbacks update local state correctly
5. ✅ Dispute resolution works cross-chain
6. ✅ Gas costs within acceptable range
7. ✅ All integration tests passing
8. ✅ Production monitoring in place

## Dependencies and External Resources

### External Services
- Axelar Network Status: https://axelarscan.io/
- Gas Price APIs for each chain
- Block explorers for verification
- Monitoring services (optional)

### Documentation
- Axelar Message Status: https://docs.axelar.dev/dev/general-message-passing/gmp-status
- Debugging Guide: https://docs.axelar.dev/dev/general-message-passing/gmp-debug
- Recovery Procedures: https://docs.axelar.dev/dev/general-message-passing/gmp-recovery

## Known Challenges & Solutions

### Challenge 1: Message Latency
- **Problem**: Cross-chain messages take 1-5 minutes
- **Solution**: Optimistic UI updates with local caching

### Challenge 2: Gas Price Volatility
- **Problem**: Gas costs vary significantly
- **Solution**: Dynamic fee adjustment with buffers

### Challenge 3: State Synchronization
- **Problem**: Keeping satellite state in sync
- **Solution**: Periodic reconciliation and event-based updates

## Complete Implementation Code

### Full Cross-Chain Trade Flow Implementation
```solidity
// contracts/evm/contracts/crosschain/CrossChainTradeManager.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AxelarBridge.sol";
import "./CrossChainEscrow.sol";
import "../interfaces/ITrade.sol";
import "../interfaces/IOffer.sol";

contract CrossChainTradeManager {
    struct CrossChainTrade {
        bytes32 tradeId;
        uint256 buyerChainId;
        uint256 sellerChainId;
        address buyer;
        address seller;
        address token;
        uint256 amount;
        uint256 price;
        uint8 status;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 completedAt;
        bytes32 offerId;
    }
    
    struct PendingCallback {
        string sourceChain;
        string sourceAddress;
        bytes32 requestId;
        uint256 timestamp;
        MessageTypes.MessageType messageType;
        address requester;
    }
    
    mapping(bytes32 => CrossChainTrade) public crossChainTrades;
    mapping(bytes32 => PendingCallback) public pendingCallbacks;
    mapping(bytes32 => bool) public processedCallbacks;
    
    AxelarBridge public bridge;
    CrossChainEscrow public escrow;
    ITrade public tradeContract;
    IOffer public offerContract;
    
    uint256 public constant CALLBACK_TIMEOUT = 10 minutes;
    uint256 public constant MAX_RETRY_ATTEMPTS = 3;
    
    mapping(bytes32 => uint256) public retryAttempts;
    
    event CrossChainTradeCreated(
        bytes32 indexed tradeId,
        uint256 buyerChainId,
        uint256 sellerChainId,
        address buyer,
        address seller
    );
    
    event CrossChainTradeFunded(
        bytes32 indexed tradeId,
        uint256 amount,
        uint256 sourceChainId
    );
    
    event CrossChainTradeCompleted(
        bytes32 indexed tradeId,
        uint256 buyerChainId,
        uint256 sellerChainId
    );
    
    event CallbackProcessed(
        bytes32 indexed requestId,
        bool success,
        string sourceChain
    );
    
    function processCrossChainOffer(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) external onlyBridge {
        (
            bytes32 offerId,
            address token,
            uint256 amount,
            uint256 price,
            bool isBuy
        ) = abi.decode(message.payload, (bytes32, address, uint256, uint256, bool));
        
        // Create offer on hub
        uint256 localOfferId = offerContract.createOfferForUser(
            message.sender,
            token,
            amount,
            price,
            isBuy
        );
        
        // Store mapping for cross-chain reference
        _storeOfferMapping(offerId, localOfferId, message.sourceChainId);
        
        // Send success callback
        _sendCallback(
            sourceChain,
            message.sender,
            true,
            abi.encode(offerId, localOfferId)
        );
    }
    
    function processCrossChainTrade(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) external onlyBridge {
        (
            bytes32 tradeId,
            bytes32 offerId,
            uint256 amount
        ) = abi.decode(message.payload, (bytes32, bytes32, uint256));
        
        // Get offer details
        uint256 localOfferId = _getLocalOfferId(offerId);
        IOffer.OfferData memory offer = offerContract.getOffer(localOfferId);
        
        // Determine buyer and seller
        address buyer = offer.isBuy ? offer.creator : message.sender;
        address seller = offer.isBuy ? message.sender : offer.creator;
        
        // Create cross-chain trade
        crossChainTrades[tradeId] = CrossChainTrade({
            tradeId: tradeId,
            buyerChainId: offer.isBuy ? offer.creatorChainId : message.sourceChainId,
            sellerChainId: offer.isBuy ? message.sourceChainId : offer.creatorChainId,
            buyer: buyer,
            seller: seller,
            token: offer.token,
            amount: amount,
            price: offer.price,
            status: 0, // Created
            createdAt: block.timestamp,
            fundedAt: 0,
            completedAt: 0,
            offerId: offerId
        });
        
        // Create local trade
        uint256 localTradeId = tradeContract.createTradeForUsers(
            buyer,
            seller,
            localOfferId,
            amount
        );
        
        emit CrossChainTradeCreated(
            tradeId,
            crossChainTrades[tradeId].buyerChainId,
            crossChainTrades[tradeId].sellerChainId,
            buyer,
            seller
        );
        
        // Send callback with trade details
        _sendCallback(
            sourceChain,
            message.sender,
            true,
            abi.encode(tradeId, localTradeId, buyer, seller)
        );
    }
    
    function processCrossChainEscrow(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) external onlyBridge {
        (
            bytes32 tradeId,
            address token,
            uint256 amount
        ) = abi.decode(message.payload, (bytes32, address, uint256));
        
        CrossChainTrade storage trade = crossChainTrades[tradeId];
        require(trade.status == 0, "Trade not in correct state");
        
        // Record escrow funding from source chain
        escrow.depositFromChain(
            message.sourceChainId,
            message.sender,
            token,
            amount,
            tradeId
        );
        
        // Update trade status
        trade.status = 1; // Funded
        trade.fundedAt = block.timestamp;
        
        emit CrossChainTradeFunded(tradeId, amount, message.sourceChainId);
        
        // Send success callback
        _sendCallback(
            sourceChain,
            message.sender,
            true,
            abi.encode(tradeId, 1) // Status: Funded
        );
    }
    
    function processCrossChainRelease(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) external onlyBridge {
        bytes32 tradeId = abi.decode(message.payload, (bytes32));
        
        CrossChainTrade storage trade = crossChainTrades[tradeId];
        require(trade.status == 1, "Trade not funded");
        require(trade.buyer == message.sender, "Only buyer can release");
        
        // Calculate settlement
        (uint256 sellerAmount, uint256 fees) = _calculateSettlement(trade.amount);
        
        // Release funds to seller's chain
        escrow.releaseToChain(
            trade.sellerChainId,
            trade.seller,
            trade.token,
            sellerAmount,
            tradeId
        );
        
        // Update trade status
        trade.status = 2; // Completed
        trade.completedAt = block.timestamp;
        
        emit CrossChainTradeCompleted(
            tradeId,
            trade.buyerChainId,
            trade.sellerChainId
        );
        
        // Send completion callbacks to both parties
        _sendCallback(
            sourceChain,
            trade.buyer,
            true,
            abi.encode(tradeId, 2) // Status: Completed
        );
        
        if (trade.sellerChainId != block.chainid) {
            _sendCallback(
                _getChainName(trade.sellerChainId),
                trade.seller,
                true,
                abi.encode(tradeId, 2, sellerAmount)
            );
        }
    }
    
    function processDispute(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) external onlyBridge {
        (
            bytes32 tradeId,
            string memory reason
        ) = abi.decode(message.payload, (bytes32, string));
        
        CrossChainTrade storage trade = crossChainTrades[tradeId];
        require(
            trade.buyer == message.sender || trade.seller == message.sender,
            "Not a trade party"
        );
        require(trade.status == 1, "Trade not in disputable state");
        
        // Initiate dispute
        trade.status = 3; // Disputed
        
        // Forward to arbitration system
        _initiateArbitration(tradeId, message.sender, reason);
        
        // Notify both parties
        _sendCallback(
            sourceChain,
            message.sender,
            true,
            abi.encode(tradeId, 3) // Status: Disputed
        );
    }
    
    function _sendCallback(
        string memory destinationChain,
        address recipient,
        bool success,
        bytes memory data
    ) internal {
        bytes32 requestId = keccak256(abi.encodePacked(
            destinationChain,
            recipient,
            block.timestamp,
            data
        ));
        
        bytes memory payload = abi.encode(
            success,
            requestId,
            data
        );
        
        // Store pending callback
        pendingCallbacks[requestId] = PendingCallback({
            sourceChain: destinationChain,
            sourceAddress: _addressToString(recipient),
            requestId: requestId,
            timestamp: block.timestamp,
            messageType: MessageTypes.MessageType.CALLBACK_RESPONSE,
            requester: recipient
        });
        
        // Send via Axelar
        bridge.sendMessage(
            destinationChain,
            _getSatelliteAddress(destinationChain),
            payload
        );
        
        emit CallbackProcessed(requestId, success, destinationChain);
    }
    
    function retryCallback(bytes32 requestId) external {
        PendingCallback memory callback = pendingCallbacks[requestId];
        require(callback.timestamp > 0, "Callback not found");
        require(
            block.timestamp > callback.timestamp + CALLBACK_TIMEOUT,
            "Timeout not reached"
        );
        require(
            retryAttempts[requestId] < MAX_RETRY_ATTEMPTS,
            "Max retries reached"
        );
        
        retryAttempts[requestId]++;
        
        // Resend callback
        bridge.sendMessage(
            callback.sourceChain,
            callback.sourceAddress,
            abi.encode(true, requestId, "")
        );
    }
}
```

### Complete Integration Test Suite
```javascript
// test/integration/FullCrossChainFlow.test.js
const { ethers, network } = require("hardhat");
const { expect } = require("chai");

describe("Full Cross-Chain Trade Flow", function () {
    let hub, bridge, escrow, tradeManager;
    let polygonSatellite, avalancheSatellite;
    let seller, buyer, arbitrator;
    
    // Simulate different chain IDs
    const POLYGON_CHAIN_ID = 137;
    const AVALANCHE_CHAIN_ID = 43114;
    const BSC_CHAIN_ID = 56;
    
    beforeEach(async function () {
        [owner, seller, buyer, arbitrator] = await ethers.getSigners();
        
        // Deploy full protocol stack
        const deployment = await deployFullProtocol();
        hub = deployment.hub;
        bridge = deployment.bridge;
        escrow = deployment.escrow;
        tradeManager = deployment.tradeManager;
        
        // Deploy satellite mocks
        polygonSatellite = await deploySatelliteMock(POLYGON_CHAIN_ID);
        avalancheSatellite = await deploySatelliteMock(AVALANCHE_CHAIN_ID);
        
        // Register chains
        await bridge.registerChain("Polygon", polygonSatellite.address);
        await bridge.registerChain("Avalanche", avalancheSatellite.address);
    });
    
    describe("Complete Trade Flow: Polygon Seller -> Avalanche Buyer", function () {
        let offerId, tradeId;
        const offerAmount = ethers.parseUnits("1000", 6); // 1000 USDT
        const tradeAmount = ethers.parseUnits("500", 6); // 500 USDT
        const price = ethers.parseEther("1.05"); // 1.05 USD per USDT
        
        it("Step 1: Seller creates offer from Polygon", async function () {
            // Simulate message from Polygon satellite
            const offerMessage = {
                messageType: 0, // CREATE_OFFER
                sender: seller.address,
                sourceChainId: POLYGON_CHAIN_ID,
                nonce: 1,
                payload: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", "address", "uint256", "uint256", "bool"],
                    [
                        ethers.randomBytes(32), // offerId
                        "0x55d398326f99059fF775485246999027B3197955", // USDT BSC
                        offerAmount,
                        price,
                        false // Sell offer
                    ]
                )
            };
            
            await expect(
                bridge.simulateIncomingMessage(
                    "Polygon",
                    polygonSatellite.address,
                    offerMessage
                )
            ).to.emit(tradeManager, "OfferCreatedCrossChain");
            
            // Verify callback sent
            const callbacks = await bridge.getPendingCallbacks();
            expect(callbacks.length).to.equal(1);
            expect(callbacks[0].sourceChain).to.equal("Polygon");
            
            offerId = callbacks[0].data.offerId;
        });
        
        it("Step 2: Buyer accepts offer from Avalanche", async function () {
            // Setup offer first
            await setupOffer();
            
            // Simulate trade creation from Avalanche
            const tradeMessage = {
                messageType: 1, // CREATE_TRADE
                sender: buyer.address,
                sourceChainId: AVALANCHE_CHAIN_ID,
                nonce: 1,
                payload: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", "bytes32", "uint256"],
                    [
                        ethers.randomBytes(32), // tradeId
                        offerId,
                        tradeAmount
                    ]
                )
            };
            
            await expect(
                bridge.simulateIncomingMessage(
                    "Avalanche",
                    avalancheSatellite.address,
                    tradeMessage
                )
            ).to.emit(tradeManager, "CrossChainTradeCreated")
            .withArgs(
                tradeId,
                AVALANCHE_CHAIN_ID,
                POLYGON_CHAIN_ID,
                buyer.address,
                seller.address
            );
            
            // Verify trade state
            const trade = await tradeManager.crossChainTrades(tradeId);
            expect(trade.status).to.equal(0); // Created
            expect(trade.buyerChainId).to.equal(AVALANCHE_CHAIN_ID);
            expect(trade.sellerChainId).to.equal(POLYGON_CHAIN_ID);
        });
        
        it("Step 3: Buyer funds escrow from Avalanche", async function () {
            // Setup trade first
            await setupTrade();
            
            // Simulate escrow funding from Avalanche
            const escrowMessage = {
                messageType: 2, // FUND_ESCROW
                sender: buyer.address,
                sourceChainId: AVALANCHE_CHAIN_ID,
                nonce: 2,
                payload: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", "address", "uint256"],
                    [
                        tradeId,
                        "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", // USDT Avalanche
                        tradeAmount
                    ]
                )
            };
            
            // Mock token bridge transfer
            await mockTokenBridge.simulateTokenArrival(
                AVALANCHE_CHAIN_ID,
                tradeAmount
            );
            
            await expect(
                bridge.simulateIncomingMessage(
                    "Avalanche",
                    avalancheSatellite.address,
                    escrowMessage
                )
            ).to.emit(tradeManager, "CrossChainTradeFunded")
            .withArgs(tradeId, tradeAmount, AVALANCHE_CHAIN_ID);
            
            // Verify escrow balance
            const escrowBalance = await escrow.crossChainDeposits(tradeId);
            expect(escrowBalance.amount).to.equal(tradeAmount);
            expect(escrowBalance.sourceChainId).to.equal(AVALANCHE_CHAIN_ID);
            
            // Verify trade status updated
            const trade = await tradeManager.crossChainTrades(tradeId);
            expect(trade.status).to.equal(1); // Funded
        });
        
        it("Step 4: Buyer completes trade, funds released to Polygon", async function () {
            // Setup funded trade
            await setupFundedTrade();
            
            // Simulate trade completion from Avalanche
            const completeMessage = {
                messageType: 3, // RELEASE_FUNDS
                sender: buyer.address,
                sourceChainId: AVALANCHE_CHAIN_ID,
                nonce: 3,
                payload: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32"],
                    [tradeId]
                )
            };
            
            await expect(
                bridge.simulateIncomingMessage(
                    "Avalanche",
                    avalancheSatellite.address,
                    completeMessage
                )
            ).to.emit(tradeManager, "CrossChainTradeCompleted")
            .withArgs(
                tradeId,
                AVALANCHE_CHAIN_ID,
                POLYGON_CHAIN_ID
            );
            
            // Verify funds released to seller's chain
            const releaseEvents = await escrow.queryFilter(
                escrow.filters.CrossChainReleaseInitiated()
            );
            expect(releaseEvents.length).to.equal(1);
            expect(releaseEvents[0].args.destinationChainId).to.equal(POLYGON_CHAIN_ID);
            expect(releaseEvents[0].args.recipient).to.equal(seller.address);
            
            // Verify callbacks sent to both parties
            const callbacks = await bridge.getPendingCallbacks();
            const buyerCallback = callbacks.find(c => c.requester === buyer.address);
            const sellerCallback = callbacks.find(c => c.requester === seller.address);
            
            expect(buyerCallback).to.not.be.undefined;
            expect(sellerCallback).to.not.be.undefined;
            
            // Verify trade completed
            const trade = await tradeManager.crossChainTrades(tradeId);
            expect(trade.status).to.equal(2); // Completed
            expect(trade.completedAt).to.be.gt(0);
        });
    });
    
    describe("Dispute Resolution Flow", function () {
        it("Should handle cross-chain dispute", async function () {
            // Setup funded trade
            await setupFundedTrade();
            
            // Buyer initiates dispute from Avalanche
            const disputeMessage = {
                messageType: 4, // DISPUTE_TRADE
                sender: buyer.address,
                sourceChainId: AVALANCHE_CHAIN_ID,
                nonce: 4,
                payload: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", "string"],
                    [tradeId, "Product not as described"]
                )
            };
            
            await expect(
                bridge.simulateIncomingMessage(
                    "Avalanche",
                    avalancheSatellite.address,
                    disputeMessage
                )
            ).to.emit(tradeManager, "DisputeInitiated");
            
            // Verify trade status
            const trade = await tradeManager.crossChainTrades(tradeId);
            expect(trade.status).to.equal(3); // Disputed
            
            // Simulate arbitrator resolution
            await arbitratorManager.resolveDispute(
                tradeId,
                buyer.address, // Winner
                "Valid dispute - refund to buyer"
            );
            
            // Verify funds returned to buyer's chain
            const refundEvents = await escrow.queryFilter(
                escrow.filters.CrossChainReleaseInitiated()
            );
            expect(refundEvents[0].args.destinationChainId).to.equal(AVALANCHE_CHAIN_ID);
            expect(refundEvents[0].args.recipient).to.equal(buyer.address);
        });
    });
    
    describe("Error Recovery", function () {
        it("Should retry failed callbacks", async function () {
            // Create a pending callback
            await tradeManager.createTestCallback();
            
            const callbacks = await bridge.getPendingCallbacks();
            const callbackId = callbacks[0].requestId;
            
            // Fast forward time
            await network.provider.send("evm_increaseTime", [600]); // 10 minutes
            await network.provider.send("evm_mine");
            
            // Retry callback
            await expect(
                tradeManager.retryCallback(callbackId)
            ).to.emit(bridge, "MessageSent");
            
            // Verify retry count
            expect(await tradeManager.retryAttempts(callbackId)).to.equal(1);
        });
        
        it("Should handle timeout refunds", async function () {
            // Setup expired trade
            await setupExpiredTrade();
            
            // Anyone can trigger timeout refund
            await expect(
                tradeManager.refundExpiredTrade(tradeId)
            ).to.emit(escrow, "TimeoutRefund");
            
            // Verify funds returned to original chain
            const trade = await tradeManager.crossChainTrades(tradeId);
            expect(trade.status).to.equal(4); // Cancelled/Refunded
        });
    });
});
```

### Monitoring and Analytics Dashboard
```javascript
// scripts/monitor-cross-chain.js
const { ethers } = require("hardhat");
const chalk = require("chalk");

class CrossChainMonitor {
    constructor(contracts) {
        this.contracts = contracts;
        this.stats = {
            totalTrades: 0,
            activeTrades: 0,
            completedTrades: 0,
            disputedTrades: 0,
            volumeByChain: {},
            averageCompletionTime: 0,
            failedCallbacks: 0
        };
    }
    
    async start() {
        console.log(chalk.blue("Starting Cross-Chain Monitor..."));
        
        // Subscribe to events
        this.subscribeToEvents();
        
        // Start periodic checks
        setInterval(() => this.checkHealth(), 30000); // Every 30 seconds
        setInterval(() => this.printStats(), 60000); // Every minute
        
        // Initial stats
        await this.collectStats();
        this.printStats();
    }
    
    subscribeToEvents() {
        // Trade events
        this.contracts.tradeManager.on("CrossChainTradeCreated", async (tradeId, buyerChain, sellerChain) => {
            console.log(chalk.green(`✓ New trade: ${tradeId.slice(0, 8)}... Chain ${buyerChain} -> ${sellerChain}`));
            this.stats.totalTrades++;
            this.stats.activeTrades++;
        });
        
        this.contracts.tradeManager.on("CrossChainTradeCompleted", async (tradeId) => {
            console.log(chalk.green(`✓ Trade completed: ${tradeId.slice(0, 8)}...`));
            this.stats.activeTrades--;
            this.stats.completedTrades++;
        });
        
        // Callback events
        this.contracts.bridge.on("CallbackFailed", async (requestId) => {
            console.log(chalk.red(`✗ Callback failed: ${requestId.slice(0, 8)}...`));
            this.stats.failedCallbacks++;
        });
        
        // Escrow events
        this.contracts.escrow.on("CrossChainDepositReceived", async (depositId, chainId, amount) => {
            const chain = this.getChainName(chainId);
            console.log(chalk.blue(`💰 Deposit from ${chain}: ${ethers.formatUnits(amount, 6)} USDT`));
            
            if (!this.stats.volumeByChain[chain]) {
                this.stats.volumeByChain[chain] = 0;
            }
            this.stats.volumeByChain[chain] += Number(ethers.formatUnits(amount, 6));
        });
    }
    
    async checkHealth() {
        // Check for stuck trades
        const stuckTrades = await this.contracts.tradeManager.getStuckTrades();
        if (stuckTrades.length > 0) {
            console.log(chalk.yellow(`⚠️  ${stuckTrades.length} trades may be stuck`));
            for (const trade of stuckTrades) {
                console.log(chalk.yellow(`   - Trade ${trade.id}: Status ${trade.status}, Age: ${trade.age}s`));
            }
        }
        
        // Check pending callbacks
        const pendingCallbacks = await this.contracts.bridge.getPendingCallbacks();
        const oldCallbacks = pendingCallbacks.filter(
            cb => Date.now() - cb.timestamp > 600000 // 10 minutes
        );
        
        if (oldCallbacks.length > 0) {
            console.log(chalk.yellow(`⚠️  ${oldCallbacks.length} callbacks pending > 10 min`));
        }
        
        // Check gas prices
        await this.checkGasPrices();
    }
    
    async checkGasPrices() {
        const chains = ['Polygon', 'Avalanche', 'Base'];
        console.log(chalk.cyan("Current Gas Prices:"));
        
        for (const chain of chains) {
            const gasPrice = await this.getGasPrice(chain);
            const color = gasPrice > 100 ? chalk.red : gasPrice > 50 ? chalk.yellow : chalk.green;
            console.log(color(`  ${chain}: ${gasPrice} gwei`));
        }
    }
    
    printStats() {
        console.log(chalk.bold.cyan("\n===== Cross-Chain Statistics ====="));
        console.log(chalk.white(`Total Trades: ${this.stats.totalTrades}`));
        console.log(chalk.green(`Active: ${this.stats.activeTrades}`));
        console.log(chalk.blue(`Completed: ${this.stats.completedTrades}`));
        console.log(chalk.red(`Disputed: ${this.stats.disputedTrades}`));
        
        console.log(chalk.bold.cyan("\nVolume by Chain:"));
        for (const [chain, volume] of Object.entries(this.stats.volumeByChain)) {
            console.log(chalk.white(`  ${chain}: $${volume.toFixed(2)}`));
        }
        
        if (this.stats.failedCallbacks > 0) {
            console.log(chalk.red(`\n⚠️  Failed Callbacks: ${this.stats.failedCallbacks}`));
        }
        
        console.log(chalk.cyan("================================\n"));
    }
    
    getChainName(chainId) {
        const chains = {
            137: 'Polygon',
            43114: 'Avalanche',
            8453: 'Base',
            56: 'BSC'
        };
        return chains[chainId] || `Chain ${chainId}`;
    }
}

// Start monitoring
async function main() {
    const contracts = await getDeployedContracts();
    const monitor = new CrossChainMonitor(contracts);
    await monitor.start();
}

main().catch(console.error);
```

## Confidence Score: 9/10

**Rationale**:
- Complete trade flow implementation with all states
- Comprehensive callback system with retries
- Full integration test covering all scenarios
- Dispute resolution implemented
- Monitoring and analytics tools included
- Error recovery mechanisms
- Timeout handling for stuck trades
- Gas optimization strategies
- Production-ready monitoring dashboard

**Remaining Risk Mitigation**:
- Load test with high transaction volume
- Add circuit breakers for anomaly detection
- Implement rate limiting per user

## Post-Implementation Tasks
1. Create operational runbook
2. Set up monitoring dashboard
3. Implement analytics tracking
4. Create user documentation
5. Plan for additional chain support