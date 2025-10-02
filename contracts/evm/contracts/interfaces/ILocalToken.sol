// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ILocalToken
 * @notice Interface for the LOCAL token contract with burn functionality
 * @dev Extends standard ERC20 interface with burning capabilities
 */
interface ILocalToken is IERC20 {
    /**
     * @notice Burn tokens from the caller's account
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external;

    /**
     * @notice Burn tokens from a specific account (requires allowance)
     * @param account Account to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address account, uint256 amount) external;

    /**
     * @notice Get the number of decimals for the token
     * @return Number of decimals
     */
    function decimals() external view returns (uint8);

    /**
     * @notice Get the token symbol
     * @return Token symbol
     */
    function symbol() external view returns (string memory);

    /**
     * @notice Get the token name
     * @return Token name
     */
    function name() external view returns (string memory);

    // Events
    event Burn(address indexed from, uint256 value);
}