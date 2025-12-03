// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IHub
 * @notice Interface for the Hub contract that manages central configuration and administration
 * @dev Hub contract serves as the central orchestrator for all LocalMoney protocol contracts
 */
interface IHub {
    /**
     * @notice Configuration structure containing all hub settings
     * @dev Used for managing protocol-wide configuration
     */
    struct HubConfig {
        address offerContract;        // Address of the Offer contract
        address tradeContract;        // Address of the Trade contract
        address profileContract;      // Address of the Profile contract
        address priceContract;        // Address of the Price Oracle contract
        address treasury;             // Treasury address for fee collection
        address localMarket;          // Local market address
        address priceProvider;        // Price provider address for oracle updates
        address localTokenAddress;   // LOCAL token contract address for burning
        address chainFeeCollector;   // Chain fee collector address
        address swapRouter;           // Uniswap V3 SwapRouter address
        
        // Fee configuration (basis points - max 10000 = 100%)
        uint16 burnFeePct;           // Fee percentage for token burning
        uint16 chainFeePct;          // Fee percentage for chain operations
        uint16 warchestFeePct;       // Fee percentage for protocol warchest
        uint16 conversionFeePct;     // Fee percentage for conversions
        uint16 arbitratorFeePct;     // Fee percentage for arbitrators
        
        // Trading limits
        uint256 minTradeAmount;      // Minimum trade amount in USD cents
        uint256 maxTradeAmount;      // Maximum trade amount in USD cents
        uint256 maxActiveOffers;     // Maximum active offers per user
        uint256 maxActiveTrades;     // Maximum active trades per user
        
        // Timers (in seconds)
        uint256 tradeExpirationTimer;  // Time before trade expires
        uint256 tradeDisputeTimer;     // Time window for disputes
        
        // Circuit breaker flags
        bool globalPause;            // Global pause flag
        bool pauseNewTrades;         // Pause new trade creation
        bool pauseDeposits;          // Pause escrow deposits
        bool pauseWithdrawals;       // Pause escrow withdrawals
    }

    // Events
    event ConfigUpdated(HubConfig newConfig);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    event ContractRegistered(address indexed contractAddress, string contractType);
    event CircuitBreakerActivated(string reason, address indexed activatedBy);
    event TimelockControllerUpdated(address indexed oldTimelock, address indexed newTimelock);
    event CircuitBreakerDeactivated(address indexed deactivatedBy);
    
    // Phase 4: Enhanced Circuit Breaker Events
    event OperationPaused(bytes32 indexed operation, address indexed pausedBy);
    event OperationUnpaused(bytes32 indexed operation, address indexed unpausedBy);
    event ContractSpecificPause(address indexed contractAddress, bool paused, address indexed pausedBy);
    event EmergencyPauseExtended(uint256 previousTime, uint256 newTime, address indexed extendedBy);
    event UpgradeAuthorized(address indexed newImplementation, address indexed authorizedBy);

    // Custom errors
    error InvalidPlatformFee(uint256 totalFee, uint256 maxAllowed);
    error InvalidTimerParameter(string parameter, uint256 value, uint256 maxValue);
    error Unauthorized(address caller, address expected);
    error ContractAlreadyInitialized();
    error SystemPaused(string pauseType);

    /**
     * @notice Initialize the hub with configuration
     * @param _config Initial hub configuration
     * @param _minDelay Minimum delay for timelock operations
     */
    function initialize(HubConfig memory _config, uint256 _minDelay) external;

    /**
     * @notice Update hub configuration (admin only)
     * @param _config New hub configuration
     */
    function updateConfig(HubConfig memory _config) external;

    /**
     * @notice Update admin address (admin only)
     * @param _newAdmin New admin address
     */
    function updateAdmin(address _newAdmin) external;

    /**
     * @notice Get current hub configuration
     * @return Current hub configuration
     */
    function getConfig() external view returns (HubConfig memory);

    /**
     * @notice Get current admin address
     * @return Current admin address
     */
    function getAdmin() external view returns (address);

    /**
     * @notice Check if system is globally paused
     * @return True if system is paused
     */
    function isPaused() external view returns (bool);

    /**
     * @notice Check if specific functionality is paused
     * @param pauseType Type of pause to check
     * @return True if specified functionality is paused
     */
    function isPausedByType(string memory pauseType) external view returns (bool);

    /**
     * @notice Emergency pause function (admin only)
     * @param reason Reason for the pause
     */
    function emergencyPause(string memory reason) external;

    /**
     * @notice Resume operations (admin only)
     */
    function resume() external;

    /**
     * @notice Check if an upgrade is authorized
     * @param contractAddress Contract being upgraded
     * @param newImplementation New implementation address
     * @return authorized Whether the upgrade is authorized
     */
    function isUpgradeAuthorized(address contractAddress, address newImplementation) external view returns (bool authorized);

    /**
     * @notice Get the timelock controller address
     * @return Timelock controller address
     */
    function getTimelockController() external view returns (address);
}