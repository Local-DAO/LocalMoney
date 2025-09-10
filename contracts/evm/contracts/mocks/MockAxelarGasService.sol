// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockAxelarGasService
 * @notice Simplified mock implementation of Axelar Gas Service for testing
 * @dev Only implements the functions we need for testing
 */
contract MockAxelarGasService {
    mapping(bytes32 => uint256) public gasPaid;
    mapping(bytes32 => address) public gasRefundAddress;
    
    event GasPaid(
        bytes32 indexed txHash,
        uint256 value,
        address refundAddress
    );
    
    function payNativeGasForContractCall(
        address sender,
        string calldata destinationChain,
        string calldata destinationAddress,
        bytes calldata payload,
        address refundAddress
    ) external payable {
        bytes32 txHash = keccak256(abi.encodePacked(
            sender,
            destinationChain,
            destinationAddress,
            payload,
            block.timestamp
        ));
        
        gasPaid[txHash] = msg.value;
        gasRefundAddress[txHash] = refundAddress;
        
        emit GasPaid(txHash, msg.value, refundAddress);
    }
    
    // Additional helper functions for testing
    function getGasPaid(bytes32 txHash) external view returns (uint256) {
        return gasPaid[txHash];
    }
    
    function getRefundAddress(bytes32 txHash) external view returns (address) {
        return gasRefundAddress[txHash];
    }
}