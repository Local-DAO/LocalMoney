// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITimelockController
 * @notice Interface for timelock controller functionality
 * @dev Used for delayed execution of admin operations
 * @author LocalMoney Protocol Team
 */
interface ITimelockController {
    enum OperationState {
        Unset,
        Pending,
        Ready,
        Done
    }

    event OperationScheduled(
        bytes32 indexed id,
        uint256 indexed index,
        address target,
        uint256 value,
        bytes data,
        bytes32 predecessor,
        uint256 delay
    );

    event OperationExecuted(bytes32 indexed id, uint256 indexed index);
    event OperationCancelled(bytes32 indexed id);
    event MinDelayUpdated(uint256 oldDelay, uint256 newDelay);

    /**
     * @notice Schedule an operation with a delay
     * @param target Target contract address
     * @param value ETH value to send
     * @param data Call data
     * @param predecessor Predecessor operation ID (0 for none)
     * @param salt Salt for operation ID generation
     * @param delay Delay before execution
     * @return id Operation ID
     */
    function schedule(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) external returns (bytes32 id);

    /**
     * @notice Execute a scheduled operation
     * @param target Target contract address
     * @param value ETH value to send
     * @param data Call data
     * @param predecessor Predecessor operation ID
     * @param salt Salt for operation ID generation
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt
    ) external payable;

    /**
     * @notice Cancel a scheduled operation
     * @param id Operation ID to cancel
     */
    function cancel(bytes32 id) external;

    /**
     * @notice Check if an operation is pending
     * @param id Operation ID
     * @return pending Whether operation is pending
     */
    function isOperationPending(bytes32 id) external view returns (bool pending);

    /**
     * @notice Check if an operation is ready
     * @param id Operation ID
     * @return ready Whether operation is ready for execution
     */
    function isOperationReady(bytes32 id) external view returns (bool ready);

    /**
     * @notice Check if an operation is done
     * @param id Operation ID
     * @return done Whether operation has been executed
     */
    function isOperationDone(bytes32 id) external view returns (bool done);

    /**
     * @notice Get the timestamp when an operation becomes ready
     * @param id Operation ID
     * @return timestamp Ready timestamp
     */
    function getTimestamp(bytes32 id) external view returns (uint256 timestamp);

    /**
     * @notice Get the minimum delay
     * @return delay Minimum delay in seconds
     */
    function getMinDelay() external view returns (uint256 delay);

    /**
     * @notice Update the minimum delay
     * @param newDelay New minimum delay in seconds
     */
    function updateDelay(uint256 newDelay) external;
}