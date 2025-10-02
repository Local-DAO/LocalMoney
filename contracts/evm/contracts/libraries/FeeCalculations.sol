// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IHub.sol";
import "../interfaces/IEscrow.sol";

/**
 * @title FeeCalculations
 * @notice Gas-optimized fee calculation library
 * @dev Reduces Trade contract size by extracting fee logic
 */
library FeeCalculations {
    
    struct OptimizedFeeDistribution {
        uint128 burnAmount;      // 16 bytes
        uint128 chainAmount;     // 16 bytes  
        uint128 warchestAmount;  // 16 bytes
        uint128 arbitratorAmount; // 16 bytes
        // Total: 64 bytes (2 storage slots vs 5 slots)
    }

    /**
     * @notice Calculate standard fees with gas optimization
     * @param amount Base amount for fee calculation
     * @param config Hub configuration with fee percentages
     * @return fees Optimized fee distribution structure
     */
    function calculateStandardFees(
        uint256 amount,
        IHub.HubConfig memory config
    ) internal pure returns (OptimizedFeeDistribution memory fees) {
        unchecked {
            // Cache fee percentages for gas optimization
            uint256 burnFeePct = config.burnFeePct;
            uint256 chainFeePct = config.chainFeePct;
            uint256 warchestFeePct = config.warchestFeePct;
            
            // Calculate fees using optimized arithmetic
            fees.burnAmount = uint128((amount * burnFeePct) / 10000);
            fees.chainAmount = uint128((amount * chainFeePct) / 10000);
            fees.warchestAmount = uint128((amount * warchestFeePct) / 10000);
            fees.arbitratorAmount = 0; // No arbitrator fee for standard trades
        }
    }

    /**
     * @notice Calculate fees including arbitrator fee
     * @param amount Base amount for fee calculation
     * @param config Hub configuration with fee percentages
     * @return fees Optimized fee distribution structure
     */
    function calculateFeesWithArbitrator(
        uint256 amount,
        IHub.HubConfig memory config
    ) internal pure returns (OptimizedFeeDistribution memory fees) {
        unchecked {
            // Cache fee percentages for gas optimization
            uint256 burnFeePct = config.burnFeePct;
            uint256 chainFeePct = config.chainFeePct;
            uint256 warchestFeePct = config.warchestFeePct;
            uint256 arbitratorFeePct = config.arbitratorFeePct;
            
            // Calculate fees using optimized arithmetic
            fees.burnAmount = uint128((amount * burnFeePct) / 10000);
            fees.chainAmount = uint128((amount * chainFeePct) / 10000);
            fees.warchestAmount = uint128((amount * warchestFeePct) / 10000);
            fees.arbitratorAmount = uint128((amount * arbitratorFeePct) / 10000);
        }
    }

    /**
     * @notice Convert optimized fees to standard interface
     * @param optimizedFees Optimized fee structure
     * @return fees Standard fee distribution interface
     */
    function toStandardFees(OptimizedFeeDistribution memory optimizedFees)
        internal 
        pure 
        returns (IEscrow.FeeDistribution memory fees)
    {
        fees.burnAmount = optimizedFees.burnAmount;
        fees.chainAmount = optimizedFees.chainAmount;
        fees.warchestAmount = optimizedFees.warchestAmount;
        fees.arbitratorAmount = optimizedFees.arbitratorAmount;
    }

    /**
     * @notice Validate fee configuration to prevent overflow
     * @param config Hub configuration to validate
     * @return valid True if configuration is valid
     */
    function validateFeeConfig(IHub.HubConfig memory config) 
        internal 
        pure 
        returns (bool valid) 
    {
        unchecked {
            uint256 totalFees = config.burnFeePct + config.chainFeePct + 
                               config.warchestFeePct + config.arbitratorFeePct;
            return totalFees <= 1000; // Max 10% total fees
        }
    }

    /**
     * @notice Calculate remaining amount after fees
     * @param totalAmount Total amount before fees
     * @param fees Fee distribution
     * @return remaining Amount remaining after all fees
     */
    function calculateRemainingAmount(
        uint256 totalAmount,
        OptimizedFeeDistribution memory fees
    ) internal pure returns (uint256 remaining) {
        unchecked {
            return totalAmount - fees.burnAmount - fees.chainAmount - 
                   fees.warchestAmount - fees.arbitratorAmount;
        }
    }
}