# LocalMoney BSC Mainnet Deployment Summary

## ✅ Successfully Deployed Contracts

| Contract | Address | BSCScan Link | Status |
|----------|---------|--------------|--------|
| Hub | `0x696F771E329DF4550044686C995AB9028fD3a724` | [View](https://bscscan.com/address/0x696F771E329DF4550044686C995AB9028fD3a724) | ✅ Deployed |
| Profile | `0x9a1AD40c90E5f282152Aa9F56d18B99F31794B68` | [View](https://bscscan.com/address/0x9a1AD40c90E5f282152Aa9F56d18B99F31794B68) | ✅ Deployed |
| PriceOracle | `0x09e65e3a9028f7B8d59F85b9A6933C6eF6e092ca` | [View](https://bscscan.com/address/0x09e65e3a9028f7B8d59F85b9A6933C6eF6e092ca) | ✅ Deployed |
| Offer | `0x5B1E3C79A6A84BD436Fe2141A13E1767C178E621` | [View](https://bscscan.com/address/0x5B1E3C79A6A84BD436Fe2141A13E1767C178E621) | ✅ Deployed |

## ⚠️ Pending Deployments

The following contracts still need to be deployed:

1. **Trade** - Requires Escrow and ArbitratorManager addresses
2. **Escrow** - Requires Trade address  
3. **ArbitratorManager** - Requires Trade address

### Circular Dependency Issue

There's a circular dependency between Trade and Escrow contracts:
- Trade requires Escrow address during initialization
- Escrow requires Trade address during initialization

### Resolution Options

1. **Deploy with update functions**: Deploy contracts with temporary addresses and update them later
2. **Modify contracts**: Add setter functions to update dependencies post-deployment
3. **Use proxy pattern**: Deploy implementation first, then initialize with correct addresses

## Deployment Details

- **Network**: BSC Mainnet (Chain ID: 56)
- **Deployer**: `0x5f6acb320B94b2A954dC0C28e037D5A761C76571`
- **Date**: 2025-08-28
- **Gas Used**: ~0.001 BNB per contract
- **Remaining Balance**: ~0.028 BNB

## Next Steps

1. Resolve circular dependency issue
2. Complete deployment of remaining contracts (Trade, Escrow, ArbitratorManager)
3. Update Hub configuration with all contract addresses
4. Verify all contracts on BSCScan
5. Test contract interactions

## Configuration

Current Hub configuration uses PancakeSwap V3 router: `0x10ED43C718714eb63d5aA57B78B54704E256024E`

### Fee Structure
- Burn Fee: 1% (100 bps)
- Chain Fee: 2% (200 bps)
- Warchest Fee: 3% (300 bps)
- Conversion Fee: 0.5% (50 bps)
- Arbitrator Fee: 1% (100 bps)

### Trade Limits
- Min Trade: $10 USD
- Max Trade: $10,000 USD
- Max Active Offers: 10
- Max Active Trades: 5

### Timers
- Trade Expiration: 24 hours
- Trade Dispute Window: 7 days
- Timelock Delay: 48 hours