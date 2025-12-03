# LocalMoney Protocol - Solana Implementation

## Overview

LocalMoney P2P trading protocol implemented on Solana using the Anchor framework. This implementation translates the existing EVM and CosmWasm contracts to Solana programs.

## Programs

1. **Hub** (`8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH`) - Central configuration and registry
2. **Profile** (`86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5`) - User reputation and statistics
3. **Offer** (`CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo`) - Marketplace listing management
4. **Trade** (`5fRDb9S3Z61fBALmDHNV5EH7GDP8gsCGkQT8eawDL1kE`) - Core P2P exchange logic
5. **Escrow** (`CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ`) - Token custody and release
6. **Arbitrator** (`J5BNGJ128bxHuWemwaoGkDqy8DVSvsA7o5kpdy9eDoNe`) - Dispute resolution system
7. **Price Oracle** (`CwWd4PCPx85fgREweU3UWWd6kxhtqRVd9xh2iVMT9Rbw`) - Fiat price feeds

## Prerequisites

### Required Installations

1. **Rust** (1.75+)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup component add rust-src
   ```

2. **Solana CLI** (1.18+) - Full toolchain with build tools
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/v1.18.20/install)"
   export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
   ```

   **Important**: Use the official Solana installer, not Homebrew, as the Homebrew version lacks `cargo-build-sbf`.

3. **Anchor CLI** (0.31.0+)
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install 0.31.0
   avm use 0.31.0
   ```

4. **Node.js** (18+) for TypeScript client
   ```bash
   npm install
   ```

### Verify Installation

```bash
solana --version        # Should be 1.18.20+
anchor --version        # Should be 0.31.0+
rustc --version         # Should be 1.75+
cargo build-sbf --help  # Should show help (confirms build tools installed)
```

## Development

### Build All Programs

```bash
anchor build
```

This will compile all 7 programs and generate their respective `.so` files in `target/deploy/`.

### Test

```bash
# Start local validator (in separate terminal)
solana-test-validator

# Run tests
anchor test --skip-local-validator
```

### Deploy to Localnet

```bash
anchor deploy
```

### Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

## Project Structure

```
contracts/solana/
├── Anchor.toml                 # Anchor workspace configuration
├── Cargo.toml                  # Rust workspace manifest
├── package.json                # TypeScript dependencies
├── tsconfig.json               # TypeScript configuration
├── programs/                   # Solana programs (smart contracts)
│   ├── hub/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs          # Program entry point
│   │       ├── instructions/   # Instruction handlers
│   │       ├── state/          # Account structures
│   │       └── errors.rs       # Custom errors
│   ├── profile/
│   ├── offer/
│   ├── trade/
│   ├── escrow/
│   ├── arbitrator/
│   └── price_oracle/
├── tests/                      # Integration tests
│   ├── hub.ts
│   ├── profile.ts
│   ├── integration/
│   └── utils/
├── migrations/                 # Deployment scripts
│   └── deploy.ts
└── target/                     # Build artifacts
    └── deploy/                 # Compiled .so files
```

## Architecture

### Key Differences from EVM/CosmWasm

| Aspect | EVM/CosmWasm | Solana |
|--------|--------------|--------|
| **Account Model** | Contract storage inside contract | Data in separate accounts owned by program |
| **Upgradability** | Proxy patterns | Built-in via `solana program deploy` |
| **Access Control** | Role-based modifiers | Signer checks + PDA ownership |
| **Token Standards** | ERC-20/CW20 | SPL Token / Token-2022 |
| **Fee Handling** | `msg.value` / Coin arrays | Explicit token account transfers via CPI |

### Program Derived Addresses (PDAs)

Programs use deterministic PDAs for account addressing:

- **Hub Config**: `[b"hub_config"]`
- **User Profile**: `[b"profile", user_pubkey]`
- **Offer**: `[b"offer", offer_id]`
- **Trade**: `[b"trade", trade_id]`
- **Escrow Vault**: `[b"escrow_vault", trade_id]`

### Cross-Program Invocations (CPIs)

Programs communicate via CPIs:
- Trade → Offer (verify offer status)
- Trade → Escrow (lock/release funds)
- Escrow → SPL Token (transfer tokens)
- All → Hub (read configuration)
- Offer/Trade → Profile (update statistics)

## Configuration

### Hub Configuration

The Hub program stores global configuration accessible to all programs:

- **Program Addresses**: Registry of all protocol programs
- **Fee Configuration**: Burn, chain, warchest, conversion, arbitration fees (basis points)
- **Trading Limits**: Min/max trade amounts, active offer/trade limits
- **Timers**: Trade expiration and dispute windows
- **Circuit Breakers**: Global pause and operation-specific pauses

### Fee Structure

All fees are in basis points (1% = 100 basis points):
- Max total fees: 10% (1000 basis points)
- Burn fee: 0-5%
- Chain fee: 0-3%
- Warchest fee: 0-3%
- Conversion fee: 0-5%
- Arbitration fee: 0-2%

## Development Workflow

### 1. Make Changes

Edit program source code in `programs/*/src/`

### 2. Build

```bash
anchor build
```

### 3. Update Program IDs

If you regenerated keypairs:

```bash
anchor keys list
# Copy program IDs to lib.rs declare_id!() and Anchor.toml
```

### 4. Test

```bash
# Unit tests (Rust)
cargo test --package hub -- --nocapture

# Integration tests (TypeScript)
anchor test
```

### 5. Deploy

```bash
# Localnet
anchor deploy

# Devnet
anchor deploy --provider.cluster devnet
```

## Testing Strategy

### Unit Tests (Rust)

Located in each program's `src/` directory:
- Test individual instruction handlers
- Test account validation
- Test custom error conditions
- Test fee calculations

### Integration Tests (TypeScript)

Located in `tests/`:
- Test complete user flows
- Test cross-program interactions
- Test state transitions
- Test error propagation

### Test Coverage Goals

- Unit tests: >90% per program
- Integration tests: All happy paths + critical error paths
- Edge cases: Zero amounts, max values, boundary conditions

## Security Considerations

### Validation Requirements

- ✅ All inputs validated
- ✅ Authorization checks on state-changing instructions
- ✅ PDA ownership verified
- ✅ Token amounts validated before transfers
- ✅ Integer overflow protection via checked arithmetic
- ✅ Rent exemption enforced for all accounts

### Access Control

- Admin operations require Hub admin signature
- User operations require user signature
- Cross-program calls validate caller program ID
- PDA authorities prevent unauthorized access

### Common Pitfalls (Documented in PRP)

1. **Account Size Limits**: Keep accounts <10KB
2. **Compute Units**: Max 200k CU per instruction
3. **PDA Seeds**: Must be deterministic and unique
4. **Fee Precision**: Use basis points to avoid rounding errors
5. **Escrow Security**: Only Trade program can trigger releases

## Troubleshooting

### Build Errors

**Error**: `cargo build-sbf` not found
- **Solution**: Install full Solana toolchain (not Homebrew version)
  ```bash
  sh -c "$(curl -sSfL https://release.solana.com/v1.18.20/install)"
  ```

**Error**: Program ID mismatch
- **Solution**: Run `anchor keys list` and update `declare_id!()` in lib.rs

### Test Failures

**Error**: Account not found
- **Solution**: Ensure local validator is running with correct program deployments

**Error**: Transaction too large
- **Solution**: Split complex operations across multiple transactions

## Contributing

1. Follow Rust naming conventions (snake_case)
2. Add doc comments to all public functions
3. Write tests for all new functionality
4. Run `cargo fmt` and `cargo clippy` before committing
5. Update this README for new features

## License

MIT License - See LICENSE file

## References

- [Anchor Documentation](https://www.anchor-lang.com/docs)
- [Solana Documentation](https://solana.com/docs)
- [EVM Contracts](../evm/contracts/)
- [CosmWasm Contracts](../cosmwasm/contracts/)
- [PRP Document](../../PRPs/solana-protocol-conversion.md)
