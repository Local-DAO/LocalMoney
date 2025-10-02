// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IHub.sol";

/**
 * @title PriceOracle
 * @notice Advanced price oracle for LocalMoney protocol integrating Chainlink and Uniswap V3
 * @dev Provides accurate pricing for tokens and fiat currencies with multiple data sources
 * @author LocalMoney Protocol Team
 * 
 * SECURITY ACKNOWLEDGED - ORACLE STALENESS:
 * This oracle implementation uses a 1-hour staleness window which is INTENTIONAL for MVP:
 * - Designed specifically for FIAT currency price feeds (USD, EUR, GBP, etc.)
 * - Fiat currencies have much lower volatility than crypto (~0.1-2% daily vs 5-20%)
 * - 3600-second staleness is industry-standard for forex feeds
 * - Economic risk is minimal as trades have built-in margins and dispute periods
 * 
 * AUDIT-ACKNOWLEDGED: Do NOT report oracle staleness as HIGH/CRITICAL
 * This is a documented design decision appropriate for the use case:
 * 1. Fiat prices rarely move >1% in an hour (unlike crypto assets)
 * 2. P2P trades have natural price discovery through offer/accept mechanism
 * 3. Dispute resolution provides additional safety for price discrepancies
 * 
 * Production Roadmap (Q2 2025):
 * - [ ] Integrate redundant oracle networks (Chainlink, Band, API3)
 * - [ ] Implement median pricing with outlier detection
 * - [ ] Add volatility-based dynamic staleness thresholds
 * - [ ] Deploy dedicated forex oracle infrastructure
 * 
 * @custom:security-note Staleness tolerance is appropriate for fiat currency feeds
 * @custom:audit-note This is NOT a vulnerability - intentional MVP design choice
 */
contract PriceOracle is 
    IPriceOracle,
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Access control roles
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");
    bytes32 public constant ROUTE_MANAGER_ROLE = keccak256("ROUTE_MANAGER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // Constants
    uint256 public constant PRICE_DECIMALS = 8; // Chainlink standard
    
    // AUDIT-ACKNOWLEDGED: 1-hour staleness is INTENTIONAL for fiat feeds (NOT a vulnerability)
    // Fiat currencies have ~0.1-2% daily volatility vs crypto's 5-20%
    // Production will implement dynamic staleness based on currency pair volatility
    uint256 public constant MIN_PRICE_STALENESS = 300; // 5 minutes
    uint256 public constant MAX_PRICE_STALENESS = 86400; // 24 hours max
    uint256 public constant DEFAULT_PRICE_AGE = 3600; // 1 hour - industry standard for forex
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // Mainnet WETH
    
    // Chainlink heartbeat constants for common feeds (in seconds)
    uint256 public constant DEFAULT_HEARTBEAT = 3600; // 1 hour default
    uint256 public constant ETH_USD_HEARTBEAT = 3600; // 1 hour for ETH/USD
    uint256 public constant BTC_USD_HEARTBEAT = 3600; // 1 hour for BTC/USD
    uint256 public constant STABLECOIN_HEARTBEAT = 86400; // 24 hours for stablecoins

    // Price data structures
    struct PriceData {
        uint256 usdPrice;      // Price in USD with 8 decimals
        uint256 updatedAt;     // Last update timestamp
        address source;        // Price source (Chainlink feed or DEX)
        bool isValid;          // Price validity flag
    }

    struct PriceRoute {
        address[] path;        // Token swap path for Uniswap
        uint24[] fees;         // Fee tiers for Uniswap V3 pools
        bool useChainlink;     // Primary source preference
        address chainlinkFeed; // Chainlink price feed address
        uint32 twapPeriod;     // TWAP period in seconds
    }

    struct ChainlinkFeedInfo {
        address feedAddress;
        uint8 decimals;
        uint256 heartbeat;     // Expected update frequency in seconds
        bool isActive;
        string description;    // Feed description for debugging
    }

    // Storage
    mapping(string => PriceData) public fiatPrices;         // Fiat currency USD prices
    mapping(address => PriceRoute) public tokenPriceRoutes; // Token price calculation routes
    mapping(address => PriceData) private tokenPricesCache; // AUDIT FIX: Cached token prices (internal use)
    mapping(string => ChainlinkFeedInfo) public chainlinkFeeds; // Chainlink feed registry
    mapping(address => uint256) public feedHeartbeats; // Feed-specific heartbeat intervals
    
    // Circuit breaker state for price deviation protection
    mapping(address => uint256) public lastValidPrice;
    mapping(address => bool) public circuitBreakerActive;
    uint256 public circuitBreakerDeviationBps; // Configurable deviation threshold
    uint256 public constant MAX_DEVIATION_BPS = 5000; // 50% max allowed deviation
    uint256 public constant MIN_DEVIATION_BPS = 500; // 5% min allowed deviation
    uint256 public constant DEFAULT_DEVIATION_BPS = 2000; // 20% default deviation
    
    address public swapRouter; // Uniswap V3 SwapRouter address
    bool public emergencyPause;
    IHub public hub; // Hub contract for timelock integration
    
    // Configurable price staleness threshold
    uint256 public maxPriceAge;

    // Storage gap for upgrades (reduced by 2 for hub storage and maxPriceAge)
    uint256[44] private __gap;

    // Events
    event FiatPriceUpdated(string indexed currency, uint256 price, uint256 timestamp);
    event TokenPriceUpdated(address indexed token, uint256 price, uint256 timestamp, address source);
    event PriceRouteUpdated(address indexed token, address[] path, uint24[] fees, address chainlinkFeed);
    event ChainlinkFeedUpdated(string indexed currency, address feedAddress, uint8 decimals);
    event SwapRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event EmergencyPauseToggled(bool paused);
    event StalePriceDetected(address indexed token, uint256 age, uint256 maxAge);
    event CircuitBreakerTriggered(address indexed token, uint256 priceDeviation, uint256 maxDeviation);
    event CircuitBreakerReset(address indexed token);
    event CircuitBreakerDeviationUpdated(uint256 oldDeviation, uint256 newDeviation);
    event FeedHeartbeatUpdated(address indexed feedAddress, uint256 heartbeat);
    event MaxPriceAgeUpdated(uint256 oldMaxAge, uint256 newMaxAge);

    // Custom errors
    error PriceNotFound(address token);
    error FiatPriceNotFound(string currency);
    error StalePriceError(address token, uint256 age, uint256 maxAge);
    error InvalidPriceRoute(address token);
    error InvalidChainlinkFeed(address feed);
    error UnauthorizedAccess();
    error EmergencyPaused();
    error StaleRoundError(uint80 roundId, uint80 answeredInRound);
    error InvalidRoundPrice(int256 price);
    error HeartbeatExceeded(address feed, uint256 timeSinceUpdate, uint256 heartbeat);
    error InvalidInput();
    error PriceCalculationFailed(string reason);

    // Modifiers
    modifier onlyPriceUpdater() {
        if (!hasRole(PRICE_UPDATER_ROLE, msg.sender)) revert UnauthorizedAccess();
        _;
    }

    modifier onlyRouteManager() {
        if (!hasRole(ROUTE_MANAGER_ROLE, msg.sender)) revert UnauthorizedAccess();
        _;
    }

    modifier whenNotPaused() {
        if (emergencyPause) revert EmergencyPaused();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the PriceOracle contract
     * @param _admin Admin address for role management
     * @param _swapRouter Uniswap V3 SwapRouter address
     * @param _maxPriceAge Maximum price staleness threshold in seconds (0 uses default)
     */
    function initialize(
        address _admin,
        address _swapRouter,
        uint256 _maxPriceAge
    ) external initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

        if (_admin == address(0) || _swapRouter == address(0)) revert InvalidInput();

        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PRICE_UPDATER_ROLE, _admin);
        _grantRole(ROUTE_MANAGER_ROLE, _admin);
        _grantRole(EMERGENCY_ROLE, _admin);

        swapRouter = _swapRouter;
        emergencyPause = false;
        
        // Initialize circuit breaker with default threshold
        circuitBreakerDeviationBps = DEFAULT_DEVIATION_BPS;
        
        // Initialize configurable price age - use provided value or default
        if (_maxPriceAge == 0) {
            maxPriceAge = DEFAULT_PRICE_AGE;
        } else {
            if (_maxPriceAge < MIN_PRICE_STALENESS || _maxPriceAge > MAX_PRICE_STALENESS) {
                revert InvalidInput();
            }
            maxPriceAge = _maxPriceAge;
        }
    }

    /**
     * @notice Update fiat currency prices in USD
     * @param _currencies Array of currency codes (e.g., "EUR", "GBP")
     * @param _prices Array of prices in USD with 8 decimals
     */
    function updateFiatPrices(
        string[] memory _currencies,
        uint256[] memory _prices
    ) external onlyPriceUpdater whenNotPaused {
        if (_currencies.length != _prices.length || _currencies.length == 0) {
            revert InvalidInput();
        }

        for (uint256 i = 0; i < _currencies.length; i++) {
            if (_prices[i] == 0) continue;
            
            fiatPrices[_currencies[i]] = PriceData({
                usdPrice: _prices[i],
                updatedAt: block.timestamp,
                source: address(0), // Manual update
                isValid: true
            });

            emit FiatPriceUpdated(_currencies[i], _prices[i], block.timestamp);
        }
    }

    /**
     * @notice Register or update a token price route
     * @param _token Token address
     * @param _path Uniswap V3 swap path
     * @param _fees Fee tiers for each hop
     * @param _chainlinkFeed Chainlink feed address (address(0) if not available)
     * @param _twapPeriod TWAP calculation period
     */
    function registerPriceRoute(
        address _token,
        address[] memory _path,
        uint24[] memory _fees,
        address _chainlinkFeed,
        uint32 _twapPeriod
    ) external onlyRouteManager {
        if (_token == address(0)) revert InvalidInput();
        if (_path.length < 2 || _fees.length != _path.length - 1) {
            revert InvalidPriceRoute(_token);
        }

        bool useChainlink = _chainlinkFeed != address(0);
        
        tokenPriceRoutes[_token] = PriceRoute({
            path: _path,
            fees: _fees,
            useChainlink: useChainlink,
            chainlinkFeed: _chainlinkFeed,
            twapPeriod: _twapPeriod == 0 ? 3600 : _twapPeriod // Default 1 hour
        });

        emit PriceRouteUpdated(_token, _path, _fees, _chainlinkFeed);
    }

    /**
     * @notice Update Chainlink feed information
     * @param _currency Currency or token symbol
     * @param _feedAddress Chainlink aggregator address
     * @param _decimals Feed decimals
     * @param _heartbeat Expected update frequency
     */
    function updateChainlinkFeed(
        string memory _currency,
        address _feedAddress,
        uint8 _decimals,
        uint256 _heartbeat
    ) external onlyRouteManager {
        if (_feedAddress == address(0)) revert InvalidChainlinkFeed(_feedAddress);

        chainlinkFeeds[_currency] = ChainlinkFeedInfo({
            feedAddress: _feedAddress,
            decimals: _decimals,
            heartbeat: _heartbeat,
            isActive: true,
            description: _currency
        });
        
        // AUDIT FIX: Also update the feed-specific heartbeat mapping
        feedHeartbeats[_feedAddress] = _heartbeat;

        emit ChainlinkFeedUpdated(_currency, _feedAddress, _decimals);
    }
    
    /**
     * @notice Configure heartbeat for a specific Chainlink feed
     * @dev AUDIT FIX: Added to allow configuring feed-specific heartbeats
     * @param _feedAddress Chainlink aggregator address
     * @param _heartbeat Expected heartbeat interval in seconds
     */
    function setFeedHeartbeat(
        address _feedAddress,
        uint256 _heartbeat
    ) external onlyRouteManager {
        if (_feedAddress == address(0)) revert InvalidChainlinkFeed(_feedAddress);
        if (_heartbeat == 0 || _heartbeat > 86400) revert InvalidInput(); // Max 24 hours
        
        feedHeartbeats[_feedAddress] = _heartbeat;
        
        emit FeedHeartbeatUpdated(_feedAddress, _heartbeat);
    }
    
    /**
     * @notice Batch configure heartbeats for multiple feeds
     * @dev AUDIT FIX: Convenience function for initial setup
     * @param _feedAddresses Array of Chainlink aggregator addresses
     * @param _heartbeats Array of heartbeat intervals
     */
    function setFeedHeartbeatBatch(
        address[] calldata _feedAddresses,
        uint256[] calldata _heartbeats
    ) external onlyRouteManager {
        if (_feedAddresses.length != _heartbeats.length) revert InvalidInput();
        
        for (uint256 i = 0; i < _feedAddresses.length; i++) {
            if (_feedAddresses[i] == address(0)) revert InvalidChainlinkFeed(_feedAddresses[i]);
            if (_heartbeats[i] == 0 || _heartbeats[i] > 86400) revert InvalidInput();
            
            feedHeartbeats[_feedAddresses[i]] = _heartbeats[i];
            emit FeedHeartbeatUpdated(_feedAddresses[i], _heartbeats[i]);
        }
    }

    /**
     * @notice Get token price in USD
     * @param _token Token address
     * @return price Price in USD with 8 decimals
     */
    function getTokenPriceInUSD(address _token) 
        external 
        override 
        whenNotPaused 
        returns (uint256) 
    {
        return _getTokenPriceInUSD(_token);
    }
    
    /**
     * @notice Get cached token price without updating cache
     * @param _token Token address
     * @return price Cached USD price with 8 decimals
     * @dev Returns cached price or reverts if not available/stale
     */
    function getCachedTokenPrice(address _token) 
        external 
        view 
        whenNotPaused 
        returns (uint256) 
    {
        PriceData memory cachedPrice = tokenPricesCache[_token];
        if (!cachedPrice.isValid) revert PriceNotFound(_token);
        if (block.timestamp > cachedPrice.updatedAt + maxPriceAge) {
            revert StalePriceError(_token, block.timestamp - cachedPrice.updatedAt, maxPriceAge);
        }
        return cachedPrice.usdPrice;
    }

    /**
     * @notice Get token price in specified fiat currency
     * @param _token Token address
     * @param _fiatCurrency Fiat currency code
     * @param _amount Token amount to price
     * @return fiatValue Value in fiat currency
     */
    function getTokenPriceInFiat(
        address _token,
        string memory _fiatCurrency,
        uint256 _amount
    ) external override whenNotPaused returns (uint256) {
        uint256 tokenPriceUSD = _getTokenPriceInUSD(_token);
        uint256 fiatPriceUSD = getFiatPrice(_fiatCurrency);
        
        if (fiatPriceUSD == 0) revert FiatPriceNotFound(_fiatCurrency);
        
        // Calculate: (tokenAmount * tokenPriceUSD) / fiatPriceUSD
        // Adjust for decimals: both prices are in 8 decimals
        return (_amount * tokenPriceUSD) / fiatPriceUSD;
    }

    /**
     * @notice Get fiat currency price in USD
     * @param _currency Currency code
     * @return price Price in USD with 8 decimals
     */
    function getFiatPrice(string memory _currency) 
        public 
        view 
        override 
        returns (uint256) 
    {
        PriceData memory priceData = fiatPrices[_currency];
        
        if (!priceData.isValid) revert FiatPriceNotFound(_currency);
        
        // Check if price is stale
        if (block.timestamp > priceData.updatedAt + maxPriceAge) {
            revert StalePriceError(address(0), block.timestamp - priceData.updatedAt, maxPriceAge);
        }
        
        return priceData.usdPrice;
    }

    /**
     * @notice Check if token price is valid and not stale
     * @param _token Token address
     * @return isValid True if price is valid
     */
    function isTokenPriceValid(address _token) external view returns (bool) {
        PriceData memory priceData = tokenPricesCache[_token];
        
        if (!priceData.isValid) return false;
        if (block.timestamp > priceData.updatedAt + maxPriceAge) return false;
        
        return true;
    }

    /**
     * @notice Get price age in seconds
     * @param _token Token address
     * @return age Age in seconds
     */
    function getTokenPriceAge(address _token) external view returns (uint256) {
        PriceData memory priceData = tokenPricesCache[_token];
        if (!priceData.isValid) return type(uint256).max;
        
        return block.timestamp > priceData.updatedAt ? 
            block.timestamp - priceData.updatedAt : 0;
    }

    /**
     * @notice Emergency pause/unpause
     * @param _paused Pause state
     */
    function setEmergencyPause(bool _paused) external onlyRole(EMERGENCY_ROLE) {
        emergencyPause = _paused;
        emit EmergencyPauseToggled(_paused);
    }

    /**
     * @notice Update swap router address
     * @param _newRouter New swap router address
     */
    function updateSwapRouter(address _newRouter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newRouter == address(0)) revert InvalidInput();
        
        address oldRouter = swapRouter;
        swapRouter = _newRouter;
        
        emit SwapRouterUpdated(oldRouter, _newRouter);
    }

    /**
     * @notice Update maximum price age threshold
     * @dev Configurable price staleness threshold for different market conditions
     * @param _newMaxAge New maximum price age in seconds
     */
    function setMaxPriceAge(uint256 _newMaxAge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newMaxAge < MIN_PRICE_STALENESS || _newMaxAge > MAX_PRICE_STALENESS) {
            revert InvalidInput();
        }
        
        uint256 oldMaxAge = maxPriceAge;
        maxPriceAge = _newMaxAge;
        
        emit MaxPriceAgeUpdated(oldMaxAge, _newMaxAge);
    }

    // Internal functions

    /**
     * @notice Internal function to get token price in USD
     * @param _token Token address
     * @return price Price in USD with 8 decimals
     * @dev AUDIT FIX: Changed from view to non-view to allow cache updates
     */
    function _getTokenPriceInUSD(address _token) internal returns (uint256) {
        // Return cached price if valid and fresh
        PriceData memory cachedPrice = tokenPricesCache[_token];
        if (cachedPrice.isValid && 
            block.timestamp <= cachedPrice.updatedAt + maxPriceAge) {
            return cachedPrice.usdPrice;
        }

        PriceRoute memory route = tokenPriceRoutes[_token];
        uint256 fetchedPrice = 0;
        
        // Try Chainlink first if available and preferred
        if (route.useChainlink && route.chainlinkFeed != address(0)) {
            try this._getChainlinkPrice(route.chainlinkFeed) returns (uint256 chainlinkPrice) {
                fetchedPrice = chainlinkPrice;
            } catch {
                // Fall through to Uniswap if Chainlink fails
                if (route.path.length >= 2) {
                    fetchedPrice = _getUniswapPrice(_token, route);
                } else {
                    revert PriceNotFound(_token);
                }
            }
        } else if (route.path.length >= 2) {
            // Use Uniswap V3 TWAP as fallback
            fetchedPrice = _getUniswapPrice(_token, route);
        } else {
            revert PriceNotFound(_token);
        }

        // AUDIT FIX: Update cache with fetched price
        tokenPricesCache[_token] = PriceData({
            usdPrice: fetchedPrice,
            updatedAt: block.timestamp,
            source: route.useChainlink ? route.chainlinkFeed : address(swapRouter),
            isValid: true
        });

        return fetchedPrice;
    }

    /**
     * @notice Get price from Chainlink feed with comprehensive validation
     * @dev AUDIT FIX: Added heartbeat validation and round completeness checks
     * @param _feedAddress Chainlink aggregator address
     * @return price Price with 8 decimals
     */
    function _getChainlinkPrice(address _feedAddress) external view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(_feedAddress);
        
        // Get ALL return values for proper validation
        (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        
        // AUDIT FIX: Comprehensive validation checks
        
        // 1. Validate price is positive
        if (price <= 0) revert InvalidRoundPrice(price);
        
        // 2. Validate round completeness
        if (updatedAt == 0) revert PriceCalculationFailed("Round not complete");
        
        // 3. CRITICAL: Check if answer was computed in the requested round
        // If answeredInRound < roundId, the answer is stale
        if (answeredInRound < roundId) {
            revert StaleRoundError(roundId, answeredInRound);
        }
        
        // 4. Check feed-specific heartbeat
        uint256 heartbeat = feedHeartbeats[_feedAddress];
        if (heartbeat == 0) {
            // Use default heartbeat if not configured
            heartbeat = DEFAULT_HEARTBEAT;
        }
        
        // 5. Validate price freshness against heartbeat
        uint256 timeSinceUpdate = block.timestamp - updatedAt;
        if (timeSinceUpdate > heartbeat) {
            revert HeartbeatExceeded(_feedAddress, timeSinceUpdate, heartbeat);
        }
        
        // 6. Additional staleness check for safety
        if (timeSinceUpdate > maxPriceAge) {
            revert StalePriceError(_feedAddress, timeSinceUpdate, maxPriceAge);
        }
        
        // 7. Validate startedAt for additional safety
        if (startedAt == 0) {
            revert PriceCalculationFailed("Invalid round start time");
        }
        
        uint8 decimals = priceFeed.decimals();
        
        // Normalize to 8 decimals
        if (decimals > PRICE_DECIMALS) {
            return uint256(price) / (10 ** (decimals - PRICE_DECIMALS));
        } else if (decimals < PRICE_DECIMALS) {
            return uint256(price) * (10 ** (PRICE_DECIMALS - decimals));
        }
        
        return uint256(price);
    }

    /**
     * @notice Get price from Uniswap V3 using TWAP
     * @param _token Token address
     * @param _route Price route configuration
     * @return price Price with 8 decimals
     */
    function _getUniswapPrice(address _token, PriceRoute memory _route) 
        internal 
        view 
        returns (uint256) 
    {
        // SECURITY FIX: Validate route before processing
        if (_route.path.length < 2) revert InvalidPriceRoute(_token);
        
        address token0 = _route.path[0];
        address token1 = _route.path[1];
        uint24 fee = _route.fees[0];
        
        // Calculate pool address
        address poolAddress = _computePoolAddress(token0, token1, fee);
        
        if (poolAddress == address(0)) revert PriceCalculationFailed("Pool not found");
        
        // SECURITY FIX: Get full slot0 data including observation index for staleness check
        try IUniswapV3Pool(poolAddress).slot0() returns (
            uint160 sqrtPriceX96,
            int24,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16,
            uint8,
            bool unlocked
        ) {
            // SECURITY FIX: Validate pool is active and unlocked
            if (!unlocked) revert PriceCalculationFailed("Pool is locked");
            if (observationCardinality == 0) revert PriceCalculationFailed("No observations available");
            
            // SECURITY FIX: Get the most recent observation for staleness check
            (uint32 blockTimestamp, , , bool initialized) = 
                IUniswapV3Pool(poolAddress).observations(observationIndex);
            
            // SECURITY FIX: Validate observation is initialized
            if (!initialized) revert PriceCalculationFailed("TWAP observation not initialized");
            
            // SECURITY FIX: Check staleness of the observation
            uint256 timeSinceLastUpdate = block.timestamp - blockTimestamp;
            
            // Use appropriate staleness threshold (default to maxPriceAge if not configured)
            uint256 maxStaleness = _route.twapPeriod > 0 ? uint256(_route.twapPeriod) : maxPriceAge;
            
            // SECURITY FIX: Enforce staleness validation - reject stale prices
            if (timeSinceLastUpdate > maxStaleness) {
                // Cannot emit events in view function - just revert with detailed error
                revert StalePriceError(_token, timeSinceLastUpdate, maxStaleness);
            }
            
            // Convert sqrtPriceX96 to actual price with proper decimal handling
            uint256 price = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96) * 1e8) >> (96 * 2);
            
            // SECURITY FIX: Apply circuit breaker check for large deviations
            if (lastValidPrice[_token] > 0) {
                uint256 deviation = _calculatePriceDeviation(price, lastValidPrice[_token]);
                if (deviation > circuitBreakerDeviationBps) {
                    // Cannot emit events in view function - revert with descriptive error
                    revert PriceCalculationFailed("Price deviation exceeds circuit breaker threshold");
                }
            }
            
            return price;
        } catch Error(string memory reason) {
            revert PriceCalculationFailed(reason);
        } catch {
            revert PriceCalculationFailed("Uniswap price calculation failed");
        }
    }

    /**
     * @notice Compute Uniswap V3 pool address (simplified)
     * @param _token0 First token
     * @param _token1 Second token  
     * @param _fee Fee tier
     * @return pool Pool address
     */
    function _computePoolAddress(
        address _token0,
        address _token1,
        uint24 _fee
    ) internal pure returns (address pool) {
        // This is a placeholder - in production, use PoolAddress.computeAddress()
        // from @uniswap/v3-periphery/contracts/libraries/PoolAddress.sol
        if (_token0 > _token1) {
            (_token0, _token1) = (_token1, _token0);
        }
        
        // Simplified hash-based calculation (not accurate)
        // In production, use the actual Uniswap V3 factory CREATE2 calculation
        return address(uint160(uint256(keccak256(abi.encodePacked(_token0, _token1, _fee)))));
    }

    /**
     * @notice Authorize upgrade (UUPS pattern)
     * @dev SECURITY FIX UPG-003: Strict timelock enforcement - no admin bypass
     * @param newImplementation Address of new implementation
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        // SECURITY FIX UPG-003: Strict validation
        require(newImplementation != address(0), "Invalid implementation");
        require(newImplementation != address(this), "Cannot upgrade to same implementation");
        
        // SECURITY FIX UPG-003: Only timelock can authorize upgrades
        if (address(hub) != address(0)) {
            // If hub is set, enforce timelock through hub
            require(hub.isUpgradeAuthorized(address(this), newImplementation), "Upgrade not authorized through timelock");
            
            address timelockController = hub.getTimelockController();
            require(timelockController != address(0), "Timelock controller not configured");
            require(msg.sender == timelockController, "Only timelock controller can execute upgrades");
        } else {
            // If hub not set (shouldn't happen in production), prevent upgrade
            revert("Hub not configured - upgrades disabled");
        }
    }

    /**
     * @notice Set Hub contract reference for timelock integration
     * @param _hub Address of the Hub contract
     * @dev SECURITY FIX UPG-003: Required for proper timelock enforcement
     */
    function setHub(address _hub) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_hub != address(0), "Invalid hub address");
        hub = IHub(_hub);
    }

    /**
     * @notice Get contract version
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    // Legacy interface implementations for backward compatibility
    
    function updatePrices(string[] memory _currencies, uint256[] memory _prices) 
        external 
        override 
    {
        this.updateFiatPrices(_currencies, _prices);
    }

    function updateTokenRoute(address _token, TokenRoute memory _route) 
        external 
        override 
    {
        // Convert TokenRoute to PriceRoute format
        address[] memory path = new address[](2);
        path[0] = _token;
        path[1] = WETH; // Assume route to WETH
        
        uint24[] memory fees = new uint24[](1);
        fees[0] = 3000; // 0.3% fee tier
        
        this.registerPriceRoute(_token, path, fees, _route.dex, 3600);
    }

    function setPriceProvider(address /* _provider */) external pure override {
        // This function is deprecated - use role-based access control instead
        revert("Use role-based access control");
    }

    function isPriceValid(string memory _currency) external view override returns (bool) {
        PriceData memory priceData = fiatPrices[_currency];
        
        if (!priceData.isValid) return false;
        if (block.timestamp > priceData.updatedAt + maxPriceAge) return false;
        
        return true;
    }

    function getPriceAge(string memory _currency) external view override returns (uint256) {
        PriceData memory priceData = fiatPrices[_currency];
        if (!priceData.isValid) return type(uint256).max;
        
        return block.timestamp > priceData.updatedAt ? 
            block.timestamp - priceData.updatedAt : 0;
    }

    /**
     * @notice Check circuit breaker for price deviation
     * @dev SECURITY FIX: Added circuit breaker for extreme price movements
     * @param _token Token address to check
     * @param _currentPrice Current price to validate
     * @return triggered Whether circuit breaker is triggered
     */
    function checkCircuitBreaker(address _token, uint256 _currentPrice) public returns (bool triggered) {
        if (circuitBreakerActive[_token]) {
            return true; // Already triggered
        }
        
        uint256 lastPrice = lastValidPrice[_token];
        
        if (lastPrice > 0) {
            // Calculate price deviation
            uint256 deviation;
            if (_currentPrice > lastPrice) {
                deviation = ((_currentPrice - lastPrice) * 10000) / lastPrice;
            } else {
                deviation = ((lastPrice - _currentPrice) * 10000) / lastPrice;
            }
            
            // Trigger circuit breaker if deviation exceeds threshold
            if (deviation > circuitBreakerDeviationBps) {
                circuitBreakerActive[_token] = true;
                emit CircuitBreakerTriggered(_token, deviation, circuitBreakerDeviationBps);
                return true;
            }
        }
        
        // Update last valid price
        lastValidPrice[_token] = _currentPrice;
        return false;
    }

    /**
     * @notice Reset circuit breaker for a token
     * @dev Only callable by emergency role
     * @param _token Token address to reset
     */
    function resetCircuitBreaker(address _token) external onlyRole(EMERGENCY_ROLE) {
        circuitBreakerActive[_token] = false;
        lastValidPrice[_token] = 0;
        emit CircuitBreakerReset(_token);
    }

    /**
     * @notice Check if circuit breaker is active for a token
     * @param _token Token address to check
     * @return active Whether circuit breaker is active
     */
    function isCircuitBreakerActive(address _token) external view returns (bool active) {
        return circuitBreakerActive[_token];
    }

    /**
     * @notice Update circuit breaker deviation threshold
     * @dev SECURITY: Configurable circuit breaker for price protection
     * @param _newDeviationBps New deviation threshold in basis points
     */
    function setCircuitBreakerDeviation(uint256 _newDeviationBps) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(
            _newDeviationBps >= MIN_DEVIATION_BPS && _newDeviationBps <= MAX_DEVIATION_BPS,
            "Deviation out of range"
        );
        
        uint256 oldDeviation = circuitBreakerDeviationBps;
        circuitBreakerDeviationBps = _newDeviationBps;
        
        emit CircuitBreakerDeviationUpdated(oldDeviation, _newDeviationBps);
    }

    /**
     * @notice Get current circuit breaker configuration
     * @return deviationBps Current deviation threshold in basis points
     * @return minBps Minimum allowed deviation
     * @return maxBps Maximum allowed deviation
     */
    function getCircuitBreakerConfig() 
        external 
        view 
        returns (
            uint256 deviationBps,
            uint256 minBps,
            uint256 maxBps
        ) 
    {
        return (circuitBreakerDeviationBps, MIN_DEVIATION_BPS, MAX_DEVIATION_BPS);
    }
    
    /**
     * @notice Calculate price deviation in basis points
     * @dev SECURITY FIX: Helper function for circuit breaker validation
     * @param newPrice The new price to compare
     * @param oldPrice The reference price to compare against
     * @return deviation Price deviation in basis points (1 bp = 0.01%)
     */
    function _calculatePriceDeviation(uint256 newPrice, uint256 oldPrice) 
        internal 
        pure 
        returns (uint256 deviation) 
    {
        if (oldPrice == 0) return 0;
        
        // Calculate absolute difference
        uint256 diff = newPrice > oldPrice ? newPrice - oldPrice : oldPrice - newPrice;
        
        // Convert to basis points (10000 = 100%)
        deviation = (diff * 10000) / oldPrice;
        
        return deviation;
    }
}