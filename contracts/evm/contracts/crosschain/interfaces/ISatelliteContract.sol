// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../MessageTypes.sol";

/**
 * @title ISatelliteContract
 * @notice Interface for satellite contracts deployed on non-BSC chains
 * @dev Defines the standard interface for LocalMoney satellite contracts
 */
interface ISatelliteContract {
    // Events
    event MessageSentToHub(bytes32 indexed messageId, MessageTypes.MessageType messageType);
    event MessageReceivedFromHub(bytes32 indexed messageId, MessageTypes.MessageType messageType);
    event OfferCreated(bytes32 indexed offerId, address indexed creator, uint256 amount);
    event TradeInitiated(bytes32 indexed tradeId, bytes32 indexed offerId, address trader);
    event FundsDeposited(bytes32 indexed tradeId, uint256 amount);
    event FundsReleased(bytes32 indexed tradeId, address recipient, uint256 amount);
    event DisputeRaised(bytes32 indexed tradeId, address disputer);
    
    // Core satellite functions
    function initialize(
        address _bridgeAddress,
        string calldata _hubChain,
        string calldata _hubAddress
    ) external;
    
    // Offer management
    function createOffer(
        address token,
        uint256 amount,
        uint256 price,
        bool isBuy,
        string calldata fiatCurrency,
        uint256 minAmount,
        uint256 maxAmount
    ) external returns (bytes32 offerId);
    
    function cancelOffer(bytes32 offerId) external;
    function updateOffer(bytes32 offerId, uint256 newAmount, uint256 newPrice) external;
    
    // Trade management
    function initiateTrade(
        bytes32 offerId,
        uint256 amount,
        bytes calldata encryptedDetails
    ) external returns (bytes32 tradeId);
    
    function fundTrade(bytes32 tradeId) external payable;
    function releaseFunds(bytes32 tradeId) external;
    function disputeTrade(bytes32 tradeId, string calldata reason) external;
    
    // Cross-chain message handling
    function processMessageFromHub(
        MessageTypes.CrossChainMessage calldata message
    ) external returns (bool success);
    
    function sendMessageToHub(
        MessageTypes.CrossChainMessage calldata message
    ) external payable returns (bytes32 messageId);
    
    // View functions
    function getOffer(bytes32 offerId) external view returns (
        address creator,
        address token,
        uint256 amount,
        uint256 price,
        bool isBuy,
        string memory fiatCurrency,
        bool isActive
    );
    
    function getTrade(bytes32 tradeId) external view returns (
        bytes32 offerId,
        address buyer,
        address seller,
        uint256 amount,
        uint8 status,
        uint256 createdAt
    );
    
    function getUserOffers(address user) external view returns (bytes32[] memory);
    function getUserTrades(address user) external view returns (bytes32[] memory);
    
    // Configuration
    function setBridge(address newBridge) external;
    function setHubChain(string calldata newHubChain) external;
    function setHubAddress(string calldata newHubAddress) external;
    
    // Emergency functions
    function pause() external;
    function unpause() external;
    function emergencyWithdraw(address token, uint256 amount, address recipient) external;
    
    // State getters
    function bridge() external view returns (address);
    function hubChain() external view returns (string memory);
    function hubAddress() external view returns (string memory);
    function isPaused() external view returns (bool);
    function messageNonce() external view returns (uint256);
}