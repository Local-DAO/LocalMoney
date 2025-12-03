// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/IHub.sol";
import "./interfaces/IProfile.sol";
import "./interfaces/IOffer.sol";

/**
 * @title Offer
 * @notice Implementation of the Offer contract for LocalMoney EVM protocol
 * @dev Enables users to create, manage, and query buy/sell offers for P2P trading
 */
contract Offer is IOffer, Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using EnumerableSet for EnumerableSet.UintSet;

    // State variables
    uint256 public nextOfferId;
    mapping(uint256 => OfferData) private _offers;
    mapping(address => uint256[]) private _userOffers;
    
    // AUDIT FIX: Add counter to avoid unbounded loops
    mapping(address => uint256) private _userActiveOfferCounts;
    
    // Indexes for efficient queries
    mapping(bytes32 => uint256[]) private _offersByType; // hash(type, fiat, token) => ids
    EnumerableSet.UintSet private _activeOfferIds;
    
    IHub public hub;
    
    // Custom errors
    error InvalidAmountRange(uint256 min, uint256 max);
    error DescriptionTooLong(uint256 length, uint256 maxLength);
    error MaxActiveOffersReached(uint256 current, uint256 max);
    error OfferNotFound(uint256 offerId);
    error UnauthorizedAccess(address caller, address owner);
    error InvalidOfferState(OfferState current, OfferState requested);
    error SystemPaused();
    error InvalidConfiguration();
    error InvalidPaginationParams(uint256 offset, uint256 limit);

    // Constants
    uint256 public constant MAX_DESCRIPTION_LENGTH = 280;
    uint256 public constant MAX_QUERY_LIMIT = 50;

    // Events are defined in IOffer interface

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the Offer contract
     * @param _hub Address of the Hub contract
     */
    function initialize(address _hub) external initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        if (_hub == address(0)) revert InvalidConfiguration();
        hub = IHub(_hub);
        nextOfferId = 1; // Start from 1 to avoid confusion with 0
    }

    /**
     * @notice Get user's active offer count
     * @param _user User address
     * @return Number of active offers
     * @dev AUDIT FIX: Use counter instead of unbounded loop
     */
    function getUserActiveOfferCount(address _user) public view returns (uint256) {
        return _userActiveOfferCounts[_user];
    }

    /**
     * @notice Create a new offer
     * @param _type Type of offer (Buy or Sell)
     * @param _fiatCurrency Fiat currency code (e.g., "USD", "EUR")
     * @param _token Token address (address(0) for native token)
     * @param _minAmount Minimum trade amount in token decimals
     * @param _maxAmount Maximum trade amount in token decimals
     * @param _rate Price per token in fiat cents
     * @param _description Offer description (max 280 chars)
     * @return offerId The created offer ID
     */
    function createOffer(
        OfferType _type,
        string memory _fiatCurrency,
        address _token,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _rate,
        string memory _description
    ) external nonReentrant returns (uint256) {
        // System-level checks
        if (hub.isPaused()) revert SystemPaused();
        
        // Validation
        if (_minAmount > _maxAmount) revert InvalidAmountRange(_minAmount, _maxAmount);
        if (bytes(_description).length > MAX_DESCRIPTION_LENGTH) {
            revert DescriptionTooLong(bytes(_description).length, MAX_DESCRIPTION_LENGTH);
        }
        
        // Check user limits from Hub
        IHub.HubConfig memory config = hub.getConfig();
        uint256 userActiveOffers = getUserActiveOfferCount(msg.sender);
        if (userActiveOffers >= config.maxActiveOffers) {
            revert MaxActiveOffersReached(userActiveOffers, config.maxActiveOffers);
        }
        
        // Create offer
        uint256 offerId = nextOfferId++;
        _offers[offerId] = OfferData({
            id: offerId,
            owner: msg.sender,
            offerType: _type,
            state: OfferState.Active,
            fiatCurrency: _fiatCurrency,
            tokenAddress: _token,
            minAmount: _minAmount,
            maxAmount: _maxAmount,
            rate: _rate,
            description: _description,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        
        // Update indexes
        _userOffers[msg.sender].push(offerId);
        // SECURITY FIX: Check return value from EnumerableSet.add
        bool added = _activeOfferIds.add(offerId);
        require(added, "Failed to add offer to active set");
        
        // AUDIT FIX: Increment active offer counter
        _userActiveOfferCounts[msg.sender]++;
        
        // Add to type-based index
        bytes32 typeKey = _getTypeKey(_type, _fiatCurrency, _token);
        _offersByType[typeKey].push(offerId);
        
        // Update Profile contract
        IProfile profile = IProfile(config.profileContract);
        profile.updateActiveOffers(msg.sender, 1);
        
        emit OfferCreated(offerId, msg.sender, _type);
        
        return offerId;
    }

    /**
     * @notice Update offer state, rate, and amounts
     * @param _offerId Offer ID to update
     * @param _newState New offer state
     * @param _newRate New rate (0 to keep current)
     * @param _newMin New minimum amount (0 to keep current)
     * @param _newMax New maximum amount (0 to keep current)
     */
    function updateOffer(
        uint256 _offerId,
        OfferState _newState,
        uint256 _newRate,
        uint256 _newMin,
        uint256 _newMax
    ) external {
        _updateOfferInternal(_offerId, _newState, _newRate, _newMin, _newMax);
    }

    /**
     * @notice Internal function to update offer state, rate, and amounts
     * @param _offerId Offer ID to update
     * @param _newState New offer state
     * @param _newRate New rate (0 to keep current)
     * @param _newMin New minimum amount (0 to keep current)
     * @param _newMax New maximum amount (0 to keep current)
     */
    function _updateOfferInternal(
        uint256 _offerId,
        OfferState _newState,
        uint256 _newRate,
        uint256 _newMin,
        uint256 _newMax
    ) internal nonReentrant {
        OfferData storage offer = _getOfferForUpdate(_offerId);
        
        OfferState oldState = offer.state;
        uint256 oldRate = offer.rate;
        uint256 oldMin = offer.minAmount;
        uint256 oldMax = offer.maxAmount;
        
        // Validate amounts if provided
        uint256 minAmount = _newMin == 0 ? offer.minAmount : _newMin;
        uint256 maxAmount = _newMax == 0 ? offer.maxAmount : _newMax;
        if (minAmount > maxAmount) revert InvalidAmountRange(minAmount, maxAmount);
        
        // Update offer data
        offer.state = _newState;
        offer.updatedAt = block.timestamp;
        
        if (_newRate > 0) {
            offer.rate = _newRate;
        }
        if (_newMin > 0) {
            offer.minAmount = _newMin;
        }
        if (_newMax > 0) {
            offer.maxAmount = _newMax;
        }
        
        // Update indexes if state changed
        if (oldState != _newState) {
            _updateOfferIndexes(_offerId, oldState, _newState);
            
            // Update Profile contract
            IHub.HubConfig memory config = hub.getConfig();
            IProfile profile = IProfile(config.profileContract);
            
            if (oldState == OfferState.Active && _newState != OfferState.Active) {
                profile.updateActiveOffers(msg.sender, -1);
            } else if (oldState != OfferState.Active && _newState == OfferState.Active) {
                profile.updateActiveOffers(msg.sender, 1);
            }
            
            emit OfferStateChanged(_offerId, oldState, _newState);
        }
        
        emit OfferUpdated(_offerId, _newState);
        
        if (_newRate > 0 && oldRate != _newRate) {
            emit OfferRateUpdated(_offerId, oldRate, _newRate);
        }
        
        if ((_newMin > 0 && oldMin != _newMin) || (_newMax > 0 && oldMax != _newMax)) {
            emit OfferAmountsUpdated(_offerId, oldMin, oldMax, minAmount, maxAmount);
        }
    }

    /**
     * @notice Pause an offer
     * @param _offerId Offer ID to pause
     */
    function pauseOffer(uint256 _offerId) external {
        _updateOfferInternal(_offerId, OfferState.Paused, 0, 0, 0);
    }

    /**
     * @notice Activate an offer
     * @param _offerId Offer ID to activate
     */
    function activateOffer(uint256 _offerId) external {
        _updateOfferInternal(_offerId, OfferState.Active, 0, 0, 0);
    }

    /**
     * @notice Archive an offer
     * @param _offerId Offer ID to archive
     */
    function archiveOffer(uint256 _offerId) external {
        OfferData storage offer = _getOfferForUpdate(_offerId);
        
        OfferState oldState = offer.state;
        
        // Archived offers cannot be modified further
        offer.state = OfferState.Archived;
        offer.updatedAt = block.timestamp;
        
        // Update indexes
        _updateOfferIndexes(_offerId, oldState, OfferState.Archived);
        
        // Update Profile contract if this was an active offer
        if (oldState == OfferState.Active) {
            IHub.HubConfig memory config = hub.getConfig();
            IProfile profile = IProfile(config.profileContract);
            profile.updateActiveOffers(msg.sender, -1);
        }
        
        emit OfferArchived(_offerId, msg.sender);
        emit OfferStateChanged(_offerId, oldState, OfferState.Archived);
    }

    /**
     * @notice Update offer description
     * @param _offerId Offer ID to update
     * @param _newDescription New description for the offer
     * @dev Only offer owner can update description
     */
    function updateOfferDescription(uint256 _offerId, string memory _newDescription) external nonReentrant {
        // Check system pause
        if (hub.isPaused()) revert SystemPaused();
        
        // Validate description length
        if (bytes(_newDescription).length > MAX_DESCRIPTION_LENGTH) {
            revert DescriptionTooLong(bytes(_newDescription).length, MAX_DESCRIPTION_LENGTH);
        }
        
        // Get offer and verify ownership
        OfferData storage offer = _getOfferForUpdate(_offerId);
        
        // Update description
        offer.description = _newDescription;
        offer.updatedAt = block.timestamp;
        
        // Emit event
        emit OfferDescriptionUpdated(_offerId, _newDescription);
    }

    /**
     * @notice Get offers by type with pagination
     * @param _type Offer type to filter by
     * @param _fiatCurrency Fiat currency to filter by
     * @param _token Token address to filter by
     * @param _offset Starting index for pagination
     * @param _limit Maximum number of results
     * @return results Array of matching offers
     * @return total Total number of matching offers
     */
    function getOffersByType(
        OfferType _type,
        string memory _fiatCurrency,
        address _token,
        uint256 _offset,
        uint256 _limit
    ) external view returns (OfferData[] memory results, uint256 total) {
        if (_limit == 0 || _limit > MAX_QUERY_LIMIT) {
            revert InvalidPaginationParams(_offset, _limit);
        }
        
        bytes32 typeKey = _getTypeKey(_type, _fiatCurrency, _token);
        uint256[] storage offerIds = _offersByType[typeKey];
        total = offerIds.length;
        
        if (_offset >= total) {
            return (new OfferData[](0), total);
        }
        
        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }
        
        results = new OfferData[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            results[i - _offset] = _offers[offerIds[i]];
        }
    }

    /**
     * @notice Get user's offers with pagination
     * @param _user User address
     * @param _offset Starting index for pagination
     * @param _limit Maximum number of results
     * @return results Array of user's offers
     * @return total Total number of user's offers
     */
    function getUserOffers(
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (OfferData[] memory results, uint256 total) {
        if (_limit == 0 || _limit > MAX_QUERY_LIMIT) {
            revert InvalidPaginationParams(_offset, _limit);
        }
        
        uint256[] storage userOfferIds = _userOffers[_user];
        total = userOfferIds.length;
        
        if (_offset >= total) {
            return (new OfferData[](0), total);
        }
        
        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }
        
        results = new OfferData[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            results[i - _offset] = _offers[userOfferIds[i]];
        }
    }

    /**
     * @notice Get a single offer by ID
     * @param _offerId Offer ID
     * @return Offer data
     */
    function getOffer(uint256 _offerId) external view returns (OfferData memory) {
        if (!_offerExists(_offerId)) revert OfferNotFound(_offerId);
        return _offers[_offerId];
    }


    /**
     * @notice Get simple user offers (for IOffer compatibility)
     * @param _user User address
     * @return Array of offer IDs
     */
    function getUserOffers(address _user) external view returns (uint256[] memory) {
        return _userOffers[_user];
    }

    /**
     * @notice Update offer state (for IOffer compatibility)
     * @param _offerId Offer ID
     * @param _newState New state
     */
    function updateOfferState(uint256 _offerId, OfferState _newState) external {
        _updateOfferInternal(_offerId, _newState, 0, 0, 0);
    }

    // Internal functions

    /**
     * @notice Get offer for update operations with ownership check
     * @param _offerId Offer ID
     * @return Reference to offer storage
     */
    function _getOfferForUpdate(uint256 _offerId) internal view returns (OfferData storage) {
        if (!_offerExists(_offerId)) revert OfferNotFound(_offerId);
        
        OfferData storage offer = _offers[_offerId];
        if (offer.owner != msg.sender) {
            revert UnauthorizedAccess(msg.sender, offer.owner);
        }
        
        return offer;
    }

    /**
     * @notice Check if offer exists
     * @param _offerId Offer ID
     * @return True if offer exists
     */
    function _offerExists(uint256 _offerId) internal view returns (bool) {
        return _offerId > 0 && _offerId < nextOfferId && _offers[_offerId].owner != address(0);
    }

    /**
     * @notice Generate type-based index key
     * @param _type Offer type
     * @param _fiatCurrency Fiat currency
     * @param _token Token address
     * @return Hash key for indexing
     */
    function _getTypeKey(
        OfferType _type,
        string memory _fiatCurrency,
        address _token
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_type, _fiatCurrency, _token));
    }

    /**
     * @notice Get offers by owner
     * @param owner Owner address
     * @return ownerOffers Array of offer IDs owned by the user
     */
    function getOffersByOwner(address owner) external view returns (uint256[] memory) {
        uint256 count = 0;
        
        // First pass: count offers
        for (uint256 i = 1; i < nextOfferId; i++) {
            if (_offers[i].owner == owner) {
                count++;
            }
        }
        
        // Second pass: collect offer IDs
        uint256[] memory ownerOffers = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextOfferId; i++) {
            if (_offers[i].owner == owner) {
                ownerOffers[index] = i;
                index++;
            }
        }
        
        return ownerOffers;
    }

    /**
     * @notice Get active offers by owner
     * @param owner Owner address
     * @return activeOffers Array of active offer IDs owned by the user
     */
    function getActiveOffersByOwner(address owner) external view returns (uint256[] memory) {
        uint256 count = 0;
        
        // First pass: count active offers
        for (uint256 i = 1; i < nextOfferId; i++) {
            if (_offers[i].owner == owner && _offers[i].state == OfferState.Active) {
                count++;
            }
        }
        
        // Second pass: collect offer IDs
        uint256[] memory activeOffers = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextOfferId; i++) {
            if (_offers[i].owner == owner && _offers[i].state == OfferState.Active) {
                activeOffers[index] = i;
                index++;
            }
        }
        
        return activeOffers;
    }

    /**
     * @notice Get all active offers
     * @return activeOfferIds Array of all active offer IDs
     */
    function getAllActiveOffers() external view returns (uint256[] memory) {
        uint256 length = _activeOfferIds.length();
        uint256[] memory activeOfferIds = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            activeOfferIds[i] = _activeOfferIds.at(i);
        }
        
        return activeOfferIds;
    }

    /**
     * @notice Update offer indexes when state changes
     * @param _offerId Offer ID
     * @param _oldState Previous state
     * @param _newState New state
     */
    function _updateOfferIndexes(
        uint256 _offerId,
        OfferState _oldState,
        OfferState _newState
    ) internal {
        // AUDIT FIX: Update active offer counter
        address owner = _offers[_offerId].owner;
        
        if (_oldState == OfferState.Active && _newState != OfferState.Active) {
            // SECURITY FIX: Check return value from EnumerableSet.remove
            bool removed = _activeOfferIds.remove(_offerId);
            // Only decrement counter if actually removed
            if (removed && _userActiveOfferCounts[owner] > 0) {
                _userActiveOfferCounts[owner]--;
            }
        } else if (_oldState != OfferState.Active && _newState == OfferState.Active) {
            // SECURITY FIX: Check return value from EnumerableSet.add
            bool added = _activeOfferIds.add(_offerId);
            // Only increment counter if actually added
            if (added) {
                _userActiveOfferCounts[owner]++;
            }
        }
    }

    /**
     * @notice Authorize upgrade (UUPS pattern)
     * @dev SECURITY FIX UPG-003: Strict timelock enforcement - no admin bypass
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
}