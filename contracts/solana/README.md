# LocalMoney Protocol - Solana Implementation

This repository contains the Solana implementation of the LocalMoney protocol, a peer-to-peer trading platform for exchanging crypto assets and fiat currencies.

## Project Structure

The project consists of five main programs:

- **Hub**: Central coordination program storing global configuration
- **Offer**: Manages buy/sell listings for crypto-to-fiat trades
- **Trade**: Handles escrow, trade lifecycle, and dispute resolution
- **Price**: Oracle integration for currency pricing
- **Profile**: User profile management and reputation data

## Prerequisites

- Solana CLI (v2.0.26+)
- Anchor Framework (v0.31.1+)
- Node.js (v16+)
- Yarn or npm

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build the programs:
   ```
   anchor build
   ```

## Running Tests

### Unit Tests

To run individual program unit tests:

```
npm run test:unit
```

### Integration Tests

Integration tests cover the complete trade lifecycle flows including:
- Full trade lifecycle (offer -> trade -> accept -> fund -> release)
- Cancellation flow
- Refund flow
- Dispute resolution

To run integration tests:

1. Make sure you have a local validator running in a separate terminal:
   ```
   solana-test-validator
   ```

2. Run the test environment setup script:
   ```
   npm run setup-test-env
   ```
   This will:
   - Check if the local validator is running
   - Create test keypairs
   - Airdrop SOL to test accounts
   - Build and deploy all programs

3. Run the integration tests:
   ```
   npm run test:integration
   ```

Or run the complete process with a single command:
```
npm run run-integration-tests
```

## Debugging Tests

If you encounter issues running the tests:

1. Check that all dependencies are properly installed
2. Make sure the local validator is running
3. Check the program IDs in Anchor.toml match the ones in .env
4. Run `anchor build` to rebuild the programs
5. Check the logs for specific errors

## Deployment

To deploy to localnet (for testing):

```
anchor deploy
```

For devnet or mainnet deployments, modify the provider.cluster in Anchor.toml accordingly.

## License

MIT 