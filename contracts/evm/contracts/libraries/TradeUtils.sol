// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/ITrade.sol";

/**
 * @title TradeUtils
 * @notice Utility library for Trade contract operations
 * @dev Helps reduce the main Trade contract size by moving utility functions
 */
library TradeUtils {
    using TradeUtils for ITrade.TradeData;

    /**
     * @notice Validates a trade state transition
     * @param currentState Current trade state
     * @param newState Requested new state
     * @return valid True if transition is valid
     */
    function isValidStateTransition(
        ITrade.TradeState currentState,
        ITrade.TradeState newState
    ) internal pure returns (bool valid) {
        // Optimize with unchecked arithmetic for gas efficiency
        unchecked {
            if (currentState == ITrade.TradeState.RequestCreated) {
                return newState == ITrade.TradeState.RequestAccepted || 
                       newState == ITrade.TradeState.EscrowCancelled;
            }
            
            if (currentState == ITrade.TradeState.RequestAccepted) {
                return newState == ITrade.TradeState.EscrowFunded ||
                       newState == ITrade.TradeState.EscrowCancelled;
            }
            
            if (currentState == ITrade.TradeState.EscrowFunded) {
                return newState == ITrade.TradeState.FiatDeposited ||
                       newState == ITrade.TradeState.EscrowCancelled ||
                       newState == ITrade.TradeState.EscrowRefunded;
            }
            
            if (currentState == ITrade.TradeState.FiatDeposited) {
                return newState == ITrade.TradeState.EscrowReleased ||
                       newState == ITrade.TradeState.EscrowDisputed;
            }
            
            if (currentState == ITrade.TradeState.EscrowDisputed) {
                return newState == ITrade.TradeState.DisputeResolved;
            }
            
            return false;
        }
    }

    /**
     * @notice Calculates trade expiration timestamp
     * @param createdAt Trade creation timestamp
     * @param expirationHours Hours until expiration
     * @return expiresAt Expiration timestamp
     */
    function calculateExpiration(
        uint256 createdAt,
        uint256 expirationHours
    ) internal pure returns (uint256 expiresAt) {
        unchecked {
            return createdAt + (expirationHours * 3600);
        }
    }

    /**
     * @notice Checks if a trade has expired
     * @param expiresAt Trade expiration timestamp
     * @return expired True if trade has expired
     */
    function isExpired(uint256 expiresAt) internal view returns (bool expired) {
        return block.timestamp > expiresAt;
    }

    /**
     * @notice Optimized fee calculation
     * @param amount Base amount
     * @param feePercentage Fee percentage in basis points (100 = 1%)
     * @return fee Calculated fee amount
     */
    function calculateFee(
        uint256 amount,
        uint256 feePercentage
    ) internal pure returns (uint256 fee) {
        unchecked {
            return (amount * feePercentage) / 10000;
        }
    }

    /**
     * @notice Pack trade data for storage optimization
     * @param buyer Buyer address
     * @param seller Seller address
     * @param amount Trade amount (packed to uint128)
     * @param fiatAmount Fiat amount (packed to uint128)
     * @return packed Packed trade data
     */
    function packTradeData(
        address buyer,
        address seller,
        uint256 amount,
        uint256 fiatAmount
    ) internal pure returns (uint256 packed) {
        // Pack two uint128 values into one uint256 for gas optimization
        require(amount <= type(uint128).max, "Amount overflow");
        require(fiatAmount <= type(uint128).max, "Fiat amount overflow");
        
        unchecked {
            return (uint256(uint128(amount)) << 128) | uint128(fiatAmount);
        }
    }

    /**
     * @notice Unpack trade data
     * @param packed Packed trade data
     * @return amount Trade amount
     * @return fiatAmount Fiat amount
     */
    function unpackTradeData(uint256 packed) 
        internal 
        pure 
        returns (uint256 amount, uint256 fiatAmount) 
    {
        unchecked {
            amount = packed >> 128;
            fiatAmount = uint256(uint128(packed));
        }
    }
}