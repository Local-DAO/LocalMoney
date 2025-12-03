// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IProfile.sol";
import "./interfaces/IHub.sol";

/**
 * @title Profile
 * @notice Manages user profiles, trading statistics, and reputation for the LocalMoney protocol
 * @dev Handles user data storage, contact information, and integration with trading contracts
 * @author LocalMoney Protocol Team
 */
contract Profile is 
    Initializable, 
    UUPSUpgradeable, 
    ReentrancyGuardUpgradeable,
    IProfile 
{
    // Hub contract for configuration and access control
    IHub public hub;
    
    // User profiles mapping
    mapping(address => UserProfile) private _profiles;
    
    // Admin address for upgrades
    address public admin;

    // Events for admin operations
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    event HubUpdated(address indexed oldHub, address indexed newHub);

    // Storage gap for future upgrades
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Modifier to check authorization
     * @dev Only allows hub-registered contracts or profile owner
     */
    modifier onlyAuthorized(address _user) {
        IHub.HubConfig memory config = hub.getConfig();
        
        bool isAuthorizedContract = (
            msg.sender == config.offerContract ||
            msg.sender == config.tradeContract ||
            msg.sender == address(hub)
        );
        
        bool isProfileOwner = (msg.sender == _user);
        
        if (!isAuthorizedContract && !isProfileOwner) {
            revert Unauthorized(msg.sender, _user);
        }
        _;
    }

    /**
     * @notice Modifier to check if caller is authorized contract only
     */
    modifier onlyAuthorizedContract() {
        IHub.HubConfig memory config = hub.getConfig();
        
        if (msg.sender != config.offerContract && 
            msg.sender != config.tradeContract && 
            msg.sender != address(hub)) {
            revert Unauthorized(msg.sender, address(hub));
        }
        _;
    }

    /**
     * @notice Initialize the Profile contract
     * @param _hub Address of the Hub contract
     * @dev Can only be called once during deployment
     */
    function initialize(address _hub) external initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        require(_hub != address(0), "Invalid hub address");
        hub = IHub(_hub);
        admin = msg.sender;
    }

    /**
     * @notice Update user contact information
     * @param _contact Encrypted contact information
     * @param _publicKey Public key for encryption
     * @dev Creates profile if it doesn't exist
     */
    function updateContact(
        string memory _contact, 
        string memory _publicKey
    ) external nonReentrant {
        if (bytes(_contact).length == 0) {
            revert InvalidContactData("Contact cannot be empty");
        }
        if (bytes(_publicKey).length == 0) {
            revert InvalidContactData("Public key cannot be empty");
        }

        UserProfile storage profile = _profiles[msg.sender];
        
        // Create profile if it doesn't exist
        if (profile.createdAt == 0) {
            profile.createdAt = block.timestamp;
        }
        
        profile.encryptedContact = _contact;
        profile.publicKey = _publicKey;
        profile.lastActivity = block.timestamp;

        emit ProfileUpdated(msg.sender);
        emit ContactUpdated(msg.sender, _contact);
    }

    /**
     * @notice Update user trade count
     * @param _user User address
     * @param _completed Whether the trade was completed successfully
     * @dev Only callable by Trade contract
     */
    function updateTradeCount(
        address _user, 
        bool _completed
    ) external onlyAuthorizedContract {
        UserProfile storage profile = _profiles[_user];
        
        // Create profile if it doesn't exist
        if (profile.createdAt == 0) {
            profile.createdAt = block.timestamp;
        }

        if (_completed) {
            profile.tradesCompleted++;
        } else {
            profile.tradesRequested++;
        }
        
        profile.lastActivity = block.timestamp;

        emit TradeStatsUpdated(_user, profile.tradesRequested, profile.tradesCompleted);
    }

    /**
     * @notice Update active offers count
     * @param _user User address
     * @param _delta Change in active offers count (can be negative)
     * @dev Only callable by Offer contract
     */
    function updateActiveOffers(
        address _user, 
        int256 _delta
    ) external onlyAuthorizedContract {
        UserProfile storage profile = _profiles[_user];
        
        // Create profile if it doesn't exist
        if (profile.createdAt == 0) {
            profile.createdAt = block.timestamp;
        }

        if (_delta > 0) {
            // Check limits before increasing
            IHub.HubConfig memory config = hub.getConfig();
            if (profile.activeOffers + uint256(_delta) > config.maxActiveOffers) {
                revert LimitExceeded("activeOffers", profile.activeOffers, config.maxActiveOffers);
            }
            profile.activeOffers += uint256(_delta);
        } else if (_delta < 0) {
            uint256 decrease = uint256(-_delta);
            if (profile.activeOffers >= decrease) {
                profile.activeOffers -= decrease;
            } else {
                profile.activeOffers = 0;
            }
        }
        
        profile.lastActivity = block.timestamp;

        emit ActivityUpdated(_user, profile.activeOffers, profile.activeTrades);
    }

    /**
     * @notice Update active trades count
     * @param _user User address
     * @param _delta Change in active trades count (can be negative)
     * @dev Only callable by Trade contract
     */
    function updateActiveTrades(
        address _user, 
        int256 _delta
    ) external onlyAuthorizedContract {
        UserProfile storage profile = _profiles[_user];
        
        // Create profile if it doesn't exist
        if (profile.createdAt == 0) {
            profile.createdAt = block.timestamp;
        }

        if (_delta > 0) {
            // Check limits before increasing
            IHub.HubConfig memory config = hub.getConfig();
            if (profile.activeTrades + uint256(_delta) > config.maxActiveTrades) {
                revert LimitExceeded("activeTrades", profile.activeTrades, config.maxActiveTrades);
            }
            profile.activeTrades += uint256(_delta);
        } else if (_delta < 0) {
            uint256 decrease = uint256(-_delta);
            if (profile.activeTrades >= decrease) {
                profile.activeTrades -= decrease;
            } else {
                profile.activeTrades = 0;
            }
        }
        
        profile.lastActivity = block.timestamp;

        emit ActivityUpdated(_user, profile.activeOffers, profile.activeTrades);
    }

    /**
     * @notice Get user profile
     * @param _user User address
     * @return User profile data
     */
    function getProfile(address _user) external view returns (UserProfile memory) {
        return _profiles[_user];
    }

    /**
     * @notice Check if user profile exists
     * @param _user User address
     * @return True if user profile exists
     */
    function profileExists(address _user) external view returns (bool) {
        return _profiles[_user].createdAt > 0;
    }

    /**
     * @notice Get user trading statistics
     * @param _user User address
     * @return requested Total trades requested
     * @return completed Total trades completed
     * @return activeOffers Current active offers
     * @return activeTrades Current active trades
     */
    function getTradingStats(address _user) external view returns (
        uint256 requested,
        uint256 completed,
        uint256 activeOffers,
        uint256 activeTrades
    ) {
        UserProfile memory profile = _profiles[_user];
        return (
            profile.tradesRequested,
            profile.tradesCompleted,
            profile.activeOffers,
            profile.activeTrades
        );
    }

    /**
     * @notice Get user reputation score
     * @param _user User address
     * @return Reputation score (percentage based on completed vs requested trades)
     */
    function getReputationScore(address _user) external view returns (uint256) {
        UserProfile memory profile = _profiles[_user];
        
        uint256 totalTrades = profile.tradesRequested + profile.tradesCompleted;
        if (totalTrades == 0) {
            return 100; // New users start with 100% reputation
        }
        
        return (profile.tradesCompleted * 100) / totalTrades;
    }

    /**
     * @notice Check if user can create new offer
     * @param _user User address
     * @return True if user can create new offer
     */
    function canCreateOffer(address _user) external view returns (bool) {
        IHub.HubConfig memory config = hub.getConfig();
        UserProfile memory profile = _profiles[_user];
        
        return profile.activeOffers < config.maxActiveOffers;
    }

    /**
     * @notice Check if user can create new trade
     * @param _user User address
     * @return True if user can create new trade
     */
    function canCreateTrade(address _user) external view returns (bool) {
        IHub.HubConfig memory config = hub.getConfig();
        UserProfile memory profile = _profiles[_user];
        
        return profile.activeTrades < config.maxActiveTrades;
    }

    /**
     * @notice Update hub address (admin only)
     * @param _newHub New hub contract address
     */
    function updateHub(address _newHub) external {
        require(msg.sender == admin, "Only admin");
        require(_newHub != address(0), "Invalid hub address");
        
        address oldHub = address(hub);
        hub = IHub(_newHub);
        emit HubUpdated(oldHub, _newHub);
    }

    /**
     * @notice Update admin address
     * @param _newAdmin New admin address
     */
    function updateAdmin(address _newAdmin) external {
        require(msg.sender == admin, "Only admin");
        require(_newAdmin != address(0), "Invalid admin address");
        
        address oldAdmin = admin;
        admin = _newAdmin;
        emit AdminUpdated(oldAdmin, _newAdmin);
    }

    /**
     * @notice Authorize upgrade (UUPS pattern)
     * @param newImplementation Address of the new implementation
     * @dev SECURITY FIX: Added timelock requirement via Hub
     */
    function _authorizeUpgrade(address newImplementation) internal view override {
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