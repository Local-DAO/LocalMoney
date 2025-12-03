// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ITrade.sol";
import "./interfaces/IHub.sol";
import "./interfaces/IOffer.sol";
import "./interfaces/IProfile.sol";
import "./interfaces/IEscrow.sol";
import "./interfaces/IArbitratorManager.sol";

/**
 * @title Trade
 * @notice Core Trade contract for LocalMoney EVM protocol
 * @dev Handles trade lifecycle from creation through escrow funding to completion
 * @author LocalMoney Protocol Team
 */
contract Trade is ITrade, Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // AUDIT FIX: Timestamp manipulation protection
    uint256 public constant TIMESTAMP_BUFFER = 900; // 15 minutes buffer for miner manipulation

    // Storage
    mapping(uint256 => TradeData) public trades;
    mapping(uint256 => StateTransitionRecord[]) public tradeHistory;
    uint256 public nextTradeId;
    
    IHub public hub;
    IOffer public offerContract;
    IProfile public profileContract;
    IEscrow public escrowContract;
    IArbitratorManager public arbitratorManager;
    
    // Dispute Management Storage
    mapping(uint256 => DisputeInfo) public disputes;
    
    // Storage gap for future upgrades
    uint256[48] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    struct StateTransitionRecord {
        TradeState fromState;
        TradeState toState;
        uint256 timestamp;
        address actor;
    }

    struct DisputeInfo {
        uint256 tradeId;
        address initiator;
        uint256 initiatedAt;
        address arbitrator;
        string buyerEvidence;
        string sellerEvidence;
        address winner;
        uint256 resolvedAt;
        string reason;
        bool isResolved;
    }

    // Custom errors
    error InvalidOffer(uint256 offerId);
    error OfferNotActive(uint256 offerId);
    error AmountOutOfRange(uint256 amount, uint256 min, uint256 max);
    error SelfTradeNotAllowed();
    error MaxActiveTradesReached(uint256 current, uint256 max);
    error TradeNotFound(uint256 tradeId);
    error UnauthorizedAccess(address caller);
    error InvalidStateTransition(TradeState current, TradeState requested);
    error TradeExpired(uint256 expiresAt);
    error IncorrectPaymentAmount(uint256 sent, uint256 required);
    error InsufficientEscrowBalance(uint256 tradeId);
    error SystemPaused();
    error InvalidTimestamp();
    
    // Dispute-related errors
    error DisputeNotFound(uint256 tradeId);
    error DisputeAlreadyExists(uint256 tradeId);
    error DisputeAlreadyResolved(uint256 tradeId);
    error InvalidDisputer(address caller);
    error OnlyArbitratorCanResolve(address caller);

    // Events (additional to ITrade interface)
    event StateTransitionEvent(uint256 indexed tradeId, TradeState from, TradeState to, address actor);
    event TradeExpiredByUser(uint256 indexed tradeId, address caller);
    event EscrowRefunded(uint256 indexed tradeId, uint256 amount, address recipient);
    event TradeCancelled(uint256 indexed tradeId, address caller);
    
    // Dispute Events
    event DisputeInitiated(uint256 indexed tradeId, address indexed initiator, string reason, uint256 timestamp);
    event EvidenceSubmitted(uint256 indexed tradeId, address indexed party, string evidence, uint256 timestamp);
    event DisputeResolvedEvent(uint256 indexed tradeId, address indexed winner, address indexed arbitrator, uint256 timestamp);

    // Modifiers
    modifier validTransition(uint256 _tradeId, TradeState _expectedState) {
        if (_tradeId == 0 || _tradeId >= nextTradeId) revert TradeNotFound(_tradeId);
        if (trades[_tradeId].state != _expectedState) {
            revert InvalidStateTransition(trades[_tradeId].state, _expectedState);
        }
        _;
    }

    modifier onlyTradeParty(uint256 _tradeId) {
        if (msg.sender != trades[_tradeId].buyer && msg.sender != trades[_tradeId].seller) {
            revert UnauthorizedAccess(msg.sender);
        }
        _;
    }

    modifier notExpired(uint256 _tradeId) {
        // AUDIT FIX: Add buffer to prevent timestamp manipulation attacks
        if (block.timestamp > trades[_tradeId].expiresAt + TIMESTAMP_BUFFER) {
            revert TradeExpired(trades[_tradeId].expiresAt);
        }
        _;
    }

    modifier whenNotPaused() {
        if (hub.isPaused()) revert SystemPaused();
        _;
    }

    /**
     * @notice Initialize the Trade contract
     * @param _hub Address of the Hub contract
     * @param _offerContract Address of the Offer contract
     * @param _profileContract Address of the Profile contract
     * @param _escrowContract Address of the Escrow contract
     * @param _arbitratorManager Address of the ArbitratorManager contract
     */
    function initialize(
        address _hub,
        address _offerContract,
        address _profileContract,
        address _escrowContract,
        address _arbitratorManager
    ) external initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        require(_hub != address(0), "Invalid hub address");
        require(_offerContract != address(0), "Invalid offer contract address");
        require(_profileContract != address(0), "Invalid profile contract address");
        // Allow zero addresses for escrow and arbitrator initially
        // require(_escrowContract != address(0), "Invalid escrow contract address");
        // require(_arbitratorManager != address(0), "Invalid arbitrator manager address");
        
        hub = IHub(_hub);
        offerContract = IOffer(_offerContract);
        profileContract = IProfile(_profileContract);
        if (_escrowContract != address(0)) {
            escrowContract = IEscrow(_escrowContract);
        }
        if (_arbitratorManager != address(0)) {
            arbitratorManager = IArbitratorManager(_arbitratorManager);
        }
        nextTradeId = 1; // Start from 1 to avoid confusion with 0
    }

    /**
     * @notice Create a new trade from an offer
     * @param _offerId Offer ID to create trade from
     * @param _amount Crypto amount to trade
     * @param _buyerContact Buyer's encrypted contact information
     * @return tradeId The created trade ID
     */
    function createTrade(
        uint256 _offerId,
        uint256 _amount,
        string memory _buyerContact
    ) external nonReentrant whenNotPaused returns (uint256) {
        // CHECKS: Cache external data first (read-only operations)
        IOffer.OfferData memory offer = offerContract.getOffer(_offerId);
        IHub.HubConfig memory config = hub.getConfig();
        
        // Validate offer
        if (offer.state != IOffer.OfferState.Active) revert OfferNotActive(_offerId);
        if (_amount < offer.minAmount || _amount > offer.maxAmount) {
            revert AmountOutOfRange(_amount, offer.minAmount, offer.maxAmount);
        }
        if (msg.sender == offer.owner) revert SelfTradeNotAllowed();
        
        // Check user limits
        if (!profileContract.canCreateTrade(msg.sender)) {
            revert MaxActiveTradesReached(0, config.maxActiveTrades);
        }
        
        // EFFECTS: Update state first
        uint256 tradeId = nextTradeId++;
        _createTradeData(tradeId, _offerId, _amount, _buyerContact);
        
        // Get trade reference for updates
        TradeData storage trade = trades[tradeId];
        
        // Record state transition
        _recordStateTransition(tradeId, TradeState.RequestCreated, TradeState.RequestCreated);
        
        // INTERACTIONS: External state-changing calls last
        // Update profiles
        profileContract.updateActiveTrades(trade.buyer, 1);
        profileContract.updateActiveTrades(trade.seller, 1);
        
        emit TradeCreated(tradeId, _offerId, trade.buyer);
        
        return tradeId;
    }
    
    /**
     * @notice Helper function to create trade data
     * @dev Separated to reduce stack depth in main function
     */
    function _createTradeData(
        uint256 _tradeId,
        uint256 _offerId,
        uint256 _amount,
        string memory _buyerContact
    ) private {
        IOffer.OfferData memory offer = offerContract.getOffer(_offerId);
        
        // Use storage pointer directly to avoid stack issues
        TradeData storage newTrade = trades[_tradeId];
        
        // Set common fields first
        newTrade.id = uint128(_tradeId);
        newTrade.offerId = uint128(_offerId);
        newTrade.tokenAddress = offer.tokenAddress;
        newTrade.amount = uint96(_amount);
        newTrade.fiatAmount = uint128((_amount * offer.rate) / 1e18);
        newTrade.fiatCurrency = offer.fiatCurrency;
        newTrade.rate = uint128(offer.rate);
        newTrade.state = TradeState.RequestCreated;
        newTrade.createdAt = uint32(block.timestamp);
        newTrade.expiresAt = uint32(block.timestamp + hub.getConfig().tradeExpirationTimer);
        newTrade.disputeDeadline = 0;
        newTrade.arbitrator = address(0);
        
        // Set role-specific fields
        if (offer.offerType == IOffer.OfferType.Buy) {
            // Maker wants to buy crypto, Taker sells
            newTrade.buyer = offer.owner;
            newTrade.seller = msg.sender;
            newTrade.buyerContact = "";
            newTrade.sellerContact = _buyerContact;
        } else {
            // Maker wants to sell crypto, Taker buys
            newTrade.buyer = msg.sender;
            newTrade.seller = offer.owner;
            newTrade.buyerContact = _buyerContact;
            newTrade.sellerContact = "";
        }
    }

    /**
     * @notice Accept a trade request (for makers)
     * @param _tradeId Trade ID to accept
     * @param _sellerContact Seller's encrypted contact information
     */
    function acceptTrade(
        uint256 _tradeId,
        string memory _sellerContact
    ) external 
        nonReentrant 
        whenNotPaused 
        validTransition(_tradeId, TradeState.RequestCreated)
        notExpired(_tradeId)
    {
        TradeData storage trade = trades[_tradeId];
        
        // Check authorization using storage directly
        {
            IOffer.OfferData memory offer = offerContract.getOffer(trade.offerId);
            if (msg.sender != offer.owner) {
                revert UnauthorizedAccess(msg.sender);
            }
            
            // Update contact based on offer type
            if (offer.offerType == IOffer.OfferType.Buy) {
                trade.buyerContact = _sellerContact; // Maker is buyer
            } else {
                trade.sellerContact = _sellerContact; // Maker is seller
            }
        }
        
        // Update trade state
        trade.state = TradeState.RequestAccepted;
        
        // Record state transition
        _recordStateTransition(_tradeId, TradeState.RequestCreated, TradeState.RequestAccepted);
        
        emit TradeAccepted(_tradeId, trade.seller);
    }

    /**
     * @notice Fund escrow (seller deposits crypto)
     * @param _tradeId Trade ID to fund
     */
    function fundEscrow(uint256 _tradeId) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        validTransition(_tradeId, TradeState.RequestAccepted)
        notExpired(_tradeId)
    {
        TradeData storage trade = trades[_tradeId];
        if (msg.sender != trade.seller) revert UnauthorizedAccess(msg.sender);
        
        // SECURITY FIX EXT-017: Apply Checks-Effects-Interactions pattern
        // EFFECTS: Update state BEFORE external calls
        TradeState previousState = trade.state;
        trade.state = TradeState.EscrowFunded;
        
        // Record state transition BEFORE external calls
        _recordStateTransition(_tradeId, previousState, TradeState.EscrowFunded);
        
        // INTERACTIONS: External calls AFTER state updates
        // Deposit to escrow contract
        if (trade.tokenAddress == address(0)) {
            // ETH payment
            if (msg.value != trade.amount) {
                revert IncorrectPaymentAmount(msg.value, trade.amount);
            }
            // SECURITY FIX AUTH-006: Pass address(this) as depositor since Trade contract is the msg.sender
            escrowContract.deposit{value: msg.value}(_tradeId, address(0), msg.value, address(this));
        } else {
            // ERC20 payment - first transfer to this contract, then to escrow
            if (msg.value != 0) revert IncorrectPaymentAmount(msg.value, 0);
            IERC20(trade.tokenAddress).safeTransferFrom(
                msg.sender,
                address(this),
                trade.amount
            );
            IERC20(trade.tokenAddress).safeIncreaseAllowance(address(escrowContract), trade.amount);
            // SECURITY FIX AUTH-006: Pass address(this) as depositor since Trade contract holds the tokens
            escrowContract.deposit(_tradeId, trade.tokenAddress, trade.amount, address(this));
        }
        
        emit EscrowFunded(_tradeId, trade.amount);
    }

    /**
     * @notice Mark fiat as deposited (buyer confirms fiat sent)
     * @param _tradeId Trade ID
     */
    function markFiatDeposited(uint256 _tradeId)
        external
        nonReentrant
        whenNotPaused
        validTransition(_tradeId, TradeState.EscrowFunded)
    {
        TradeData storage trade = trades[_tradeId];
        if (msg.sender != trade.buyer) revert UnauthorizedAccess(msg.sender);
        
        // Update state and set dispute deadline
        trade.state = TradeState.FiatDeposited;
        IHub.HubConfig memory config = hub.getConfig();
        trade.disputeDeadline = uint32(block.timestamp + config.tradeDisputeTimer);
        
        // Record state transition
        _recordStateTransition(_tradeId, TradeState.EscrowFunded, TradeState.FiatDeposited);
        
        emit FiatDeposited(_tradeId, trade.buyer);
    }

    /**
     * @notice Release escrow to buyer (seller confirms fiat received)
     * @dev SECURITY FIX: CEI pattern applied - state updates before external calls
     * @param _tradeId Trade ID
     */
    function releaseEscrow(uint256 _tradeId)
        external
        nonReentrant
        whenNotPaused
        validTransition(_tradeId, TradeState.FiatDeposited)
    {
        // CHECKS - all validations
        TradeData storage trade = trades[_tradeId];
        if (msg.sender != trade.seller) revert UnauthorizedAccess(msg.sender);
        
        // EFFECTS - state updates FIRST
        trade.state = TradeState.EscrowReleased;
        
        // Record state transition before external calls
        _recordStateTransition(_tradeId, TradeState.FiatDeposited, TradeState.EscrowReleased);
        
        // INTERACTIONS - external calls LAST
        // Release funds from escrow contract
        uint256 netAmount = escrowContract.release(
            _tradeId,
            trade.tokenAddress,
            trade.buyer,
            address(0) // No arbitrator
        );
        
        // Update profiles
        profileContract.updateActiveTrades(trade.buyer, -1);
        profileContract.updateActiveTrades(trade.seller, -1);
        profileContract.updateTradeCount(trade.buyer, true);
        profileContract.updateTradeCount(trade.seller, true);
        
        // Events at the very end
        emit EscrowReleased(_tradeId, netAmount);
    }

    /**
     * @notice Cancel a trade request
     * @dev SECURITY FIX: CEI pattern applied - state updates before external calls
     * @param _tradeId Trade ID to cancel
     */
    function cancelTrade(uint256 _tradeId) external nonReentrant onlyTradeParty(_tradeId) {
        // CHECKS - all validations
        TradeData storage trade = trades[_tradeId];
        TradeState currentState = trade.state;
        
        // Allow cancellation in specific states
        if (!(currentState == TradeState.RequestCreated || 
              currentState == TradeState.RequestAccepted ||
              (currentState == TradeState.EscrowFunded && msg.sender == trade.buyer))) {
            revert InvalidStateTransition(currentState, TradeState.EscrowCancelled);
        }
        
        // EFFECTS - state updates FIRST
        TradeState newState = TradeState.EscrowCancelled;
        trade.state = newState;
        
        // Record state transition before external calls
        _recordStateTransition(_tradeId, currentState, newState);
        
        // INTERACTIONS - external calls LAST
        // Refund if escrow was funded
        if (currentState == TradeState.EscrowFunded) {
            escrowContract.refund(_tradeId, trade.tokenAddress, trade.seller);
            emit EscrowRefunded(_tradeId, trade.amount, trade.seller);
        }
        
        // Update profiles
        profileContract.updateActiveTrades(trade.buyer, -1);
        profileContract.updateActiveTrades(trade.seller, -1);
        
        // Events at the very end
        emit TradeCancelled(_tradeId, msg.sender);
    }

    /**
     * @notice Refund expired trade
     * @dev SECURITY FIX: CEI pattern applied - state updates before external calls
     * @param _tradeId Trade ID to refund
     */
    function refundExpiredTrade(uint256 _tradeId) external nonReentrant {
        // CHECKS - all validations
        TradeData storage trade = trades[_tradeId];
        
        // Only allow refund for funded trades that have expired
        if (trade.state != TradeState.EscrowFunded) {
            revert InvalidStateTransition(trade.state, TradeState.EscrowRefunded);
        }
        // AUDIT FIX: Add buffer to ensure trade is truly expired, not within manipulation window
        if (block.timestamp <= trade.expiresAt + TIMESTAMP_BUFFER) {
            revert InvalidTimestamp();
        }
        
        // EFFECTS - state updates FIRST
        trade.state = TradeState.EscrowRefunded;
        
        // Record state transition before external calls
        _recordStateTransition(_tradeId, TradeState.EscrowFunded, TradeState.EscrowRefunded);
        
        // INTERACTIONS - external calls LAST
        // Refund from escrow contract
        escrowContract.refund(_tradeId, trade.tokenAddress, trade.seller);
        
        // Update profiles
        profileContract.updateActiveTrades(trade.buyer, -1);
        profileContract.updateActiveTrades(trade.seller, -1);
        
        // Events at the very end
        emit EscrowRefunded(_tradeId, trade.amount, trade.seller);
        emit TradeExpiredByUser(_tradeId, msg.sender);
    }

    // Phase 4: Dispute Management Functions
    
    /**
     * @notice Initiate a dispute for a trade
     * @dev SECURITY FIX: Strict CEI pattern - ALL critical state changes before external calls
     * @param _tradeId Trade ID to dispute
     * @param _reason Reason for the dispute
     */
    function disputeTrade(uint256 _tradeId, string memory _reason) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        // CHECKS: Validate all conditions first
        TradeData storage trade = trades[_tradeId];
        
        if (_tradeId == 0 || _tradeId >= nextTradeId) revert TradeNotFound(_tradeId);
        if (trade.state != TradeState.FiatDeposited) {
            revert InvalidStateTransition(trade.state, TradeState.EscrowDisputed);
        }
        if (msg.sender != trade.buyer && msg.sender != trade.seller) {
            revert InvalidDisputer(msg.sender);
        }
        if (disputes[_tradeId].initiatedAt != 0) {
            revert DisputeAlreadyExists(_tradeId);
        }
        if (block.timestamp > trade.disputeDeadline + TIMESTAMP_BUFFER) {
            revert TradeExpired(trade.disputeDeadline);
        }
        
        // Store needed data before state changes
        string memory fiatCurrency = trade.fiatCurrency;
        address disputeInitiator = msg.sender;
        
        // EFFECTS: Update ALL state BEFORE external calls (CEI pattern)
        // SECURITY FIX: All state changes must complete before external call to prevent reentrancy
        
        // 1. Mark trade as disputed
        trade.state = TradeState.EscrowDisputed;
        _recordStateTransition(_tradeId, TradeState.FiatDeposited, TradeState.EscrowDisputed);
        
        // 2. Initialize dispute with placeholder arbitrator
        // We'll update the arbitrator after the external call, but dispute is already created
        disputes[_tradeId] = DisputeInfo({
            tradeId: _tradeId,
            initiator: disputeInitiator,
            initiatedAt: block.timestamp,
            arbitrator: address(0), // Will be set after external call
            buyerEvidence: "",
            sellerEvidence: "",
            winner: address(0),
            resolvedAt: 0,
            reason: _reason,
            isResolved: false
        });
        
        // 3. Set a flag to prevent re-entry even if arbitratorManager is malicious
        // The trade is already in disputed state, preventing any other state transitions
        
        // INTERACTIONS: External call AFTER all critical state changes
        address assignedArbitrator = arbitratorManager.assignArbitrator(_tradeId, fiatCurrency);
        
        // POST-INTERACTION UPDATE: Safe to update arbitrator address
        // Even if this reverts due to reentrancy, the trade is already disputed
        require(assignedArbitrator != address(0), "Invalid arbitrator assigned");
        disputes[_tradeId].arbitrator = assignedArbitrator;
        trade.arbitrator = assignedArbitrator;
        
        // Events at the very end
        emit DisputeInitiated(_tradeId, disputeInitiator, _reason, block.timestamp);
        emit TradeDisputed(_tradeId, disputeInitiator);
    }
    
    // Helper function removed - integrated into disputeTrade for better CEI compliance
    
    /**
     * @notice Submit evidence for a dispute
     * @param _tradeId Trade ID
     * @param _evidence Evidence text (encrypted with arbitrator's key)
     */
    function submitEvidence(uint256 _tradeId, string memory _evidence) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        DisputeInfo storage dispute = disputes[_tradeId];
        
        // Validate dispute exists and is not resolved
        if (dispute.initiatedAt == 0) revert DisputeNotFound(_tradeId);
        if (dispute.isResolved) revert DisputeAlreadyResolved(_tradeId);
        
        // Check if caller is authorized using storage directly
        if (msg.sender != trades[_tradeId].buyer && msg.sender != trades[_tradeId].seller) {
            revert InvalidDisputer(msg.sender);
        }
        
        // Store evidence based on caller
        if (msg.sender == trades[_tradeId].buyer) {
            dispute.buyerEvidence = _evidence;
        } else {
            dispute.sellerEvidence = _evidence;
        }
        
        emit EvidenceSubmitted(_tradeId, msg.sender, _evidence, block.timestamp);
    }
    
    /**
     * @notice Resolve a dispute (only callable by assigned arbitrator)
     * @dev SECURITY FIX: CEI pattern applied - state updates before external calls
     * @param _tradeId Trade ID
     * @param _winner Winner of the dispute (buyer or seller)
     */
    function resolveDispute(uint256 _tradeId, address _winner) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        // CHECKS - all validations
        TradeData storage trade = trades[_tradeId];
        DisputeInfo storage dispute = disputes[_tradeId];
        
        // Validate dispute exists and is not resolved
        if (dispute.initiatedAt == 0) revert DisputeNotFound(_tradeId);
        if (dispute.isResolved) revert DisputeAlreadyResolved(_tradeId);
        
        // Check if caller is the assigned arbitrator
        if (msg.sender != dispute.arbitrator) {
            revert OnlyArbitratorCanResolve(msg.sender);
        }
        
        // Validate winner is either buyer or seller
        if (_winner != trade.buyer && _winner != trade.seller) {
            revert UnauthorizedAccess(_winner);
        }
        
        // EFFECTS - state updates FIRST
        dispute.winner = _winner;
        dispute.resolvedAt = block.timestamp;
        dispute.isResolved = true;
        trade.state = TradeState.DisputeResolved;
        
        // Record state transition before external calls
        _recordStateTransition(_tradeId, TradeState.EscrowDisputed, TradeState.DisputeResolved);
        
        // INTERACTIONS - external calls LAST
        // Update arbitrator reputation via ArbitratorManager
        arbitratorManager.updateArbitratorReputation(dispute.arbitrator, true);
        
        // Release funds from escrow with arbitrator fee
        // SECURITY FIX: Check return value from release function
        uint256 releasedAmount = escrowContract.release(
            _tradeId,
            trade.tokenAddress,
            _winner,
            dispute.arbitrator
        );
        require(releasedAmount > 0, "Escrow release failed");
        
        // Update profiles
        profileContract.updateActiveTrades(trade.buyer, -1);
        profileContract.updateActiveTrades(trade.seller, -1);
        profileContract.updateTradeCount(trade.buyer, _winner == trade.buyer);
        profileContract.updateTradeCount(trade.seller, _winner == trade.seller);
        
        // Events at the very end
        emit DisputeResolvedEvent(_tradeId, _winner, dispute.arbitrator, block.timestamp);
        emit DisputeResolved(_tradeId, _winner);
    }
    
    /**
     * @notice Get dispute information
     * @param _tradeId Trade ID
     * @return DisputeInfo struct
     */
    function getDisputeInfo(uint256 _tradeId) 
        external 
        view 
        returns (DisputeInfo memory) 
    {
        return disputes[_tradeId];
    }

    // View functions

    /**
     * @notice Get trade data
     * @param _tradeId Trade ID
     * @return Trade data
     */
    function getTrade(uint256 _tradeId) external view returns (TradeData memory) {
        if (_tradeId == 0 || _tradeId >= nextTradeId) revert TradeNotFound(_tradeId);
        return trades[_tradeId];
    }

    /**
     * @notice Calculate fees for a given amount
     * @param _amount Amount to calculate fees for
     * @return Fee distribution
     */
    function calculateFees(uint256 _amount) public view returns (IEscrow.FeeDistribution memory) {
        return escrowContract.calculateFees(_amount, false);
    }

    /**
     * @notice Get trades by user (buyer or seller)
     * @param user User address
     * @return userTrades Array of trade IDs where user is involved
     */
    function getTradesByUser(address user) external view returns (uint256[] memory) {
        uint256 count = 0;
        
        // First pass: count trades
        for (uint256 i = 1; i < nextTradeId; i++) {
            if (trades[i].buyer == user || trades[i].seller == user) {
                count++;
            }
        }
        
        // Second pass: collect trade IDs
        uint256[] memory userTrades = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextTradeId; i++) {
            if (trades[i].buyer == user || trades[i].seller == user) {
                userTrades[index] = i;
                index++;
            }
        }
        
        return userTrades;
    }

    /**
     * @notice Get active trades by user
     * @param user User address
     * @return activeTrades Array of trade IDs that are currently active
     */
    function getActiveTradesByUser(address user) external view returns (uint256[] memory) {
        uint256 count = 0;
        
        // First pass: count active trades
        for (uint256 i = 1; i < nextTradeId; i++) {
            if ((trades[i].buyer == user || trades[i].seller == user) &&
                (trades[i].state == TradeState.RequestCreated || 
                 trades[i].state == TradeState.RequestAccepted ||
                 trades[i].state == TradeState.EscrowFunded ||
                 trades[i].state == TradeState.FiatDeposited)) {
                count++;
            }
        }
        
        // Second pass: collect trade IDs
        uint256[] memory activeTrades = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextTradeId; i++) {
            if ((trades[i].buyer == user || trades[i].seller == user) &&
                (trades[i].state == TradeState.RequestCreated || 
                 trades[i].state == TradeState.RequestAccepted ||
                 trades[i].state == TradeState.EscrowFunded ||
                 trades[i].state == TradeState.FiatDeposited)) {
                activeTrades[index] = i;
                index++;
            }
        }
        
        return activeTrades;
    }

    /**
     * @notice Get trade history
     * @param _tradeId Trade ID
     * @return History of state transitions for the trade
     */
    function getTradeHistory(uint256 _tradeId) external view returns (StateTransitionRecord[] memory) {
        if (_tradeId == 0 || _tradeId >= nextTradeId) revert TradeNotFound(_tradeId);
        return tradeHistory[_tradeId];
    }

    /**
     * @notice Check if user can create more trades
     * @param user User address
     * @return canCreate Whether user can create more trades
     */
    function canUserCreateTrade(address user) external view returns (bool) {
        IHub.HubConfig memory config = hub.getConfig();
        uint256 activeCount = 0;
        
        for (uint256 i = 1; i < nextTradeId; i++) {
            if ((trades[i].buyer == user || trades[i].seller == user) &&
                (trades[i].state == TradeState.RequestCreated || 
                 trades[i].state == TradeState.RequestAccepted ||
                 trades[i].state == TradeState.EscrowFunded ||
                 trades[i].state == TradeState.FiatDeposited)) {
                activeCount++;
            }
        }
        
        return activeCount < config.maxActiveTrades;
    }

    // Internal functions

    /**
     * @notice Record state transition
     * @param _tradeId Trade ID
     * @param _from Previous state
     * @param _to New state
     */
    function _recordStateTransition(
        uint256 _tradeId,
        TradeState _from,
        TradeState _to
    ) internal {
        tradeHistory[_tradeId].push(StateTransitionRecord({
            fromState: _from,
            toState: _to,
            timestamp: block.timestamp,
            actor: msg.sender
        }));
        
        emit StateTransitionEvent(_tradeId, _from, _to, msg.sender);
    }


    /**
     * @notice Update escrow contract address (admin only)
     * @dev Used to set escrow address after deployment to resolve circular dependencies
     * @param _escrowContract New escrow contract address
     */
    function setEscrowContract(address _escrowContract) external {
        require(msg.sender == hub.getAdmin(), "Only admin can update escrow");
        require(_escrowContract != address(0), "Invalid escrow address");
        require(address(escrowContract) == address(0), "Escrow already set");
        escrowContract = IEscrow(_escrowContract);
        emit ContractAddressUpdated("Escrow", _escrowContract);
    }

    /**
     * @notice Update arbitrator manager contract address (admin only)
     * @dev Used to set arbitrator manager address after deployment to resolve circular dependencies
     * @param _arbitratorManager New arbitrator manager contract address
     */
    function setArbitratorManager(address _arbitratorManager) external {
        require(msg.sender == hub.getAdmin(), "Only admin can update arbitrator");
        require(_arbitratorManager != address(0), "Invalid arbitrator address");
        require(address(arbitratorManager) == address(0), "Arbitrator already set");
        arbitratorManager = IArbitratorManager(_arbitratorManager);
        emit ContractAddressUpdated("ArbitratorManager", _arbitratorManager);
    }

    // Event for contract address updates
    event ContractAddressUpdated(string contractName, address newAddress);

    /**
     * @notice Authorize upgrade (UUPS pattern)
     * @dev SECURITY FIX: Added timelock requirement via Hub
     * @dev SECURITY FIX UPG-003: Strict timelock enforcement - no admin bypass
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal view override {
        // SECURITY FIX UPG-003: Strict validation
        require(newImplementation != address(0), "Invalid implementation");
        require(newImplementation != address(this), "Cannot upgrade to same implementation");
        
        // SECURITY FIX UPG-003: Only timelock can authorize upgrades
        // The Hub's isUpgradeAuthorized now enforces strict timelock requirements
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