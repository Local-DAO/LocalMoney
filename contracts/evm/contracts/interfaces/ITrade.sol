// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IEscrow.sol";

/**
 * @title ITrade
 * @notice Interface for the Trade contract (to be implemented in Phase 2)
 * @dev This is a placeholder interface for future implementation
 */
interface ITrade {
    enum TradeState {
        RequestCreated,
        RequestAccepted,
        EscrowFunded,
        FiatDeposited,
        EscrowReleased,
        EscrowCancelled,
        EscrowRefunded,
        EscrowDisputed,
        DisputeResolved
    }

    struct TradeData {
        // Slot 1: Core identifiers (32 bytes)
        uint128 id;              // 16 bytes - enough for trade IDs
        uint128 offerId;         // 16 bytes - enough for offer IDs
        
        // Slot 2: User addresses (40 bytes - fits in 1 slot with padding)
        address buyer;           // 20 bytes
        address seller;          // 20 bytes
        
        // Slot 3: Token and amounts (32 bytes)
        address tokenAddress;    // 20 bytes
        uint96 amount;           // 12 bytes - sufficient for most token amounts
        
        // Slot 4: Fiat amount and rate (32 bytes)
        uint128 fiatAmount;      // 16 bytes - sufficient for fiat amounts
        uint128 rate;            // 16 bytes - sufficient for exchange rates
        
        // Slot 5: Timestamps and state (32 bytes)
        uint32 createdAt;        // 4 bytes - Unix timestamp (good until 2106)
        uint32 expiresAt;        // 4 bytes - Unix timestamp
        uint32 disputeDeadline;  // 4 bytes - Unix timestamp
        address arbitrator;      // 20 bytes
        
        // Slot 6: State and currency (32 bytes)
        TradeState state;        // 1 byte (uint8)
        string fiatCurrency;     // Variable - but typically short (3-4 chars)
        
        // Dynamic data (separate storage slots)
        string buyerContact;
        string sellerContact;
    }

    // Use FeeDistribution from IEscrow
    
    // Gas-optimized fee distribution for internal calculations
    struct OptimizedFeeDistribution {
        uint128 burnAmount;      // 16 bytes
        uint128 chainAmount;     // 16 bytes
        uint128 warchestAmount;  // 16 bytes  
        uint128 arbitratorAmount; // 16 bytes
        // Total: 64 bytes (2 storage slots vs 4 slots)
    }

    // Events
    event TradeCreated(uint256 indexed tradeId, uint256 indexed offerId, address indexed buyer);
    event TradeAccepted(uint256 indexed tradeId, address indexed seller);
    event EscrowFunded(uint256 indexed tradeId, uint256 amount);
    event FiatDeposited(uint256 indexed tradeId, address indexed buyer);
    event EscrowReleased(uint256 indexed tradeId, uint256 amount);
    event TradeDisputed(uint256 indexed tradeId, address indexed disputeInitiator);
    event DisputeResolved(uint256 indexed tradeId, address indexed winner);

    // Placeholder function signatures for Phase 2 implementation
    function createTrade(uint256 _offerId, uint256 _amount, string memory _buyerContact) external returns (uint256);
    function acceptTrade(uint256 _tradeId, string memory _sellerContact) external;
    function fundEscrow(uint256 _tradeId) external payable;
    function markFiatDeposited(uint256 _tradeId) external;
    function releaseEscrow(uint256 _tradeId) external;
    function disputeTrade(uint256 _tradeId, string memory _reason) external;
    function resolveDispute(uint256 _tradeId, address _winner) external;
    
    function getTrade(uint256 _tradeId) external view returns (TradeData memory);
    function calculateFees(uint256 _amount) external view returns (IEscrow.FeeDistribution memory);
}