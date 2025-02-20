😊 Below is a sample README file for the Solana folder:

```markdown:README.md
# LocalMoney - Solana Programs

## Overview

This repository contains the Solana programs for the LocalMoney project built with the [Anchor Framework](https://project-serum.github.io/anchor/). The project comprises several interrelated programs:

- **Price:** A decentralized price oracle for managing currency values.
- **Offer:** A program to create and manage buy/sell offers.
- **Trade:** A trading platform that facilitates secure token transfers between buyers and sellers.
- **Profile:** A user profile management program to track reputation, trade completions, and more.
- **Common:** Shared utilities and common logic used across the programs.

## Folder Structure

```
LocalMoney/
 ├── programs/
 │    ├── price
 │    ├── offer
 │    ├── trade
 │    └── profile
 ├── common/ 
 ├── tests/            # Integration tests written in TypeScript
 └── Anchor.toml       # Anchor configuration file
```

## Prerequisites

Before starting development, ensure you have the following installed:

- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor CLI](https://project-serum.github.io/anchor/getting-started/installation.html)
- [Rust](https://www.rust-lang.org/tools/install)
- [pnpm](https://pnpm.io/installation) — **Note:** Always use pnpm as the package manager.

## Local Development

### Starting the Local Validator

To run a local Solana test network, use the following command:

```bash
solana-test-validator
```

A sample output looks like this:

```plaintext
Ledger location: test-ledger
Log: test-ledger/validator.log
Initializing...
Waiting for fees to stabilize 1...
Identity: 6eWaCxgWnQXfDftUMtU1GEVcaz1nS8cubPFyv5tgq1VT
Genesis Hash: A8XqDDkcEBWxCNSpFF8TQeE3i6fXcecwsjur8PXGWLVP
Version: 1.18.26
Shred Version: 46456
Gossip Address: 127.0.0.1:1024
TPU Address: 127.0.0.1:1027
JSON RPC URL: http://127.0.0.1:8899
WebSocket PubSub URL: ws://127.0.0.1:8900
```

### Environment Configuration

- Create a `.env` file (or update your existing one) with the following variables:
  - `PRICE_PROGRAM_ID`
  - `OFFER_PROGRAM_ID`
  - `TRADE_PROGRAM_ID`
  - `PROFILE_PROGRAM_ID`

- If any program IDs change after deployment, update them in both the `.env` file and the `Anchor.toml` file.

### Building and Deploying Programs

After making changes to any program:

1. **Build the programs:**

    ```bash
    anchor build
    ```

2. **Deploy the programs (ensure you are connected to the localnet):**

    ```bash
    anchor deploy --provider.cluster localnet
    ```

3. **Important:** If any program's ID changes during redeployments, update the corresponding entries in `Anchor.toml` and the environment files.

### Running Tests

Integration tests are written in TypeScript (using ts-mocha) and can be run with the provided npm scripts. From the `tests` folder, run:

```bash
pnpm run test:price
pnpm run test:offer
pnpm run test:trade
```

Or run all tests with:

```bash
pnpm run test:all
```

## Additional Notes

- **SOL Airdrops:** If a wallet is low on SOL, use the following command to airdrop SOL on the local validator:

    ```bash
    solana airdrop 111 <WALLET_ADDRESS>
    ```

- **Localnet for Testing:** Always use the Solana localnet (`solana-test-validator`) when testing changes locally.

- **IDL Files:** Do not modify the generated IDL files manually. They are auto-generated at program compilation and serve as references for front-end development.

- **Rebuild and Redeploy:** Every time you make changes to a program, remember to rebuild and redeploy it to keep the deployment in sync with the latest changes.

## Contributing

Contributions are welcome! If you find issues or have improvements, please open an issue or submit a pull request.

```
