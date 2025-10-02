// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IArbitratorManager
 * @notice Interface for managing arbitrators and dispute resolution assignments
 * @dev Handles arbitrator registration, selection, and reputation management
 * @author LocalMoney Protocol Team
 */
interface IArbitratorManager {
    // Structs
    struct ArbitratorInfo {
        bool isActive;
        string[] supportedFiats;
        string encryptionKey;
        uint256 disputesHandled;
        uint256 disputesWon;
        uint256 reputationScore; // Out of 10000
        uint256 joinedAt;
    }

    struct VRFRequest {
        uint256 tradeId;
        string fiatCurrency;
        uint256 requestedAt;
        bool fulfilled;
    }

    // Events
    event ArbitratorRegistered(address indexed arbitrator, string[] supportedCurrencies);
    event ArbitratorRemoved(address indexed arbitrator, string currency);
    event ArbitratorDeactivated(address indexed arbitrator);
    event ArbitratorReputationUpdated(address indexed arbitrator, uint256 newScore);
    event ArbitratorAssigned(uint256 indexed tradeId, address indexed arbitrator);
    
    // VRF Events
    event VRFConfigUpdated(uint64 subscriptionId, bytes32 keyHash, uint32 callbackGasLimit);
    event VRFRandomnessRequested(uint256 indexed requestId, uint256 indexed tradeId, string fiatCurrency);
    event VRFRandomnessFulfilled(uint256 indexed requestId, uint256 indexed tradeId, address selectedArbitrator);

    // Custom errors
    error ArbitratorNotFound(address arbitrator);
    error ArbitratorAlreadyRegistered(address arbitrator);
    error UnsupportedCurrency(address arbitrator, string currency);
    error NoArbitratorsAvailable(string currency);
    error UnauthorizedAccess(address caller);
    error VRFNotConfigured();
    error VRFRequestNotFound(uint256 requestId);
    error VRFRequestAlreadyFulfilled(uint256 requestId);
    error VRFCoordinatorOnly(address caller);

    /**
     * @notice Register as an arbitrator for specific fiat currencies
     * @param supportedCurrencies Array of supported fiat currency codes
     * @param encryptionKey Public encryption key for secure communication
     */
    function registerArbitrator(
        string[] memory supportedCurrencies,
        string memory encryptionKey
    ) external;

    /**
     * @notice Remove arbitrator from a specific currency
     * @param arbitrator Arbitrator address
     * @param currency Currency to remove support for
     */
    function removeArbitratorFromCurrency(
        address arbitrator,
        string memory currency
    ) external;

    /**
     * @notice Deactivate an arbitrator (admin only)
     * @param arbitrator Arbitrator address
     */
    function deactivateArbitrator(address arbitrator) external;

    /**
     * @notice Get arbitrator information
     * @param arbitrator Arbitrator address
     * @return ArbitratorInfo struct
     */
    function getArbitratorInfo(address arbitrator) 
        external 
        view 
        returns (ArbitratorInfo memory);

    /**
     * @notice Get all arbitrators for a currency
     * @param currency Currency code
     * @return Array of arbitrator addresses
     */
    function getArbitratorsForCurrency(string memory currency) 
        external 
        view 
        returns (address[] memory);

    /**
     * @notice Assign an arbitrator to a dispute
     * @param tradeId Trade ID
     * @param fiatCurrency Fiat currency for the trade
     * @return assignedArbitrator Address of assigned arbitrator
     */
    function assignArbitrator(
        uint256 tradeId,
        string memory fiatCurrency
    ) external returns (address assignedArbitrator);

    /**
     * @notice Update arbitrator reputation after dispute resolution
     * @param arbitrator Arbitrator address
     * @param won Whether the arbitrator made a successful decision
     */
    function updateArbitratorReputation(address arbitrator, bool won) external;

    /**
     * @notice Check if an address is a registered and active arbitrator
     * @param arbitrator Address to check
     * @return isActive Whether the address is an active arbitrator
     */
    function isActiveArbitrator(address arbitrator) external view returns (bool isActive);

    /**
     * @notice Check if arbitrator supports a specific currency
     * @param arbitrator Arbitrator address
     * @param currency Currency code
     * @return supported Whether the arbitrator supports the currency
     */
    function arbitratorSupportsCurrency(
        address arbitrator,
        string memory currency
    ) external view returns (bool supported);

    /**
     * @notice Configure Chainlink VRF settings (admin only)
     * @param vrfCoordinator VRF Coordinator contract address
     * @param subscriptionId VRF subscription ID
     * @param keyHash Key hash for VRF requests
     * @param callbackGasLimit Gas limit for VRF callback
     * @param requestConfirmations Number of confirmations for VRF request
     */
    function configureVRF(
        address vrfCoordinator,
        uint64 subscriptionId,
        bytes32 keyHash,
        uint32 callbackGasLimit,
        uint16 requestConfirmations
    ) external;

    /**
     * @notice Update VRF subscription ID (admin only)
     * @param subscriptionId New subscription ID
     */
    function updateVRFSubscription(uint64 subscriptionId) external;


    /**
     * @notice Get the total number of active arbitrators
     * @return count Number of active arbitrators
     */
    function getActiveArbitratorCount() external view returns (uint256 count);

    /**
     * @notice Get the total number of active arbitrators for a currency
     * @param currency Currency code
     * @return count Number of active arbitrators for the currency
     */
    function getActiveArbitratorCountForCurrency(string memory currency) 
        external 
        view 
        returns (uint256 count);
}