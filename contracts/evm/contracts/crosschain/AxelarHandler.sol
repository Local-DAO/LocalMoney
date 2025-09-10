// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@axelar-network/axelar-gmp-sdk-solidity/contracts/executable/AxelarExecutable.sol";
import "./interfaces/IAxelarBridge.sol";

/**
 * @title AxelarHandler
 * @notice Non-upgradeable handler for Axelar messages that forwards to upgradeable AxelarBridge
 * @dev This contract inherits from AxelarExecutable and acts as a stable entry point
 */
contract AxelarHandler is AxelarExecutable {
    // State variables
    address public axelarBridge;
    address public immutable deployer;
    
    // Events
    event BridgeUpdated(address indexed oldBridge, address indexed newBridge);
    event MessageReceived(bytes32 indexed commandId, string sourceChain, string sourceAddress);
    event MessageForwarded(bytes32 indexed commandId, bool success);
    
    // Errors
    error OnlyBridge();
    error OnlyDeployer();
    error InvalidBridge();
    error ForwardingFailed();
    
    /**
     * @notice Constructor sets the Axelar gateway and deployer
     * @param _gateway Address of the Axelar gateway
     */
    constructor(address _gateway) AxelarExecutable(_gateway) {
        deployer = msg.sender;
    }
    
    /**
     * @notice Set the AxelarBridge contract address
     * @param _axelarBridge Address of the upgradeable AxelarBridge contract
     * @dev Can only be called by deployer
     */
    function setBridge(address _axelarBridge) external {
        if (msg.sender != deployer) revert OnlyDeployer();
        if (_axelarBridge == address(0)) revert InvalidBridge();
        
        address oldBridge = axelarBridge;
        axelarBridge = _axelarBridge;
        
        emit BridgeUpdated(oldBridge, _axelarBridge);
    }
    
    /**
     * @notice Process incoming message from Axelar
     * @dev Called by Axelar gateway after validation
     * @param commandId The unique identifier of the command
     * @param sourceChain Name of the source chain
     * @param sourceAddress Address on the source chain
     * @param payload The message payload
     */
    function _execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        emit MessageReceived(commandId, sourceChain, sourceAddress);
        
        // Forward to the upgradeable AxelarBridge
        if (axelarBridge == address(0)) revert InvalidBridge();
        
        // Use low-level call to forward the message
        (bool success, bytes memory returnData) = axelarBridge.call(
            abi.encodeWithSignature(
                "handleAxelarMessage(bytes32,string,string,bytes)",
                commandId,
                sourceChain,
                sourceAddress,
                payload
            )
        );
        
        if (!success) {
            // If returnData has a revert reason, bubble it up
            if (returnData.length > 0) {
                assembly {
                    revert(add(32, returnData), mload(returnData))
                }
            }
            revert ForwardingFailed();
        }
        
        emit MessageForwarded(commandId, success);
    }
    
    /**
     * @notice Send a cross-chain message via Axelar
     * @param destinationChain Name of the destination chain
     * @param destinationAddress Address on the destination chain
     * @param payload Message payload to send
     * @dev Can only be called by the AxelarBridge
     */
    function sendMessage(
        string calldata destinationChain,
        string calldata destinationAddress,
        bytes calldata payload
    ) external {
        if (msg.sender != axelarBridge) revert OnlyBridge();
        
        gateway().callContract(destinationChain, destinationAddress, payload);
    }
    
    /**
     * @notice Get the gateway address
     * @return Address of the Axelar gateway
     */
    function getGateway() external view returns (address) {
        return address(gateway());
    }
}