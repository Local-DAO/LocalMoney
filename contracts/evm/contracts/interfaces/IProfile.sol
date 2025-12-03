// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IProfile
 * @notice Interface for the Profile contract that manages user profiles and reputation
 * @dev Profile contract handles user data, trading statistics, and contact information
 */
interface IProfile {
    /**
     * @notice User profile structure containing all user data
     * @dev Stores user trading history, contact info, and activity tracking
     */
    struct UserProfile {
        string encryptedContact;     // Encrypted contact information
        string publicKey;            // Public key for encryption
        uint256 tradesRequested;     // Total number of trades requested
        uint256 tradesCompleted;     // Total number of completed trades
        uint256 activeOffers;        // Current number of active offers
        uint256 activeTrades;        // Current number of active trades
        uint256 createdAt;           // Profile creation timestamp
        uint256 lastActivity;        // Last activity timestamp
    }

    // Events
    event ProfileUpdated(address indexed user);
    event ContactUpdated(address indexed user, string encryptedContact);
    event TradeStatsUpdated(address indexed user, uint256 requested, uint256 completed);
    event ActivityUpdated(address indexed user, uint256 activeOffers, uint256 activeTrades);

    // Custom errors
    error Unauthorized(address caller, address expected);
    error ProfileNotFound(address user);
    error InvalidContactData(string reason);
    error LimitExceeded(string limitType, uint256 current, uint256 max);

    /**
     * @notice Update user contact information
     * @param _contact Encrypted contact information
     * @param _publicKey Public key for encryption
     */
    function updateContact(string memory _contact, string memory _publicKey) external;

    /**
     * @notice Update user trade count (called by Trade contract)
     * @param _user User address
     * @param _completed Whether the trade was completed successfully
     */
    function updateTradeCount(address _user, bool _completed) external;

    /**
     * @notice Update active offers count (called by Offer contract)
     * @param _user User address
     * @param _delta Change in active offers count (can be negative)
     */
    function updateActiveOffers(address _user, int256 _delta) external;

    /**
     * @notice Update active trades count (called by Trade contract)
     * @param _user User address
     * @param _delta Change in active trades count (can be negative)
     */
    function updateActiveTrades(address _user, int256 _delta) external;

    /**
     * @notice Get user profile
     * @param _user User address
     * @return User profile data
     */
    function getProfile(address _user) external view returns (UserProfile memory);

    /**
     * @notice Check if user exists
     * @param _user User address
     * @return True if user profile exists
     */
    function profileExists(address _user) external view returns (bool);

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
    );

    /**
     * @notice Get user reputation score
     * @param _user User address
     * @return Reputation score (percentage based on completed vs requested trades)
     */
    function getReputationScore(address _user) external view returns (uint256);

    /**
     * @notice Check if user can create new offer
     * @param _user User address
     * @return True if user can create new offer
     */
    function canCreateOffer(address _user) external view returns (bool);

    /**
     * @notice Check if user can create new trade
     * @param _user User address
     * @return True if user can create new trade
     */
    function canCreateTrade(address _user) external view returns (bool);
}