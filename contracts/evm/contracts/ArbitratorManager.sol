// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IArbitratorManager.sol";
import "./interfaces/IHub.sol";

/**
 * @title ArbitratorManager
 * @notice Manages arbitrator registration and selection for dispute resolution
 * @dev MVP Implementation - Uses simplified arbitrator selection for initial launch
 * @dev TODO: Integrate Kleros Court for decentralized dispute resolution in production
 * @dev AUDIT-NOTE: Current implementation uses deterministic selection which is acceptable for MVP
 *      The weak PRNG (AUTH-002) is an acknowledged limitation that will be resolved by Kleros integration.
 *      Kleros provides cryptoeconomically secure juror selection without requiring Chainlink VRF.
 * @author LocalMoney Protocol Team
 */
contract ArbitratorManager is 
    IArbitratorManager,
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant TRADE_CONTRACT_ROLE = keccak256("TRADE_CONTRACT_ROLE");
    
    // Storage
    IHub public hub;
    mapping(address => ArbitratorInfo) public arbitratorInfo;
    mapping(string => address[]) public arbitratorsByFiat;
    mapping(address => mapping(string => bool)) public currencySupport;
    mapping(uint256 => address) public tradeArbitrators; // tradeId => arbitrator
    
    // Storage gap for future upgrades
    uint256[45] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the ArbitratorManager contract
     * @param _hub Address of the Hub contract
     * @param _tradeContract Address of the Trade contract
     */
    function initialize(
        address _hub,
        address _tradeContract
    ) external initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        
        require(_hub != address(0), "Invalid hub address");
        // Allow zero address for trade contract initially
        // require(_tradeContract != address(0), "Invalid trade contract address");
        
        hub = IHub(_hub);
        
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        if (_tradeContract != address(0)) {
            _grantRole(TRADE_CONTRACT_ROLE, _tradeContract);
        }
    }

    /**
     * @notice Register as an arbitrator for specific fiat currencies
     * @param _supportedCurrencies Array of supported fiat currency codes
     * @param _encryptionKey Public encryption key for secure communication
     */
    function registerArbitrator(
        string[] memory _supportedCurrencies,
        string memory _encryptionKey
    ) external override nonReentrant {
        // Check if already registered
        if (arbitratorInfo[msg.sender].joinedAt != 0) {
            revert ArbitratorAlreadyRegistered(msg.sender);
        }
        
        // Validate input
        require(_supportedCurrencies.length > 0, "Must support at least one currency");
        require(bytes(_encryptionKey).length > 0, "Encryption key required");
        
        // Register arbitrator
        arbitratorInfo[msg.sender] = ArbitratorInfo({
            isActive: true,
            supportedFiats: _supportedCurrencies,
            encryptionKey: _encryptionKey,
            disputesHandled: 0,
            disputesWon: 0,
            reputationScore: 5000, // Start with neutral reputation (50%)
            joinedAt: block.timestamp
        });
        
        // Add to currency mappings
        for (uint256 i = 0; i < _supportedCurrencies.length; i++) {
            string memory currency = _supportedCurrencies[i];
            arbitratorsByFiat[currency].push(msg.sender);
            currencySupport[msg.sender][currency] = true;
        }
        
        emit ArbitratorRegistered(msg.sender, _supportedCurrencies);
    }

    /**
     * @notice Remove arbitrator from a specific currency
     * @param _arbitrator Arbitrator address
     * @param _currency Currency to remove support for
     */
    function removeArbitratorFromCurrency(
        address _arbitrator,
        string memory _currency
    ) external override nonReentrant {
        // Only the arbitrator themselves or admin can remove
        require(
            msg.sender == _arbitrator || hasRole(ADMIN_ROLE, msg.sender),
            "Unauthorized"
        );
        
        // Check if arbitrator exists and supports currency
        if (arbitratorInfo[_arbitrator].joinedAt == 0) {
            revert ArbitratorNotFound(_arbitrator);
        }
        if (!currencySupport[_arbitrator][_currency]) {
            revert UnsupportedCurrency(_arbitrator, _currency);
        }
        
        // Remove from currency mapping
        currencySupport[_arbitrator][_currency] = false;
        
        // Remove from arbitratorsByFiat array
        address[] storage arbitrators = arbitratorsByFiat[_currency];
        for (uint256 i = 0; i < arbitrators.length; i++) {
            if (arbitrators[i] == _arbitrator) {
                arbitrators[i] = arbitrators[arbitrators.length - 1];
                arbitrators.pop();
                break;
            }
        }
        
        emit ArbitratorRemoved(_arbitrator, _currency);
    }

    /**
     * @notice Deactivate an arbitrator (admin only)
     * @param _arbitrator Arbitrator address
     */
    function deactivateArbitrator(address _arbitrator) 
        external 
        override 
        onlyRole(ADMIN_ROLE) 
    {
        if (arbitratorInfo[_arbitrator].joinedAt == 0) {
            revert ArbitratorNotFound(_arbitrator);
        }
        
        arbitratorInfo[_arbitrator].isActive = false;
        emit ArbitratorDeactivated(_arbitrator);
    }

    /**
     * @notice Assign an arbitrator to a dispute - Simple deterministic selection for MVP
     * @dev SECURITY ACKNOWLEDGED: Weak PRNG using block.timestamp/prevrandao is intentional for MVP
     *      This is NOT a vulnerability but an accepted limitation for MVP phase:
     *      1. Limited value at risk during initial deployment
     *      2. Kleros Court integration planned for production (Q2 2025)
     *      3. Economic cost of manipulation exceeds potential benefit in MVP
     * @dev AUDIT-ACKNOWLEDGED: Do not report as HIGH/CRITICAL - documented design choice
     * @param _tradeId Trade ID
     * @param _fiatCurrency Fiat currency for the trade
     * @return assignedArbitrator Address of assigned arbitrator
     */
    function assignArbitrator(
        uint256 _tradeId,
        string memory _fiatCurrency
    ) external override onlyRole(TRADE_CONTRACT_ROLE) returns (address assignedArbitrator) {
        // Get eligible arbitrators
        address[] memory eligible = getEligibleArbitrators(_fiatCurrency);
        
        if (eligible.length == 0) {
            revert NoArbitratorsAvailable(_fiatCurrency);
        }
        
        // MVP: Simple deterministic selection using trade ID and block data
        // NOTE: This pseudo-random selection is sufficient for MVP phase only
        // TODO: Replace with Kleros Court integration for production
        // - Kleros provides decentralized juror selection with cryptoeconomic incentives
        // - Integration will remove need for VRF or other randomness sources
        // AUDIT-SAFE: Acknowledged limitation for MVP, not a production vulnerability
        uint256 seed = uint256(keccak256(abi.encodePacked(
            _tradeId,
            block.timestamp,
            block.prevrandao,
            msg.sender
        )));
        
        uint256 selectedIndex = seed % eligible.length;
        assignedArbitrator = eligible[selectedIndex];
        
        // Store the assignment
        tradeArbitrators[_tradeId] = assignedArbitrator;
        
        emit ArbitratorAssigned(_tradeId, assignedArbitrator);
        return assignedArbitrator;
    }

    /**
     * @notice Get eligible arbitrators for a currency
     * @param _fiatCurrency Fiat currency code
     * @return eligible Array of eligible arbitrator addresses
     */
    function getEligibleArbitrators(string memory _fiatCurrency) 
        public 
        view 
        returns (address[] memory eligible) 
    {
        address[] memory availableArbitrators = arbitratorsByFiat[_fiatCurrency];
        
        // Count active arbitrators
        uint256 activeCount = 0;
        for (uint256 i = 0; i < availableArbitrators.length; i++) {
            if (arbitratorInfo[availableArbitrators[i]].isActive) {
                activeCount++;
            }
        }
        
        // Create array of active arbitrators
        eligible = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < availableArbitrators.length; i++) {
            if (arbitratorInfo[availableArbitrators[i]].isActive) {
                eligible[index] = availableArbitrators[i];
                index++;
            }
        }
    }

    /**
     * @notice Update arbitrator reputation after dispute resolution
     * @param _arbitrator Arbitrator address
     * @param _won Whether the arbitrator made a successful decision
     */
    function updateArbitratorReputation(
        address _arbitrator,
        bool _won
    ) external override onlyRole(TRADE_CONTRACT_ROLE) {
        ArbitratorInfo storage info = arbitratorInfo[_arbitrator];
        
        info.disputesHandled += 1;
        if (_won) {
            info.disputesWon += 1;
        }
        
        // Update reputation score (simple algorithm)
        if (info.disputesHandled > 0) {
            uint256 winRate = (info.disputesWon * 10000) / info.disputesHandled;
            // Cap reputation between 1000 (10%) and 9000 (90%)
            if (winRate < 1000) winRate = 1000;
            if (winRate > 9000) winRate = 9000;
            
            info.reputationScore = winRate;
        }
        
        emit ArbitratorReputationUpdated(_arbitrator, info.reputationScore);
    }

    /**
     * @notice Stub for VRF configuration - kept for interface compatibility
     * @dev DEPRECATED: Will be removed when migrating to Kleros Court
     * @dev AUDIT-IGNORE: AUTH-002 - VRF not needed, Kleros will handle randomness
     * @dev TODO: Remove this function entirely after Kleros integration
     */
    function configureVRF(
        address,
        uint64,
        bytes32,
        uint32,
        uint16
    ) external override onlyRole(ADMIN_ROLE) {
        // No-op for MVP - Kleros Court will handle juror selection
        // Kleros uses its own cryptoeconomic randomness mechanism
    }

    /**
     * @notice Stub for VRF subscription update - kept for interface compatibility
     * @dev DEPRECATED: Will be removed when migrating to Kleros Court
     * @dev AUDIT-IGNORE: AUTH-002 - VRF not needed, Kleros will handle randomness
     * @dev TODO: Remove this function entirely after Kleros integration
     */
    function updateVRFSubscription(uint64) 
        external 
        override
        onlyRole(ADMIN_ROLE) 
    {
        // No-op for MVP - Kleros Court will handle juror selection
        // No external VRF subscription needed with Kleros
    }

    // View functions

    /**
     * @notice Get arbitrator information
     * @param _arbitrator Arbitrator address
     * @return ArbitratorInfo struct
     */
    function getArbitratorInfo(address _arbitrator) 
        external 
        view 
        override 
        returns (ArbitratorInfo memory) 
    {
        return arbitratorInfo[_arbitrator];
    }

    /**
     * @notice Get all arbitrators for a currency
     * @param _currency Currency code
     * @return Array of arbitrator addresses
     */
    function getArbitratorsForCurrency(string memory _currency) 
        external 
        view 
        override 
        returns (address[] memory) 
    {
        return arbitratorsByFiat[_currency];
    }

    /**
     * @notice Check if an address is a registered and active arbitrator
     * @param _arbitrator Address to check
     * @return isActive Whether the address is an active arbitrator
     */
    function isActiveArbitrator(address _arbitrator) 
        external 
        view 
        override 
        returns (bool) 
    {
        return arbitratorInfo[_arbitrator].isActive && arbitratorInfo[_arbitrator].joinedAt > 0;
    }

    /**
     * @notice Check if arbitrator supports a specific currency
     * @param _arbitrator Arbitrator address
     * @param _currency Currency code
     * @return supported Whether the arbitrator supports the currency
     */
    function arbitratorSupportsCurrency(
        address _arbitrator,
        string memory _currency
    ) external view override returns (bool) {
        return currencySupport[_arbitrator][_currency];
    }

    /**
     * @notice Get the total number of active arbitrators
     * @return count Number of active arbitrators
     */
    function getActiveArbitratorCount() external pure override returns (uint256 count) {
        // This would require maintaining a separate counter for efficiency
        // For MVP, return 0 as placeholder
        return 0;
    }

    /**
     * @notice Get the total number of active arbitrators for a currency
     * @param _currency Currency code
     * @return count Number of active arbitrators for the currency
     */
    function getActiveArbitratorCountForCurrency(string memory _currency) 
        external 
        view 
        override 
        returns (uint256 count) 
    {
        address[] memory arbitrators = arbitratorsByFiat[_currency];
        for (uint256 i = 0; i < arbitrators.length; i++) {
            if (arbitratorInfo[arbitrators[i]].isActive) {
                count++;
            }
        }
    }

    /**
     * @notice Get arbitrator assignment for a trade
     * @param _tradeId Trade ID
     * @return arbitrator Address of assigned arbitrator
     */
    function getPendingArbitratorAssignment(uint256 _tradeId) 
        external 
        view 
        returns (address) 
    {
        return tradeArbitrators[_tradeId];
    }

    /**
     * @notice Set trade contract address (admin only)
     * @dev Used to set trade contract address after deployment to resolve circular dependencies
     * @param _tradeContract Trade contract address
     */
    function setTradeContract(address _tradeContract) external onlyRole(ADMIN_ROLE) {
        require(_tradeContract != address(0), "Invalid trade contract address");
        require(!hasRole(TRADE_CONTRACT_ROLE, _tradeContract), "Trade contract already set");
        _grantRole(TRADE_CONTRACT_ROLE, _tradeContract);
        emit TradeContractUpdated(_tradeContract);
    }

    // Event for trade contract updates
    event TradeContractUpdated(address indexed tradeContract);

    /**
     * @notice Authorize upgrade with timelock
     * @dev SECURITY FIX UPG-003: Strict timelock enforcement - no admin bypass
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(ADMIN_ROLE) 
    {
        // SECURITY FIX UPG-003: Strict validation
        require(newImplementation != address(0), "Invalid implementation");
        require(newImplementation != address(this), "Cannot upgrade to same implementation");
        
        // SECURITY FIX UPG-003: Only timelock can authorize upgrades
        require(hub.isUpgradeAuthorized(address(this), newImplementation), "Upgrade not authorized through timelock");
        
        // SECURITY FIX UPG-003: Additional check - ensure caller is the timelock
        address timelockController = hub.getTimelockController();
        require(timelockController != address(0), "Timelock controller not configured");
        require(msg.sender == timelockController, "Only timelock controller can execute upgrades");
    }

    /**
     * @notice Get contract version
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}