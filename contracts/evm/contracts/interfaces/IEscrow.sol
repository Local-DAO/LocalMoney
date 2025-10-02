// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IEscrow
 * @notice Interface for the Escrow contract handling trade escrow functionality
 * @dev Manages escrow deposits, releases, refunds, and fee distribution
 * @author LocalMoney Protocol Team
 */
interface IEscrow {
    // Fee distribution structure
    struct FeeDistribution {
        uint256 burnAmount;
        uint256 chainAmount;
        uint256 warchestAmount;
        uint256 arbitratorAmount;
    }

    // Events
    event EscrowDeposited(uint256 indexed tradeId, address indexed depositor, uint256 amount);
    event EscrowReleased(uint256 indexed tradeId, address indexed recipient, uint256 amount);
    event EscrowRefunded(uint256 indexed tradeId, address indexed recipient, uint256 amount);
    event FeesDistributed(uint256 indexed tradeId, uint256 burnAmount, uint256 chainAmount, uint256 warchestAmount);
    event TokensBurned(address indexed fromToken, address indexed localToken, uint256 amountSwapped, uint256 amountBurned);
    event BurnFallbackToTreasury(address indexed token, uint256 amount, string reason);
    event ArbitratorFeePaid(uint256 indexed tradeId, address indexed arbitrator, uint256 amount);
    event CircuitBreakerTriggered(address indexed token, uint256 priceDeviation, uint256 maxDeviation);
    event WithdrawalScheduled(address indexed recipient, uint256 amount);
    event Withdrawn(address indexed recipient, uint256 amount);
    
    // Custom errors
    error InsufficientEscrowBalance(uint256 tradeId, uint256 requested, uint256 available);
    error UnauthorizedAccess(address caller);
    error UnauthorizedDepositor(address depositor, address sender);
    error TransferFailed(address token, address to, uint256 amount);
    error InvalidAmount(uint256 amount);
    error TradeNotFound(uint256 tradeId);
    error EscrowAlreadyFunded(uint256 tradeId);
    error InvalidTokenAddress(address token);
    error SlippageExceeded(uint256 expectedOut, uint256 minOut, uint256 actualOut);
    error CircuitBreakerActivated(uint256 priceDeviation);
    error NothingToWithdraw();
    error WithdrawalFailed(address recipient, uint256 amount);

    /**
     * @notice Deposit funds into escrow for a trade
     * @param tradeId The trade ID
     * @param tokenAddress Token address (address(0) for ETH)
     * @param amount Amount to deposit
     * @param depositor Address of the depositor
     */
    function deposit(
        uint256 tradeId,
        address tokenAddress,
        uint256 amount,
        address depositor
    ) external payable;

    /**
     * @notice Release escrow funds to recipient with fee distribution
     * @param tradeId The trade ID
     * @param tokenAddress Token address
     * @param recipient Recipient of the funds
     * @param arbitratorAddress Optional arbitrator address for fee payment
     * @return netAmount Amount sent to recipient after fees
     */
    function release(
        uint256 tradeId,
        address tokenAddress,
        address recipient,
        address arbitratorAddress
    ) external returns (uint256 netAmount);

    /**
     * @notice Refund escrow funds to the original depositor
     * @param tradeId The trade ID
     * @param tokenAddress Token address
     * @param recipient Refund recipient
     */
    function refund(
        uint256 tradeId,
        address tokenAddress,
        address recipient
    ) external;

    /**
     * @notice Calculate fees for a given amount
     * @param amount Amount to calculate fees for
     * @param includeArbitrator Whether to include arbitrator fee
     * @return fees Fee distribution structure
     */
    function calculateFees(
        uint256 amount,
        bool includeArbitrator
    ) external view returns (FeeDistribution memory fees);

    /**
     * @notice Get escrow balance for a trade
     * @param tradeId The trade ID
     * @return balance The escrow balance
     */
    function getBalance(uint256 tradeId) external view returns (uint256 balance);

    /**
     * @notice Check if trade has escrow funded
     * @param tradeId The trade ID
     * @return funded Whether escrow is funded
     */
    function isFunded(uint256 tradeId) external view returns (bool funded);

    /**
     * @notice Emergency withdrawal by admin (with timelock)
     * @param tradeId The trade ID
     * @param tokenAddress Token address
     * @param recipient Recipient address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        uint256 tradeId,
        address tokenAddress,
        address recipient,
        uint256 amount
    ) external;
}