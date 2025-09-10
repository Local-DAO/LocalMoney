// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./MessageTypes.sol";
import "./interfaces/IAxelarBridge.sol";
import "../interfaces/IHub.sol";

/**
 * @title AxelarBridge
 * @notice Upgradeable bridge contract for cross-chain messaging via Axelar Network
 * @dev Works with AxelarHandler through composition pattern
 */
contract AxelarBridge is 
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    IAxelarBridge
{
    using MessageTypes for *;
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant HANDLER_ROLE = keccak256("HANDLER_ROLE");
    
    // State variables
    IHub public hub;
    address public gasService;
    address public axelarHandler; // The non-upgradeable AxelarHandler contract
    
    mapping(bytes32 => bool) public processedMessages;
    mapping(string => bool) public registeredChains;
    mapping(string => string) public satelliteAddresses;
    mapping(string => bool) public chainPaused;
    
    uint256 public messageNonce;
    uint256 public constant MESSAGE_EXPIRY = 1 hours;
    uint256 public messageExpiry;
    
    // Failed message storage for recovery
    mapping(bytes32 => MessageTypes.CrossChainMessage) public failedMessages;
    mapping(bytes32 => string) public failedMessageReasons;
    
    // Storage gap for upgrades
    uint256[43] private __gap;
    
    /**
     * @notice Initialize the bridge contract
     * @param _hub Address of the Hub contract
     * @param _gasService Address of Axelar gas service
     * @param _axelarHandler Address of the AxelarHandler contract
     */
    function initialize(
        address _hub,
        address _gasService,
        address _axelarHandler
    ) external initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        __Pausable_init();
        
        require(_hub != address(0), "Invalid hub");
        require(_gasService != address(0), "Invalid gas service");
        require(_axelarHandler != address(0), "Invalid handler");
        
        hub = IHub(_hub);
        gasService = _gasService;
        axelarHandler = _axelarHandler;
        messageExpiry = MESSAGE_EXPIRY;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        _grantRole(HANDLER_ROLE, _axelarHandler);
    }
    
    /**
     * @notice Handle incoming message from AxelarHandler
     * @dev Called by AxelarHandler when a message is received from Axelar
     * @param commandId The identifier of the command
     * @param sourceChain Name of the source chain
     * @param sourceAddress Address of the source contract
     * @param payload Encoded message data
     */
    function handleAxelarMessage(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external whenNotPaused nonReentrant onlyRole(HANDLER_ROLE) {
        // Verify source
        require(registeredChains[sourceChain], "Unregistered chain");
        require(!chainPaused[sourceChain], "Chain paused");
        require(
            keccak256(bytes(satelliteAddresses[sourceChain])) == 
            keccak256(bytes(sourceAddress)),
            "Unknown satellite"
        );
        
        // Decode and validate message
        MessageTypes.CrossChainMessage memory message = MessageTypes.decodeMessage(payload);
        require(MessageTypes.validateMessage(message), "Invalid message");
        
        bytes32 messageId = MessageTypes.getMessageId(message, sourceChain);
        
        // Prevent replay
        require(!processedMessages[messageId], "Already processed");
        processedMessages[messageId] = true;
        
        // Process based on message type
        try this.routeMessage(message, sourceChain) {
            emit MessageProcessed(messageId, sourceChain, message.sender);
        } catch Error(string memory reason) {
            // Store failed message for recovery
            failedMessages[messageId] = message;
            failedMessageReasons[messageId] = reason;
            emit MessageFailed(messageId, reason);
        } catch {
            // Store failed message for recovery
            failedMessages[messageId] = message;
            failedMessageReasons[messageId] = "Unknown error";
            emit MessageFailed(messageId, "Unknown error");
        }
    }
    
    /**
     * @notice Route message to appropriate handler
     * @param message The cross-chain message to process
     * @param sourceChain Name of the source chain
     */
    function routeMessage(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) external {
        // Only callable internally or by this contract
        require(msg.sender == address(this), "Internal only");
        
        if (message.messageType == MessageTypes.MessageType.CREATE_OFFER) {
            _handleCreateOffer(message, sourceChain);
        } else if (message.messageType == MessageTypes.MessageType.CREATE_TRADE) {
            _handleCreateTrade(message, sourceChain);
        } else if (message.messageType == MessageTypes.MessageType.FUND_ESCROW) {
            _handleFundEscrow(message, sourceChain);
        } else if (message.messageType == MessageTypes.MessageType.RELEASE_FUNDS) {
            _handleReleaseFunds(message, sourceChain);
        } else if (message.messageType == MessageTypes.MessageType.DISPUTE_TRADE) {
            _handleDisputeTrade(message, sourceChain);
        } else if (message.messageType == MessageTypes.MessageType.UPDATE_PROFILE) {
            _handleUpdateProfile(message, sourceChain);
        } else if (message.messageType == MessageTypes.MessageType.QUERY_STATUS) {
            _handleQueryStatus(message, sourceChain);
        } else if (message.messageType == MessageTypes.MessageType.BATCH_OPERATION) {
            _handleBatchOperation(message, sourceChain);
        } else {
            revert("Unknown message type");
        }
    }
    
    /**
     * @notice Send message to satellite chain
     * @param destinationChain Name of the destination chain
     * @param message Message to send
     * @return messageId Unique identifier for the sent message
     */
    function sendMessage(
        string calldata destinationChain,
        MessageTypes.CrossChainMessage calldata message
    ) external payable override whenNotPaused nonReentrant returns (bytes32 messageId) {
        require(registeredChains[destinationChain], "Unregistered chain");
        require(!chainPaused[destinationChain], "Chain paused");
        
        // Generate message ID
        messageId = MessageTypes.getMessageId(message, "BSC");
        
        // Encode message
        bytes memory payload = MessageTypes.encodeMessage(message);
        
        // Send via AxelarHandler
        (bool success, ) = axelarHandler.call(
            abi.encodeWithSignature(
                "sendMessage(string,string,bytes)",
                destinationChain,
                satelliteAddresses[destinationChain],
                payload
            )
        );
        require(success, "Failed to send message");
        
        emit MessageSent(messageId, destinationChain, msg.sender);
    }
    
    /**
     * @notice Send message with gas payment
     * @param destinationChain Name of the destination chain
     * @param message Message to send
     * @param gasLimit Gas limit for execution on destination
     * @param refundAddress Address to refund excess gas payment
     * @return messageId Unique identifier for the sent message
     */
    function sendMessageWithGas(
        string calldata destinationChain,
        MessageTypes.CrossChainMessage calldata message,
        uint256 gasLimit,
        address refundAddress
    ) external payable override whenNotPaused nonReentrant returns (bytes32 messageId) {
        require(registeredChains[destinationChain], "Unregistered chain");
        require(!chainPaused[destinationChain], "Chain paused");
        require(msg.value > 0, "Gas payment required");
        
        // Generate message ID
        messageId = MessageTypes.getMessageId(message, "BSC");
        
        // Encode message
        bytes memory payload = MessageTypes.encodeMessage(message);
        
        // Pay for gas using low-level call to gas service
        (bool success, ) = gasService.call{value: msg.value}(
            abi.encodeWithSignature(
                "payNativeGasForContractCall(address,string,string,bytes,address)",
                axelarHandler,
                destinationChain,
                satelliteAddresses[destinationChain],
                payload,
                refundAddress
            )
        );
        require(success, "Gas payment failed");
        
        // Send via AxelarHandler
        (success, ) = axelarHandler.call(
            abi.encodeWithSignature(
                "sendMessage(string,string,bytes)",
                destinationChain,
                satelliteAddresses[destinationChain],
                payload
            )
        );
        require(success, "Failed to send message");
        
        emit MessageSent(messageId, destinationChain, msg.sender);
    }
    
    // Message handlers
    function _handleCreateOffer(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) internal {
        MessageTypes.CreateOfferPayload memory payload = abi.decode(
            message.payload,
            (MessageTypes.CreateOfferPayload)
        );
        
        // Forward to hub for processing
        // Implementation depends on Hub interface
    }
    
    function _handleCreateTrade(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) internal {
        MessageTypes.CreateTradePayload memory payload = abi.decode(
            message.payload,
            (MessageTypes.CreateTradePayload)
        );
        
        // Forward to hub for processing
        // Implementation depends on Hub interface
    }
    
    function _handleFundEscrow(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) internal {
        MessageTypes.FundEscrowPayload memory payload = abi.decode(
            message.payload,
            (MessageTypes.FundEscrowPayload)
        );
        
        // Forward to hub for processing
        // Implementation depends on Hub interface
    }
    
    function _handleReleaseFunds(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) internal {
        MessageTypes.ReleaseFundsPayload memory payload = abi.decode(
            message.payload,
            (MessageTypes.ReleaseFundsPayload)
        );
        
        // Forward to hub for processing
        // Implementation depends on Hub interface
    }
    
    function _handleDisputeTrade(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) internal {
        // Implementation for dispute handling
        // Forward to hub for processing
    }
    
    function _handleUpdateProfile(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) internal {
        // Implementation for profile updates
        // Forward to hub for processing
    }
    
    function _handleQueryStatus(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) internal {
        // Implementation for status queries
        // Query hub and send response back
    }
    
    function _handleBatchOperation(
        MessageTypes.CrossChainMessage memory message,
        string memory sourceChain
    ) internal {
        // Implementation for batch operations
        // Process multiple operations in sequence
    }
    
    // Chain management functions
    function registerChain(
        string calldata chainName,
        string calldata satelliteAddress
    ) external override onlyRole(ADMIN_ROLE) {
        require(!registeredChains[chainName], "Chain already registered");
        require(bytes(satelliteAddress).length > 0, "Invalid satellite address");
        
        registeredChains[chainName] = true;
        satelliteAddresses[chainName] = satelliteAddress;
        
        emit ChainRegistered(chainName, satelliteAddress);
    }
    
    function updateSatellite(
        string calldata chainName,
        string calldata newSatelliteAddress
    ) external override onlyRole(ADMIN_ROLE) {
        require(registeredChains[chainName], "Chain not registered");
        require(bytes(newSatelliteAddress).length > 0, "Invalid satellite address");
        
        string memory oldAddress = satelliteAddresses[chainName];
        satelliteAddresses[chainName] = newSatelliteAddress;
        
        emit SatelliteUpdated(chainName, oldAddress, newSatelliteAddress);
    }
    
    function unregisterChain(
        string calldata chainName
    ) external override onlyRole(ADMIN_ROLE) {
        require(registeredChains[chainName], "Chain not registered");
        
        delete registeredChains[chainName];
        delete satelliteAddresses[chainName];
        delete chainPaused[chainName];
    }
    
    // Emergency functions
    function pauseChain(string calldata chainName) external override onlyRole(EMERGENCY_ROLE) {
        require(registeredChains[chainName], "Chain not registered");
        chainPaused[chainName] = true;
        emit EmergencyPause(true);
    }
    
    function unpauseChain(string calldata chainName) external override onlyRole(EMERGENCY_ROLE) {
        require(registeredChains[chainName], "Chain not registered");
        chainPaused[chainName] = false;
        emit EmergencyPause(false);
    }
    
    function pauseAll() external override onlyRole(EMERGENCY_ROLE) {
        _pause();
    }
    
    function unpauseAll() external override onlyRole(EMERGENCY_ROLE) {
        _unpause();
    }
    
    // Configuration functions
    function setHub(address newHub) external override onlyRole(ADMIN_ROLE) {
        require(newHub != address(0), "Invalid hub");
        hub = IHub(newHub);
    }
    
    function setGasService(address newGasService) external override onlyRole(ADMIN_ROLE) {
        require(newGasService != address(0), "Invalid gas service");
        gasService = newGasService;
    }
    
    function setMessageExpiry(uint256 newExpiry) external override onlyRole(ADMIN_ROLE) {
        require(newExpiry >= 30 minutes && newExpiry <= 24 hours, "Invalid expiry");
        messageExpiry = newExpiry;
    }
    
    function setAxelarHandler(address newHandler) external onlyRole(ADMIN_ROLE) {
        require(newHandler != address(0), "Invalid handler");
        
        // Revoke role from old handler
        if (axelarHandler != address(0)) {
            _revokeRole(HANDLER_ROLE, axelarHandler);
        }
        
        // Set new handler and grant role
        axelarHandler = newHandler;
        _grantRole(HANDLER_ROLE, newHandler);
    }
    
    // Recovery functions
    function retryFailedMessage(bytes32 messageId, string calldata sourceChain) external onlyRole(ADMIN_ROLE) {
        MessageTypes.CrossChainMessage memory message = failedMessages[messageId];
        require(message.sender != address(0), "Message not found");
        
        // Clear failed status
        delete failedMessages[messageId];
        delete failedMessageReasons[messageId];
        
        // Retry processing
        this.routeMessage(message, sourceChain);
    }
    
    // View functions
    function isChainRegistered(string calldata chainName) external view override returns (bool) {
        return registeredChains[chainName];
    }
    
    function getSatelliteAddress(string calldata chainName) external view override returns (string memory) {
        return satelliteAddresses[chainName];
    }
    
    function isMessageProcessed(bytes32 messageId) external view override returns (bool) {
        return processedMessages[messageId];
    }
    
    function getMessageNonce() external view override returns (uint256) {
        return messageNonce;
    }
    
    function getHub() external view returns (address) {
        return address(hub);
    }
    
    function getAxelarHandler() external view returns (address) {
        return axelarHandler;
    }
    
    function getGasService() external view returns (address) {
        return gasService;
    }
    
    function getMessageExpiry() external view returns (uint256) {
        return messageExpiry;
    }
    
    /**
     * @notice Authorize contract upgrade
     * @param newImplementation Address of new implementation
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(ADMIN_ROLE) 
    {}
}