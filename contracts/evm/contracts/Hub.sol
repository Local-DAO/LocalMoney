// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "./interfaces/IHub.sol";

/**
 * @title Hub
 * @notice Central orchestrator contract for the LocalMoney protocol
 * @dev Manages configuration, access control, and circuit breakers for all protocol contracts
 * 
 * SECURITY FIX AUTH-002: STRICT TIMELOCK ENFORCEMENT IMPLEMENTED
 * The contract now enforces strict timelock requirements for all upgrades:
 * 1. ONLY the timelock controller can authorize contract upgrades
 * 2. Admin role has been REMOVED from the upgrade authorization function
 * 3. No bypass mechanism exists - timelock enforcement is mandatory
 * 
 * DEPLOYMENT REQUIREMENTS:
 * - Timelock controller MUST be deployed and configured before upgrades
 * - Recommended minimum delay: 48 hours for production
 * - Consider multi-sig as timelock proposer/executor for additional security
 * 
 * @dev This implementation addresses the AUTH-002 high severity finding
 *      Upgrades now strictly require: msg.sender == address(timelockController)
 * @author LocalMoney Protocol Team
 */
contract Hub is 
    Initializable, 
    UUPSUpgradeable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable,
    IHub 
{
    // Access control roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // Constants
    uint256 public constant MAX_PLATFORM_FEE = 1000; // 10% in basis points
    uint256 public constant MAX_TRADE_EXPIRATION_TIMER = 7 days;
    uint256 public constant MAX_TRADE_DISPUTE_TIMER = 7 days;
    uint256 public constant MIN_TIMER_VALUE = 1 hours;
    
    // SECURITY FIX: Maximum fee limits for individual fee types
    uint16 public constant MAX_BURN_FEE = 500;      // 5% max
    uint16 public constant MAX_CHAIN_FEE = 300;     // 3% max  
    uint16 public constant MAX_WARCHEST_FEE = 300;  // 3% max
    uint16 public constant MAX_CONVERSION_FEE = 500; // 5% max
    uint16 public constant MAX_ARBITRATOR_FEE = 200; // 2% max
    uint16 public constant MAX_TOTAL_FEE = 1000;     // 10% max total
    
    // Phase 4: Operation Constants for Circuit Breaker
    bytes32 public constant OP_CREATE_OFFER = keccak256("CREATE_OFFER");
    bytes32 public constant OP_CREATE_TRADE = keccak256("CREATE_TRADE");
    bytes32 public constant OP_ACCEPT_TRADE = keccak256("ACCEPT_TRADE");
    bytes32 public constant OP_FUND_ESCROW = keccak256("FUND_ESCROW");
    bytes32 public constant OP_RELEASE_ESCROW = keccak256("RELEASE_ESCROW");
    bytes32 public constant OP_DISPUTE_TRADE = keccak256("DISPUTE_TRADE");
    bytes32 public constant OP_ARBITRATOR_REGISTRATION = keccak256("ARBITRATOR_REGISTRATION");
    bytes32 public constant OP_PRICE_UPDATE = keccak256("PRICE_UPDATE");

    // State variables
    HubConfig private _config;
    bool private _initialized;
    address private _admin;
    TimelockController public timelockController;
    
    // Phase 4: Enhanced Circuit Breaker Storage
    mapping(bytes32 => bool) public operationPaused;
    mapping(address => bool) public contractPaused; // Individual contract pausing
    uint256 public lastEmergencyPauseTime;
    string public lastPauseReason;

    // Storage gap for future upgrades (reduced to accommodate new storage)
    uint256[45] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Modifier to check if system is not paused
     */
    modifier whenNotPaused() {
        if (_config.globalPause) {
            revert SystemPaused("global");
        }
        _;
    }

    /**
     * @notice Modifier to check specific pause type
     * @param pauseType Type of pause to check
     */
    modifier whenNotPausedByType(string memory pauseType) {
        if (isPausedByType(pauseType)) {
            revert SystemPaused(pauseType);
        }
        _;
    }

    /**
     * @notice Initialize the Hub contract
     * @param _initialConfig Initial configuration for the Hub
     * @param _minDelay Minimum delay for timelock operations (e.g., 2 days = 172800)
     * @dev Can only be called once during deployment
     */
    function initialize(
        HubConfig memory _initialConfig,
        uint256 _minDelay
    ) 
        external 
        initializer 
    {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        
        // Set admin
        _admin = msg.sender;

        // Deploy and configure TimelockController
        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        proposers[0] = msg.sender;
        executors[0] = msg.sender;
        
        timelockController = new TimelockController(
            _minDelay,     // Minimum delay for operations
            proposers,     // List of addresses that can propose
            executors,     // List of addresses that can execute
            msg.sender     // Admin who can grant/revoke roles
        );

        // Validate and set initial configuration
        _validateAndSetConfig(_initialConfig);
        _initialized = true;

        emit ConfigUpdated(_initialConfig);
    }

    /**
     * @notice Update hub configuration
     * @param _newConfig New configuration to apply
     * @dev SECURITY FIX: Requires timelock for fee changes
     */
    function updateConfig(HubConfig memory _newConfig) 
        external 
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        // SECURITY FIX: Check if this is a fee update
        bool isFeeUpdate = (
            _newConfig.burnFeePct != _config.burnFeePct ||
            _newConfig.chainFeePct != _config.chainFeePct ||
            _newConfig.warchestFeePct != _config.warchestFeePct ||
            _newConfig.conversionFeePct != _config.conversionFeePct ||
            _newConfig.arbitratorFeePct != _config.arbitratorFeePct
        );
        
        // If fee update, require timelock
        if (isFeeUpdate) {
            require(
                msg.sender == address(timelockController),
                "Fee updates must go through timelock"
            );
        }
        
        _validateAndSetConfig(_newConfig);
        emit ConfigUpdated(_newConfig);
    }

    /**
     * @notice Update admin address
     * @param _newAdmin New admin address
     * @dev Only callable by current admin
     */
    function updateAdmin(address _newAdmin) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(_newAdmin != address(0), "Invalid admin address");
        
        address oldAdmin = _admin;
        
        // Grant admin role to new admin
        _grantRole(ADMIN_ROLE, _newAdmin);
        _grantRole(DEFAULT_ADMIN_ROLE, _newAdmin);
        
        // Revoke from old admin
        _revokeRole(ADMIN_ROLE, oldAdmin);
        _revokeRole(DEFAULT_ADMIN_ROLE, oldAdmin);
        
        // Update admin state
        _admin = _newAdmin;

        emit AdminUpdated(oldAdmin, _newAdmin);
    }

    /**
     * @notice Emergency pause function
     * @param reason Reason for the pause
     * @dev Only callable by emergency role or admin
     */
    function emergencyPause(string memory reason) 
        external 
        onlyRole(EMERGENCY_ROLE) 
    {
        _config.globalPause = true;
        emit CircuitBreakerActivated(reason, msg.sender);
    }

    /**
     * @notice Resume operations
     * @dev Only callable by admin role
     */
    function resume() 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        _config.globalPause = false;
        _config.pauseNewTrades = false;
        _config.pauseDeposits = false;
        _config.pauseWithdrawals = false;

        emit CircuitBreakerDeactivated(msg.sender);
    }
    
    // Phase 4: Enhanced Circuit Breaker Functions
    
    /**
     * @notice Pause a specific operation
     * @param _operation Operation identifier to pause
     * @dev Only callable by emergency role for immediate response
     */
    function pauseOperation(bytes32 _operation) 
        external 
        onlyRole(EMERGENCY_ROLE) 
    {
        operationPaused[_operation] = true;
        emit OperationPaused(_operation, msg.sender);
    }
    
    /**
     * @notice Unpause a specific operation
     * @param _operation Operation identifier to unpause
     * @dev Only callable by admin role for controlled resumption
     */
    function unpauseOperation(bytes32 _operation) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        operationPaused[_operation] = false;
        emit OperationUnpaused(_operation, msg.sender);
    }
    
    /**
     * @notice Pause/unpause a specific contract
     * @param _contract Contract address to pause
     * @param _paused True to pause, false to unpause
     * @dev Only callable by admin role
     */
    function pauseContract(address _contract, bool _paused) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        contractPaused[_contract] = _paused;
        emit ContractSpecificPause(_contract, _paused, msg.sender);
    }
    
    /**
     * @notice Emergency pause with extended timeout and reason
     * @param _reason Detailed reason for the pause
     * @param _extendedTimeout Additional time for the pause (in seconds)
     * @dev Enhanced emergency pause with better tracking
     */
    function enhancedEmergencyPause(string memory _reason, uint256 _extendedTimeout) 
        external 
        onlyRole(EMERGENCY_ROLE) 
    {
        _config.globalPause = true;
        lastEmergencyPauseTime = block.timestamp;
        lastPauseReason = _reason;
        
        // If extended timeout is specified, record it
        if (_extendedTimeout > 0) {
            uint256 previousTime = lastEmergencyPauseTime;
            lastEmergencyPauseTime = block.timestamp + _extendedTimeout;
            emit EmergencyPauseExtended(previousTime, lastEmergencyPauseTime, msg.sender);
        }
        
        emit CircuitBreakerActivated(_reason, msg.sender);
    }
    
    /**
     * @notice Batch pause multiple operations
     * @param _operations Array of operation identifiers to pause
     * @dev Efficient way to pause multiple operations at once
     */
    function batchPauseOperations(bytes32[] memory _operations) 
        external 
        onlyRole(EMERGENCY_ROLE) 
    {
        for (uint256 i = 0; i < _operations.length; i++) {
            operationPaused[_operations[i]] = true;
            emit OperationPaused(_operations[i], msg.sender);
        }
    }
    
    /**
     * @notice Batch unpause multiple operations
     * @param _operations Array of operation identifiers to unpause
     * @dev Efficient way to unpause multiple operations at once
     */
    function batchUnpauseOperations(bytes32[] memory _operations) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        for (uint256 i = 0; i < _operations.length; i++) {
            operationPaused[_operations[i]] = false;
            emit OperationUnpaused(_operations[i], msg.sender);
        }
    }

    /**
     * @notice Get current hub configuration
     * @return Current hub configuration
     */
    function getConfig() external view returns (HubConfig memory) {
        return _config;
    }

    /**
     * @notice Get current admin address
     * @return Current admin address
     */
    function getAdmin() external view returns (address) {
        return _admin;
    }

    /**
     * @notice Check if system is globally paused
     * @return True if system is paused
     */
    function isPaused() external view returns (bool) {
        return _config.globalPause;
    }

    /**
     * @notice Check if specific functionality is paused
     * @param pauseType Type of pause to check
     * @return True if specified functionality is paused
     */
    function isPausedByType(string memory pauseType) public view returns (bool) {
        bytes32 pauseHash = keccak256(bytes(pauseType));
        bytes32 tradesHash = keccak256(bytes("trades"));
        bytes32 depositsHash = keccak256(bytes("deposits"));
        bytes32 withdrawalsHash = keccak256(bytes("withdrawals"));

        if (pauseHash == tradesHash) {
            return _config.pauseNewTrades || _config.globalPause;
        } else if (pauseHash == depositsHash) {
            return _config.pauseDeposits || _config.globalPause;
        } else if (pauseHash == withdrawalsHash) {
            return _config.pauseWithdrawals || _config.globalPause;
        }
        
        return _config.globalPause;
    }
    
    // Phase 4: Enhanced Circuit Breaker View Functions
    
    /**
     * @notice Check if a specific operation is paused
     * @param _operation Operation identifier to check
     * @return True if operation is paused
     */
    function isOperationPaused(bytes32 _operation) external view returns (bool) {
        return operationPaused[_operation] || _config.globalPause;
    }
    
    /**
     * @notice Check if a specific contract is paused
     * @param _contract Contract address to check
     * @return True if contract is paused
     */
    function isContractPaused(address _contract) external view returns (bool) {
        return contractPaused[_contract] || _config.globalPause;
    }
    
    /**
     * @notice Get the last emergency pause details
     * @return timestamp Last pause time
     * @return reason Last pause reason
     */
    function getLastEmergencyPauseInfo() external view returns (uint256 timestamp, string memory reason) {
        return (lastEmergencyPauseTime, lastPauseReason);
    }
    
    /**
     * @notice Check multiple operations pause status at once
     * @param _operations Array of operation identifiers to check
     * @return statuses Array of pause statuses
     */
    function batchCheckOperationsPaused(bytes32[] memory _operations) 
        external 
        view 
        returns (bool[] memory statuses) 
    {
        statuses = new bool[](_operations.length);
        for (uint256 i = 0; i < _operations.length; i++) {
            statuses[i] = operationPaused[_operations[i]] || _config.globalPause;
        }
        return statuses;
    }
    
    /**
     * @notice Get all circuit breaker status in one call
     * @return globalPause Global pause status
     * @return newTradesPaused New trades pause status
     * @return depositsPaused Deposits pause status
     * @return withdrawalsPaused Withdrawals pause status
     * @return lastPauseTime Last emergency pause timestamp
     */
    function getCircuitBreakerStatus() 
        external 
        view 
        returns (
            bool globalPause,
            bool newTradesPaused,
            bool depositsPaused,
            bool withdrawalsPaused,
            uint256 lastPauseTime
        ) 
    {
        return (
            _config.globalPause,
            _config.pauseNewTrades,
            _config.pauseDeposits,
            _config.pauseWithdrawals,
            lastEmergencyPauseTime
        );
    }

    /**
     * @notice Validate and set configuration
     * @param _newConfig Configuration to validate and set
     * @dev SECURITY FIX: Added individual fee limits validation
     */
    function _validateAndSetConfig(HubConfig memory _newConfig) internal {
        // SECURITY FIX: Validate individual fee limits
        require(_newConfig.burnFeePct <= MAX_BURN_FEE, "Burn fee exceeds maximum");
        require(_newConfig.chainFeePct <= MAX_CHAIN_FEE, "Chain fee exceeds maximum");
        require(_newConfig.warchestFeePct <= MAX_WARCHEST_FEE, "Warchest fee exceeds maximum");
        require(_newConfig.conversionFeePct <= MAX_CONVERSION_FEE, "Conversion fee exceeds maximum");
        require(_newConfig.arbitratorFeePct <= MAX_ARBITRATOR_FEE, "Arbitrator fee exceeds maximum");
        
        // Validate total fee percentages
        uint32 totalFees = uint32(_newConfig.burnFeePct) + 
                          uint32(_newConfig.chainFeePct) + 
                          uint32(_newConfig.warchestFeePct) +
                          uint32(_newConfig.conversionFeePct) +
                          uint32(_newConfig.arbitratorFeePct);
        
        require(totalFees <= MAX_TOTAL_FEE, "Total fees exceed maximum");

        // Validate timer constraints
        if (_newConfig.tradeExpirationTimer < MIN_TIMER_VALUE || 
            _newConfig.tradeExpirationTimer > MAX_TRADE_EXPIRATION_TIMER) {
            revert InvalidTimerParameter(
                "tradeExpirationTimer", 
                _newConfig.tradeExpirationTimer, 
                MAX_TRADE_EXPIRATION_TIMER
            );
        }

        if (_newConfig.tradeDisputeTimer < MIN_TIMER_VALUE || 
            _newConfig.tradeDisputeTimer > MAX_TRADE_DISPUTE_TIMER) {
            revert InvalidTimerParameter(
                "tradeDisputeTimer", 
                _newConfig.tradeDisputeTimer, 
                MAX_TRADE_DISPUTE_TIMER
            );
        }

        // Validate addresses (non-zero check for critical contracts)
        require(_newConfig.treasury != address(0), "Invalid treasury address");
        require(_newConfig.localMarket != address(0), "Invalid local market address");
        require(_newConfig.priceProvider != address(0), "Invalid price provider address");

        // Validate trade limits
        require(_newConfig.minTradeAmount > 0, "Invalid minimum trade amount");
        require(_newConfig.maxTradeAmount > _newConfig.minTradeAmount, "Invalid maximum trade amount");
        require(_newConfig.maxActiveOffers > 0, "Invalid max active offers");
        require(_newConfig.maxActiveTrades > 0, "Invalid max active trades");

        // Set the configuration
        _config = _newConfig;
    }

    /**
     * @notice Authorize upgrade with STRICT timelock enforcement (UUPS pattern)
     * @param newImplementation Address of the new implementation
     * 
     * SECURITY FIX AUTH-002: STRICT TIMELOCK ENFORCEMENT
     * This function now enforces that ONLY the timelock controller can authorize upgrades.
     * The ADMIN_ROLE modifier has been REMOVED to prevent any bypass mechanism.
     * 
     * Requirements:
     * - Timelock controller must be configured (not zero address)
     * - Caller MUST be the timelock controller (no exceptions)
     * - No admin role can bypass this requirement
     * 
     * @dev This fix addresses the AUTH-002 high severity finding from security audit
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
    {
        // Basic validation
        require(newImplementation != address(0), "Invalid implementation");
        require(newImplementation != address(this), "Cannot upgrade to same implementation");
        
        // SECURITY FIX AUTH-002: Strict timelock enforcement
        // Timelock MUST be configured - no zero address allowed
        require(address(timelockController) != address(0), "Timelock controller not configured");
        
        // SECURITY FIX AUTH-002: ONLY timelock can execute upgrades
        // Removed onlyRole(ADMIN_ROLE) modifier to prevent any admin bypass
        require(
            msg.sender == address(timelockController),
            "Only timelock controller can execute upgrades"
        );
        
        emit UpgradeAuthorized(newImplementation, msg.sender);
    }

    /**
     * @notice Get contract version
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    /**
     * @notice Check if contract is initialized
     * @return True if initialized
     */
    function isInitialized() external view returns (bool) {
        return _initialized;
    }

    /**
     * @notice Check if an upgrade is authorized
     * @dev SECURITY FIX: Uses TimelockController for upgrade authorization
     * @dev SECURITY FIX UPG-003: Strict enforcement - no admin bypass allowed
     * @param contractAddress Contract being upgraded
     * @param newImplementation New implementation address
     * @return authorized Whether the upgrade is authorized
     */
    function isUpgradeAuthorized(
        address contractAddress,
        address newImplementation
    ) external view override returns (bool authorized) {
        // SECURITY FIX UPG-003: Timelock is mandatory for all upgrades
        require(address(timelockController) != address(0), "Timelock controller not configured");
        
        // Validate parameters
        if (contractAddress == address(0) || newImplementation == address(0)) {
            return false;
        }
        
        if (contractAddress == newImplementation) {
            return false; // Cannot upgrade to same implementation
        }
        
        // Only timelock controller can authorize upgrades - no bypass allowed
        return msg.sender == address(timelockController);
    }

    /**
     * @notice Get the timelock controller address
     * @return Timelock controller address
     */
    function getTimelockController() external view override returns (address) {
        return address(timelockController);
    }

    /**
     * @notice Update the timelock controller (only callable by current timelock)
     * @param _newTimelock New timelock controller address
     * @dev SECURITY FIX AUTH-002: Only current timelock can transfer control
     */
    function setTimelockController(address _newTimelock) 
        external 
    {
        require(_newTimelock != address(0), "Invalid timelock address");
        
        // SECURITY FIX AUTH-002: Only current timelock can change timelock
        // Prevents admin from bypassing timelock by changing the controller
        require(
            msg.sender == address(timelockController),
            "Only current timelock can transfer control"
        );
        
        address oldTimelock = address(timelockController);
        timelockController = TimelockController(payable(_newTimelock));
        emit TimelockControllerUpdated(oldTimelock, _newTimelock);
    }
}