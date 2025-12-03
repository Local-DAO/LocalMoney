# LocalMoney Protocol Specification

## Overview

LocalMoney is a decentralized peer-to-peer (P2P) trading protocol that facilitates secure fiat-to-cryptocurrency exchanges through an escrow mechanism with integrated dispute resolution. The protocol consists of five interconnected smart contracts that manage the complete trading lifecycle from offer creation to settlement.

## Architecture

### Core Components

1. **Hub Contract** - Central orchestrator and configuration manager
2. **Offer Contract** - Manages buy/sell offer creation and lifecycle
3. **Trade Contract** - Handles escrow, trading execution, and dispute resolution
4. **Profile Contract** - User profile management and reputation tracking
5. **Price Contract** - Oracle price feeds and fiat conversion rates

## Detailed Contract Specifications

### 1. Hub Contract

**Purpose**: Central configuration and coordination hub for all other contracts.

**Key Functions**:
- `UpdateConfig` - Updates protocol configuration including fee percentages, limits, and contract addresses
- `UpdateAdmin` - Changes administrative control
- `RegisterHub` - Registration mechanism for other contracts

**State**:
- `HubConfig` - Global protocol configuration
  - Contract addresses for all 5 programs
  - Fee percentages (burn, chain, warchest)
  - Trading limits (min/max USD amounts)
  - Timer configurations (expiration, dispute)
  - Active offer/trade limits per user
- `Admin` - Administrative address with configuration privileges

**Governance Parameters**:
- Platform fees (burn + chain + warchest) capped at 10%
- Trade expiration timer (max configurable)
- Dispute resolution timer (max configurable)
- Active trading limits per user

### 2. Offer Contract

**Purpose**: Manages the creation, updating, and lifecycle of trading offers.

**Key Functions**:
- `Create` - Creates new buy/sell offers with pricing and constraints
- `UpdateOffer` - Modifies existing offer parameters (price, limits, state)
- `RegisterHub` - Links to hub contract for configuration access

**State**:
- `Offer` records with sequential IDs
  - Owner address
  - Offer type (Buy/Sell)
  - Fiat currency and rate
  - Token denomination and amount constraints
  - State (Active/Paused/Archive)
  - Creation timestamp
- `OffersCount` - Global counter for sequential ID generation

**Query Interface**:
- Paginated offer listings by type, currency, denomination
- Individual offer lookup by ID
- User-specific offer history

**Business Logic**:
- Validates min ≤ max amount constraints
- Integrates with Profile contract for contact information
- Tracks offer state changes for profile statistics

### 3. Trade Contract

**Purpose**: Core trading engine handling escrow, state transitions, and dispute resolution.

**Key Functions**:
- `Create` - Initiates trades based on existing offers
- `AcceptRequest` - Maker accepts trade request
- `FundEscrow` - Deposits cryptocurrency into escrow
- `FiatDeposited` - Buyer confirms fiat payment
- `ReleaseEscrow` - Releases funds to buyer upon completion
- `RefundEscrow` - Returns funds in case of cancellation/expiration
- `DisputeEscrow` - Initiates dispute resolution process
- `SettleDispute` - Arbitrator resolves disputed trades

**State Management**:
- `Trade` records with comprehensive state tracking
  - Buyer/seller addresses and contact information
  - Escrow amount and denomination
  - Price locked at trade creation
  - State history with timestamps
  - Expiration and dispute timers
- `Arbitrator` registry with fiat currency specialization
- Conversion routes for multi-token fee burning

**Trade States**:
1. `RequestCreated` - Initial trade request
2. `RequestAccepted` - Maker accepts the trade
3. `EscrowFunded` - Cryptocurrency locked in escrow
4. `FiatDeposited` - Buyer marks fiat as sent
5. `EscrowReleased` - Successful completion
6. `EscrowDisputed` - Dispute initiated
7. Various cancellation/refund states

**Fee Structure**:
- Burn fee (converted to LOCAL token and burned)
- Chain fee (revenue sharing)
- Warchest fee (protocol treasury)
- Arbitration fee (paid to dispute resolvers)

**Arbitration System**:
- Random arbitrator selection from fiat-specific pools
- Dispute initiation with time delays
- Winner determination by arbitrators
- Fee distribution for dispute resolution

### 4. Profile Contract

**Purpose**: User profile management, reputation tracking, and trading statistics.

**Key Functions**:
- `UpdateContact` - Updates user contact information and encryption keys
- `UpdateTradesCount` - Tracks trading activity and reputation
- `UpdateActiveOffers` - Monitors active offer counts

**State**:
- `Profile` records per user address
  - Contact information (encrypted)
  - Public encryption keys for secure communication
  - Trading statistics (requested, released, active counts)
  - Account creation timestamp
  - Last trading activity timestamp

**Integration Points**:
- Called by Offer contract for contact updates
- Called by Trade contract for reputation tracking
- Enforces limits on active offers/trades per user

### 5. Price Contract

**Purpose**: Price oracle for fiat currency rates and cryptocurrency pricing.

**Key Functions**:
- `UpdatePrices` - Updates fiat currency prices (USD denominated)
- `RegisterPriceRouteForDenom` - Configures price discovery routes for tokens
- `Query Price` - Returns current fiat price for given denomination

**State**:
- `FiatPrice` mapping (currency → USD price with timestamp)
- `DenomPriceRoute` mapping (token → swap route configuration)

**Price Discovery**:
- External price feeds for fiat currencies
- DEX integration for cryptocurrency pricing
- Currently supports LUNA/USDC price discovery via DEX queries

## Protocol Flow

### Typical Trading Flow

1. **Offer Creation**
   - User creates buy/sell offer specifying amount, price, fiat currency
   - Offer contract validates constraints and stores offer
   - Profile contract updates user contact information

2. **Trade Initiation**
   - Taker accepts existing offer, creating trade request
   - Trade contract validates amounts within offer limits
   - USD value validation against protocol trading limits
   - Random arbitrator assignment for potential disputes

3. **Trade Acceptance & Funding**
   - Maker accepts trade request (for buy offers)
   - Seller funds escrow with cryptocurrency + fees
   - Price locked at current oracle rates

4. **Fiat Exchange**
   - Buyer sends fiat payment off-chain
   - Buyer marks fiat as deposited on-chain
   - Dispute timer becomes active

5. **Completion**
   - Seller releases escrow after confirming fiat receipt
   - Protocol fees deducted and distributed
   - User profiles updated with successful trade statistics

### Dispute Resolution Flow

1. **Dispute Initiation**
   - Either party can dispute after fiat deposit confirmation
   - Requires waiting period before dispute can be opened
   - Arbitrator receives encrypted contact information for both parties

2. **Arbitrator Decision**
   - Arbitrator investigates off-chain evidence
   - Determines winner (maker or taker)
   - Executes settlement with fee distribution

## Security Features

### Access Controls
- Multi-contract authorization (only hub, trade, or offer contracts can update profiles)
- Time-based restrictions (expiration timers, dispute delays)
- Amount validations and limit enforcement

### Economic Security
- Escrow mechanism protects funds during trading
- Fee structures incentivize honest behavior
- Arbitration costs deter frivolous disputes

### Operational Security
- Encrypted communication channels via public keys
- State machine with strict transition validation
- Comprehensive audit trails in state history

## Technical Specifications

### Data Types
- **Addresses**: CosmWasm Addr type for account identification
- **Amounts**: Uint128 for token amounts, Uint256 for price calculations
- **Decimals**: Percentage-based fee calculations with precision
- **Timestamps**: Unix timestamp (u64) for all time-based operations

### Storage Patterns
- Indexed maps for efficient querying (trades by user, arbitrators by fiat)
- Sequential ID generation for offers and trades
- State versioning for contract upgrades

### Integration Points
- CW20 token standard compatibility
- DEX integration for price discovery
- Cross-contract message passing for coordinated state updates

## Configuration Parameters

### Fees (Configurable via Hub)
- Maximum total platform fee: 10%
- Burn fee percentage
- Chain fee percentage  
- Warchest fee percentage
- Arbitration fee percentage

### Limits (Configurable via Hub)
- Minimum/maximum USD trade amounts
- Active offers per user
- Active trades per user
- Trade expiration timer
- Dispute resolution timer

### Addresses (Configurable via Hub)
- All contract addresses
- Price provider address
- Fee collection addresses
- Local market address

This specification provides the foundation for a secure, decentralized P2P trading protocol with built-in dispute resolution and comprehensive state management.