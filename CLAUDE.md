- Never downgrade anchor to falsely fix things
- Never downgrade dependencies to fix issues

## Adding New Fiat Currencies

To add a new fiat currency to the system, follow these steps:

### 1. CosmWasm Contracts
Check if the currency is already defined in `/contracts/cosmwasm/packages/protocol/src/currencies.rs`. Most ISO currency codes are already included.

### 2. Frontend Application
Update the following files in the frontend:

#### a. `/app/src/utils/fiats-config.json`
Add the new currency configuration:
```json
"XXX": {
  "icon": "/flags/xxx.png",
  "display": "XXX",
  "code": "XXX"
}
```

#### b. `/app/src/types/components.interface.ts`
Add the currency to the FiatCurrency const object:
```typescript
export const FiatCurrency = {
  // ... existing currencies
  XXX: 'XXX',
} as const
```

#### c. `/app/src/ui/pages/Dashboard.vue`
Add the currency to the supportedFiats array:
```typescript
const supportedFiats = [
  // ... existing currencies
  FiatCurrency.XXX,
]
```

#### d. `/app/public/flags/xxx.png`
Add the flag image file for the new currency.

### 3. Price Aggregator Service
Update the following files in `/fiat-prices-aggregator/`:

#### a. `/src/api/yadio.rs`
Add the currency field to the Prices struct and its Default implementation:
```rust
pub struct Prices {
    // ... existing fields
    pub XXX: f64,
}

impl Default for Prices {
    fn default() -> Self {
        Prices {
            // ... existing fields
            XXX: 0.0,
        }
    }
}
```

#### b. `/src/main.rs`
Add the currency to the all_prices vector:
```rust
let all_prices = vec![
    // ... existing currencies
    (price.XXX, FiatCurrency::XXX),
];
```

Update the total count in the log message to reflect the new total number of currencies.

### 4. Testing
After making these changes:
1. Build the frontend: `cd app && npm run build`
2. Build the price aggregator: `cd fiat-prices-aggregator && cargo build`
3. Build the CosmWasm contracts: `cd contracts/cosmwasm && cargo build --release --target wasm32-unknown-unknown`