// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IOffer
 * @notice Interface for the Offer contract that manages P2P trading offers
 * @dev Complete interface for offer creation, management, and querying
 */
interface IOffer {
    enum OfferType { Buy, Sell }
    enum OfferState { Active, Paused, Archived }

    struct OfferData {
        uint256 id;
        address owner;
        OfferType offerType;
        OfferState state;
        string fiatCurrency;
        address tokenAddress;
        uint256 minAmount;
        uint256 maxAmount;
        uint256 rate;
        string description;
        uint256 createdAt;
        uint256 updatedAt;
    }

    // Events
    event OfferCreated(uint256 indexed offerId, address indexed owner, OfferType offerType);
    event OfferUpdated(uint256 indexed offerId, OfferState newState);
    event OfferArchived(uint256 indexed offerId, address indexed owner);
    event OfferStateChanged(uint256 indexed offerId, OfferState indexed oldState, OfferState indexed newState);
    event OfferRateUpdated(uint256 indexed offerId, uint256 oldRate, uint256 newRate);
    event OfferAmountsUpdated(uint256 indexed offerId, uint256 oldMin, uint256 oldMax, uint256 newMin, uint256 newMax);
    event OfferDescriptionUpdated(uint256 indexed offerId, string newDescription);

    // Custom errors (defined in implementation)

    // Core offer management functions
    function createOffer(
        OfferType _type,
        string memory _fiatCurrency,
        address _token,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _rate,
        string memory _description
    ) external returns (uint256);

    function updateOffer(
        uint256 _offerId,
        OfferState _newState,
        uint256 _newRate,
        uint256 _newMin,
        uint256 _newMax
    ) external;

    function pauseOffer(uint256 _offerId) external;
    function activateOffer(uint256 _offerId) external;
    function archiveOffer(uint256 _offerId) external;
    function updateOfferDescription(uint256 _offerId, string memory _newDescription) external;

    // Query functions with pagination
    function getOffersByType(
        OfferType _type,
        string memory _fiatCurrency,
        address _token,
        uint256 _offset,
        uint256 _limit
    ) external view returns (OfferData[] memory results, uint256 total);

    function getUserOffers(
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (OfferData[] memory results, uint256 total);

    function getOffer(uint256 _offerId) external view returns (OfferData memory);
    function getUserActiveOfferCount(address _user) external view returns (uint256);

    // Compatibility functions for basic interface
    function updateOfferState(uint256 _offerId, OfferState _newState) external;
    function getUserOffers(address _user) external view returns (uint256[] memory);
}