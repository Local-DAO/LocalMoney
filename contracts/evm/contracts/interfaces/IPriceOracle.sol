// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPriceOracle
 * @notice Interface for the Price Oracle contract (to be implemented in Phase 3)
 * @dev This is a placeholder interface for future implementation
 */
interface IPriceOracle {

    struct TokenRoute {
        address[] path;        // DEX route for price calculation
        address dex;           // DEX contract address
        uint256 fee;           // Fee tier for the route
    }

    // Events
    event PriceUpdated(string indexed currency, uint256 price, uint256 timestamp);
    event PriceProviderUpdated(address indexed oldProvider, address indexed newProvider);
    event TokenRouteUpdated(address indexed token, TokenRoute route);
    event PriceStale(string indexed currency, uint256 lastUpdate);

    // Custom errors are defined in the implementation

    // Placeholder function signatures for Phase 3 implementation
    function updatePrices(string[] memory _currencies, uint256[] memory _prices) external;
    function updateTokenRoute(address _token, TokenRoute memory _route) external;
    function setPriceProvider(address _provider) external;
    
    function getFiatPrice(string memory _currency) external view returns (uint256);
    function getTokenPriceInFiat(address _token, string memory _fiatCurrency, uint256 _amount) external returns (uint256);
    function getTokenPriceInUSD(address _token) external returns (uint256);
    function isPriceValid(string memory _currency) external view returns (bool);
    function getPriceAge(string memory _currency) external view returns (uint256);
}