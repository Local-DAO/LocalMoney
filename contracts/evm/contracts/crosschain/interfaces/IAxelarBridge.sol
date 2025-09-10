// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../MessageTypes.sol";

/**
 * @title IAxelarBridge
 * @notice Interface for the Axelar Bridge contract
 * @dev Defines the external functions for cross-chain messaging
 */
interface IAxelarBridge {
    // Events
    event MessageProcessed(bytes32 indexed messageId, string sourceChain, address sender);
    event ChainRegistered(string chainName, string satelliteAddress);
    event MessageFailed(bytes32 indexed messageId, string reason);
    event MessageSent(bytes32 indexed messageId, string destinationChain, address sender);
    event EmergencyPause(bool isPaused);
    event SatelliteUpdated(string chainName, string oldAddress, string newAddress);
    
    // Chain management functions
    function registerChain(string calldata chainName, string calldata satelliteAddress) external;
    function updateSatellite(string calldata chainName, string calldata newSatelliteAddress) external;
    function unregisterChain(string calldata chainName) external;
    function isChainRegistered(string calldata chainName) external view returns (bool);
    function getSatelliteAddress(string calldata chainName) external view returns (string memory);
    
    // Message sending functions
    function sendMessage(
        string calldata destinationChain,
        MessageTypes.CrossChainMessage calldata message
    ) external payable returns (bytes32 messageId);
    
    function sendMessageWithGas(
        string calldata destinationChain,
        MessageTypes.CrossChainMessage calldata message,
        uint256 gasLimit,
        address refundAddress
    ) external payable returns (bytes32 messageId);
    
    // Message status functions
    function isMessageProcessed(bytes32 messageId) external view returns (bool);
    function getMessageNonce() external view returns (uint256);
    
    // Emergency functions
    function pauseChain(string calldata chainName) external;
    function unpauseChain(string calldata chainName) external;
    function pauseAll() external;
    function unpauseAll() external;
    
    // Configuration functions
    function setHub(address newHub) external;
    function setGasService(address newGasService) external;
    function setMessageExpiry(uint256 newExpiry) external;
    
    // View functions
    function getHub() external view returns (address);
    function getAxelarHandler() external view returns (address);
    function getGasService() external view returns (address);
    function getMessageExpiry() external view returns (uint256);
}