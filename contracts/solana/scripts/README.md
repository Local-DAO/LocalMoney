# E2E Trade Lifecycle Test Script

This directory contains the end-to-end test script for the LocalMoney protocol on Solana.

## Overview

The `e2e-trade-lifecycle.ts` script executes a complete trade lifecycle on Solana local devnet, validates all program interactions, measures performance metrics, and generates a detailed HTML test report.

## Features

- ✅ **Complete Trade Lifecycle**: Executes all 9 steps from profile creation to escrow release
- 📊 **Performance Metrics**: Measures compute units for every transaction
- 📈 **HTML Reports**: Generates beautiful, detailed reports with charts
- 🔍 **Validation**: Validates all state transitions and balance changes
- 🎨 **Colored Console Output**: Clear, readable progress indicators
- ⚡ **Fast Execution**: Typically completes in under 60 seconds

## Prerequisites

Before running the script, ensure you have:

1. **Local Solana Validator Running**:
   ```bash
   solana-test-validator
   ```

2. **Programs Deployed**: All 7 LocalMoney programs deployed to localnet:
   ```bash
   anchor build
   anchor deploy --provider.cluster localnet
   ```

3. **Dependencies Installed**:
   ```bash
   npm install
   ```

## Usage

### Basic Usage

Run the e2e test with default settings:

```bash
npm run e2e:trade
```

### View Report

Open the latest generated report:

```bash
npm run e2e:trade:report
```

Or manually open:

```bash
open reports/trade-lifecycle-latest.html
```

### Command Line Options

```bash
# Show help
npm run e2e:trade -- --help

# Enable verbose logging
npm run e2e:trade -- --verbose

# Use custom cluster URL
npm run e2e:trade -- --cluster http://localhost:8899

# Skip HTML report generation
npm run e2e:trade -- --skip-report
```

## What the Script Does

### Phase 1: Initialize Hub and Programs

1. **Initialize Hub**: Sets up the central configuration with fees, limits, and timers
2. **Initialize Offer Counter**: Creates the sequential offer ID counter
3. **Initialize Trade Counter**: Creates the sequential trade ID counter
4. **Initialize Price Oracle**: Sets up price provider registry
5. **Seed Prices**: Adds initial price feeds for USD, EUR, GBP
6. **Register Arbitrator**: Registers a USD arbitrator

### Phase 2: Execute Trade Lifecycle

1. **Create Profiles**: Creates profiles for buyer and seller
2. **Create Sell Offer**: Seller creates an offer to sell tokens
3. **Mint Tokens**: Mints test tokens to seller's account
4. **Create Trade Request**: Buyer creates a trade request
5. **Accept Trade**: Seller accepts the trade
6. **Fund Escrow**: Seller funds the escrow with tokens
7. **Confirm Fiat**: Buyer confirms fiat payment
8. **Release Escrow**: Escrow is released with fee distribution

## Fee Distribution

The script validates the following fee structure:

- **Burn Fee**: 0.5% (50 basis points)
- **Chain Fee**: 1.0% (100 basis points)
- **Warchest Fee**: 0.5% (50 basis points)
- **Total**: 2.0% (200 basis points)

For a 10 token trade:
- Burn: 0.05 tokens
- Chain: 0.10 tokens
- Warchest: 0.05 tokens
- Buyer receives: 9.80 tokens

## HTML Report Contents

The generated HTML report includes:

### Executive Summary
- Overall pass/fail status
- Total execution time
- Total compute units consumed
- Total fees paid
- Steps passed/failed count

### Environment Information
- Cluster URL
- Token mint address
- All 7 program IDs

### Test Execution Timeline
- Each step with timestamp
- Duration and compute units
- Transaction signatures
- Pass/fail indicators

### Fee Distribution
- Breakdown by fee type
- Pie chart visualization

### Performance Metrics
- Compute units by instruction type
- Bar chart visualization
- Performance statistics

## Output Example

```
============================================================
  LocalMoney E2E Trade Lifecycle Test
============================================================

ℹ Validating environment...
✓ Connected to Solana cluster
ℹ Loading programs...
✓ Loaded 7 programs successfully
ℹ Airdropping SOL to test accounts...
✓ Airdropped SOL to 5 accounts
ℹ Creating test token...
✓ Test token created: 8zK3...

============================================================
  Phase 1: Initialize Hub and Programs
============================================================

✓ Initialize Hub (234ms, 15,432 CU)
✓ Initialize Offer Counter (187ms, 8,234 CU)
✓ Initialize Trade Counter (189ms, 8,245 CU)
✓ Initialize Price Oracle (245ms, 12,456 CU)
✓ Seed Price Feeds (312ms, 18,234 CU)
✓ Register Arbitrator (198ms, 9,876 CU)

============================================================
  Phase 2: Execute Trade Lifecycle
============================================================

📍 Step 1: Create user profiles
✓ Create Profile for 3Kx2... (234ms, 14,567 CU)
✓ Create Profile for 8zK3... (229ms, 14,532 CU)

📍 Step 2: Create sell offer
✓ Create Sell Offer (287ms, 19,234 CU)

... [continues for all steps]

============================================================
  Report Generation
============================================================

✓ HTML report generated: reports/trade-lifecycle-1700000000000.html
ℹ View latest report: reports/trade-lifecycle-latest.html

============================================================
  Test Summary
============================================================

✓ All 15 steps completed successfully
ℹ Total duration: 12.45s
ℹ Total compute units: 234,567
ℹ Total fees: 0.200000 tokens
ℹ Fee breakdown: burn=0.050000, chain=0.100000, warchest=0.050000
```

## Troubleshooting

### Error: "Failed to connect to Solana cluster"

**Solution**: Ensure the local validator is running:

```bash
# Terminal 1
solana-test-validator

# Terminal 2
npm run e2e:trade
```

### Error: "Programs not found"

**Solution**: Deploy programs to localnet:

```bash
anchor build
anchor deploy --provider.cluster localnet
```

### Error: "Airdrop failed"

**Solution**: The local validator may have rate limits. Wait a few seconds and try again.

### IDL Files Not Found

**Solution**: Build the programs to generate IDL files:

```bash
anchor build
```

## Performance Benchmarks

Typical performance on local validator:

- **Total Duration**: 10-15 seconds
- **Total Compute Units**: 200,000 - 300,000 CU
- **Peak Instruction CU**: ~50,000 CU (release escrow)
- **Report Generation**: <1 second
- **Report File Size**: 100-200 KB

## Development

### Modifying the Script

The script is organized into clear sections:

1. **Types and Interfaces**: Data structures for results
2. **Logging Utilities**: Colored console output
3. **PDA Derivation Helpers**: Account address derivation
4. **E2E Test Environment**: Main test class
5. **Initialization Functions**: Hub and program setup
6. **Trade Lifecycle Functions**: Step-by-step trade execution
7. **HTML Report Generation**: Report creation
8. **Main Execution**: Orchestrates the entire flow

### Adding New Test Scenarios

To add new test scenarios:

1. Create a new function following the pattern:
   ```typescript
   async function myNewStep(env: E2ETestEnvironment): Promise<StepResult> {
     return env.executeStep("My New Step", async () => {
       // Your logic here
       const signature = await ...;
       return { signature, data: {...} };
     });
   }
   ```

2. Add the step to the main execution flow

3. Update the HTML report template if needed

## License

MIT
