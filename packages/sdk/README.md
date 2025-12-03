# @localmoney/sdk

TypeScript SDK for the LocalMoney Solana Protocol - a decentralized P2P trading platform.

## Installation

```bash
npm install @localmoney/sdk
# or
yarn add @localmoney/sdk
# or
pnpm add @localmoney/sdk
```

## Quick Start

```typescript
import { Connection } from "@solana/web3.js";
import { LocalMoneyClient, DEVNET_CONFIG } from "@localmoney/sdk";

// Create a read-only client
const connection = new Connection("https://api.devnet.solana.com");
const client = LocalMoneyClient.create({
  config: DEVNET_CONFIG,
  connection,
});

// Fetch active offers
const offers = await client.offer.getActiveOffers();

// Connect a wallet for write operations
client.setWallet(walletAdapter);

// Create a profile
await client.profile.createProfile({
  contactInfo: "telegram:@username",
  encryptionKey: myPublicKey,
});
```

## Features

- **Type-safe**: Full TypeScript support with generated types from Anchor IDL
- **Read-only mode**: Query protocol state without a connected wallet
- **Wallet integration**: Compatible with @solana/wallet-adapter
- **All programs**: Complete coverage of all 7 LocalMoney programs
- **High-level methods**: Convenient orchestration for common workflows
- **Utilities**: PDA derivation, fee calculation, formatting helpers

## Program Clients

### Hub Client

Central configuration management for the protocol.

```typescript
// Check protocol status
const config = await client.hub.getConfig();
const fees = await client.hub.getFees();
const limits = await client.hub.getTradingLimits();
const breakers = await client.hub.getCircuitBreakers();

// Admin operations
await client.hub.initialize(params);
await client.hub.updateConfig({ burnFeePct: 50 });
await client.hub.setCircuitBreaker({ globalPause: true });
```

### Profile Client

User profile and reputation management.

```typescript
// Query profiles
const profile = await client.profile.getProfile(userPubkey);
const hasProfile = await client.profile.hasProfile(userPubkey);
const stats = await client.profile.getTradingStats(userPubkey);
const reputation = await client.profile.getReputationPercent(userPubkey);

// Create and update
await client.profile.createProfile({
  contactInfo: "email@example.com",
  encryptionKey: publicKey,
});
await client.profile.updateContact({ contactInfo: "new@example.com" });
```

### Offer Client

Marketplace listing management.

```typescript
import { OfferType, OfferState } from "@localmoney/sdk";

// Search offers
const activeOffers = await client.offer.getActiveOffers();
const myOffers = await client.offer.getOffersByOwner(myPubkey);
const results = await client.offer.searchOffers({
  offerType: OfferType.Sell,
  fiatCurrency: "USD",
  minAmount: new BN(100_000000),
});

// Create and manage offers
const { offerId } = await client.offer.createOffer({
  offerType: OfferType.Sell,
  fiatCurrency: "USD",
  tokenMint: USDC_MINT,
  minAmount: new BN(10_000000),
  maxAmount: new BN(1000_000000),
  rate: new BN(100), // 1.00 USD
  description: "Fast trades, Zelle/Venmo accepted",
});

await client.offer.pauseOffer(offerId);
await client.offer.resumeOffer(offerId);
await client.offer.deleteOffer(offerId);
```

### Trade Client

P2P trade lifecycle management.

```typescript
import { TradeState } from "@localmoney/sdk";

// Create a trade
const { tradeId } = await client.trade.createTrade({
  offerId: new BN(1),
  amount: new BN(100_000000),
  fiatAmount: new BN(10000), // $100.00 in cents
  buyerContact: "telegram:@buyer",
  tokenMint: USDC_MINT,
});

// Trade lifecycle
await client.trade.acceptTrade(tradeId, { sellerContact: "telegram:@seller" });
await client.trade.fundEscrow(tradeId, USDC_MINT);
await client.trade.confirmFiatDeposit(tradeId);
await client.trade.releaseEscrow(tradeId, USDC_MINT, ...tokenAccounts);

// Query trades
const trade = await client.trade.getTrade(tradeId);
const activeTrades = await client.trade.getActiveTrades(userPubkey);
const buyerTrades = await client.trade.getTradesByBuyer(userPubkey);
```

### Arbitrator Client

Dispute resolution management.

```typescript
import { DisputeResolution } from "@localmoney/sdk";

// Query arbitrators
const arbitrators = await client.arbitrator.getActiveArbitrators();
const usdArbitrators = await client.arbitrator.getArbitratorsByFiatCurrency("USD");
const pendingDisputes = await client.arbitrator.getPendingDisputes();

// Initiate and resolve disputes
await client.trade.initiateDispute(tradeId, arbitratorPubkey);
await client.arbitrator.submitEvidence(tradeId, { evidence: "Payment proof attached" });
await client.arbitrator.resolveDispute(tradeId, DisputeResolution.BuyerWins, "USD");
```

### Price Oracle Client

Fiat exchange rate management.

```typescript
// Get prices
const price = await client.priceOracle.getPrice("USD");
const { price: priceAccount, isStale } = await client.priceOracle.getPriceWithValidation("USD");
const allPrices = await client.priceOracle.getAllPrices();

// Currency conversion
const fiatAmount = await client.priceOracle.convertToFiat(tokenAmount, "USD");
const tokenAmount = await client.priceOracle.convertFromFiat(fiatCents, "USD");

// Provider management (admin)
await client.priceOracle.registerProvider(providerPubkey);
await client.priceOracle.updatePrice("USD", new BN(100_000000)); // $1.00 with 8 decimals
```

## High-Level Methods

The main client provides convenient orchestration methods:

```typescript
// Ensure profile exists
await client.ensureProfile({
  contactInfo: "telegram:@user",
  encryptionKey: publicKey,
});

// Create offer with automatic profile creation
const { offerId } = await client.createNewOffer({
  profile: { contactInfo: "email@example.com", encryptionKey: publicKey },
  offerType: OfferType.Sell,
  fiatCurrency: "USD",
  tokenMint: USDC_MINT,
  minAmount: new BN(10_000000),
  maxAmount: new BN(1000_000000),
  rate: new BN(100),
  description: "Fast trades",
});

// Get protocol status
const status = await client.getProtocolStatus();

// Search marketplace
const offers = await client.searchMarketplace({
  offerType: OfferType.Buy,
  fiatCurrency: "USD",
});

// Get user activity
const activity = await client.getUserActivity(userPubkey);
```

## Utilities

### PDA Derivation

```typescript
import {
  getHubConfigPDA,
  getProfilePDA,
  getOfferPDA,
  getTradePDA,
  getEscrowVaultPDA,
  getArbitratorPDA,
  getDisputePDA,
  getPricePDA,
} from "@localmoney/sdk";

const [profilePda, bump] = getProfilePDA(userPubkey, programId);
const [tradePda] = getTradePDA(tradeId, programId);
```

### Formatting

```typescript
import {
  formatTokenAmount,
  formatFiatAmount,
  formatPercentage,
  shortenAddress,
  toTokenLamports,
  fromTokenLamports,
  calculateFee,
} from "@localmoney/sdk";

formatTokenAmount(1000000, 6); // "1.000000"
formatFiatAmount(10050); // "$100.50"
formatPercentage(250); // "2.50%"
shortenAddress(publicKey); // "ABC1...XYZ9"
```

### Validation

```typescript
import {
  isValidPublicKey,
  isValidContactInfo,
  isValidFiatCurrency,
  isValidOfferRange,
  isAmountInRange,
} from "@localmoney/sdk";

isValidContactInfo("telegram:@user"); // true
isValidFiatCurrency("USD"); // true
```

## Error Handling

```typescript
import { LocalMoneyError, LocalMoneyErrorCode, isLocalMoneyError } from "@localmoney/sdk";

try {
  await client.trade.createTrade(params);
} catch (error) {
  if (isLocalMoneyError(error, LocalMoneyErrorCode.WALLET_NOT_CONNECTED)) {
    // Handle wallet not connected
  } else if (isLocalMoneyError(error)) {
    console.log(error.code, error.message, error.logs);
  }
}
```

## Configuration

```typescript
import { DEVNET_CONFIG, LOCALNET_CONFIG, createNetworkConfig } from "@localmoney/sdk";

// Use predefined configs
const client = LocalMoneyClient.create({
  config: DEVNET_CONFIG,
  connection,
});

// Or create custom config
const customConfig = createNetworkConfig(
  "https://my-rpc.com",
  hubProgramId,
  profileProgramId,
  // ... other program IDs
);
```

## Trade State Machine

```
RequestCreated -> RequestAccepted -> EscrowFunded -> FiatDeposited -> EscrowReleased
                        |                                  |
                        v                                  v
                  RequestCanceled                     Disputed -> DisputeResolved
                        |
                        v
                  RequestExpired
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm run test

# Type check
npm run typecheck

# Lint
npm run lint
```

## License

MIT
