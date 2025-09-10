// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MessageTypes
 * @notice Defines cross-chain message formats and types for LocalMoney Protocol
 * @dev Library for handling cross-chain message encoding/decoding
 */
library MessageTypes {
    /**
     * @notice Enum defining all supported cross-chain message types
     */
    enum MessageType {
        CREATE_OFFER,      // Create a new offer on satellite chain
        CREATE_TRADE,      // Create a new trade from satellite chain
        FUND_ESCROW,       // Fund escrow from satellite chain
        RELEASE_FUNDS,     // Release funds to recipient
        DISPUTE_TRADE,     // Initiate dispute resolution
        UPDATE_PROFILE,    // Update user profile across chains
        QUERY_STATUS,      // Query status of offer/trade
        BATCH_OPERATION    // Batch multiple operations
    }
    
    /**
     * @notice Main cross-chain message structure
     * @param messageType The type of message being sent
     * @param sender Original sender address on source chain
     * @param sourceChainId Chain ID of the source chain
     * @param nonce Unique nonce for replay protection
     * @param payload Encoded message-specific data
     */
    struct CrossChainMessage {
        MessageType messageType;
        address sender;
        uint256 sourceChainId;
        uint256 nonce;
        bytes payload;
    }
    
    /**
     * @notice Create offer message payload structure
     */
    struct CreateOfferPayload {
        address token;
        uint256 amount;
        uint256 price;
        bool isBuy;
        string fiatCurrency;
        uint256 minAmount;
        uint256 maxAmount;
    }
    
    /**
     * @notice Create trade message payload structure
     */
    struct CreateTradePayload {
        bytes32 offerId;
        uint256 amount;
        address trader;
        bytes encryptedDetails;
    }
    
    /**
     * @notice Fund escrow message payload structure
     */
    struct FundEscrowPayload {
        bytes32 tradeId;
        uint256 amount;
        address token;
        uint256 deadline;
    }
    
    /**
     * @notice Release funds message payload structure
     */
    struct ReleaseFundsPayload {
        bytes32 tradeId;
        address recipient;
        uint256 amount;
        bool isDispute;
    }
    
    /**
     * @notice Validates message format and data
     * @param message The cross-chain message to validate
     * @return bool Whether the message is valid
     */
    function validateMessage(CrossChainMessage memory message) internal pure returns (bool) {
        // Check basic validations
        if (message.sender == address(0)) return false;
        if (message.sourceChainId == 0) return false;
        if (message.payload.length == 0) return false;
        
        // Validate message type specific requirements
        if (uint8(message.messageType) > uint8(MessageType.BATCH_OPERATION)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @notice Encodes a cross-chain message for transmission
     * @param message The message to encode
     * @return bytes Encoded message data
     */
    function encodeMessage(CrossChainMessage memory message) internal pure returns (bytes memory) {
        return abi.encode(
            message.messageType,
            message.sender,
            message.sourceChainId,
            message.nonce,
            message.payload
        );
    }
    
    /**
     * @notice Decodes received message data
     * @param data The encoded message data
     * @return CrossChainMessage The decoded message
     */
    function decodeMessage(bytes memory data) internal pure returns (CrossChainMessage memory) {
        (
            MessageType messageType,
            address sender,
            uint256 sourceChainId,
            uint256 nonce,
            bytes memory payload
        ) = abi.decode(data, (MessageType, address, uint256, uint256, bytes));
        
        return CrossChainMessage({
            messageType: messageType,
            sender: sender,
            sourceChainId: sourceChainId,
            nonce: nonce,
            payload: payload
        });
    }
    
    /**
     * @notice Generates a unique message ID for tracking
     * @param message The message to generate ID for
     * @param sourceChain The source chain name
     * @return bytes32 Unique message identifier
     */
    function getMessageId(
        CrossChainMessage memory message,
        string memory sourceChain
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            sourceChain,
            message.sender,
            message.sourceChainId,
            message.nonce,
            message.messageType
        ));
    }
}