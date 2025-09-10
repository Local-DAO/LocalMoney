// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarExecutable.sol";

/**
 * @title MockAxelarGateway
 * @notice Simplified mock implementation of Axelar Gateway for testing
 * @dev Only implements the functions needed for testing AxelarBridge
 */
contract MockAxelarGateway {
    mapping(bytes32 => bool) public validCommandIds;
    mapping(bytes32 => bool) public commandExecuted;
    
    event ContractCall(
        address indexed sender,
        string destinationChain,
        string destinationContractAddress,
        bytes32 indexed payloadHash,
        bytes payload
    );
    
    /**
     * @notice Simulate contract call to another chain
     */
    function callContract(
        string calldata destinationChain,
        string calldata contractAddress,
        bytes calldata payload
    ) external {
        emit ContractCall(msg.sender, destinationChain, contractAddress, keccak256(payload), payload);
    }
    
    /**
     * @notice Simulate contract call with token to another chain
     */
    function callContractWithToken(
        string calldata destinationChain,
        string calldata contractAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external {
        // For mock purposes, just emit the regular ContractCall event
        emit ContractCall(msg.sender, destinationChain, contractAddress, keccak256(payload), payload);
    }
    
    /**
     * @notice Helper function to simulate receiving a message
     */
    function callExecute(
        address target,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external {
        // Generate command ID for validation
        bytes32 commandId = keccak256(abi.encodePacked(sourceChain, sourceAddress, target, block.timestamp));
        validCommandIds[commandId] = true;
        
        // Call the execute function
        IAxelarExecutable(target).execute(
            commandId,
            sourceChain,
            sourceAddress,
            payload
        );
    }
    
    /**
     * @notice Validate a contract call
     */
    function validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external returns (bool) {
        if (!validCommandIds[commandId]) return false;
        commandExecuted[commandId] = true;
        return true;
    }
    
    /**
     * @notice Check if command is executed
     */
    function isCommandExecuted(bytes32 commandId) external view returns (bool) {
        return commandExecuted[commandId];
    }
    
    /**
     * @notice Set command as valid (for testing)
     */
    function setCommandValid(bytes32 commandId, bool valid) external {
        validCommandIds[commandId] = valid;
    }
}