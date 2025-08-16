# Deploy Full Token Launch System

## Overview
This guide will help you deploy the complete token launch system with real contracts on Abstract testnet.

## Prerequisites
- Node.js 18+
- Git
- 0.1+ ETH on Abstract testnet for deployment

## Steps

### 1. Deploy Smart Contracts

```bash
# On your local machine
cd ~/Documents/Abstract

# Deploy the full LaunchFactory system
npx hardhat run scripts/deploy-full-system.ts --network abstract-testnet
```

Save the LaunchFactory address from the output.

### 2. Update Backend Configuration

Update your backend with the new contract address:

```bash
# backend/src/contracts/LaunchFactory.ts
export const CONTRACT_ADDRESSES = {
  LAUNCH_FACTORY: '<NEW_FACTORY_ADDRESS>',
  // ... other addresses
};
```

### 3. Deploy Backend Updates

```bash
# On your Ubuntu server
cd ~/side-projects/abstract
git pull

# Install dependencies (if any new ones)
cd backend
npm install

# Build backend
npm run build

# Run database migrations if needed
npx prisma migrate deploy

# Restart backend
pm2 restart backend

# Check logs
pm2 logs backend --lines 50
```

### 4. Clear Frontend Cache

After deployment, users need to clear their browser cache:
- Open Chrome DevTools (F12)
- Right-click the refresh button
- Select "Empty Cache and Hard Reload"

## New Features

### Real Token Contracts
- ERC20 tokens with 1 billion supply
- Metadata storage on-chain
- Ownership and migration controls

### Bonding Curve Trading
- Linear bonding curve pricing
- Buy/sell functionality
- 0.5% platform fee + 0.5% creator fee
- Automatic migration at curve completion

### Trading Endpoints
- `/api/trades/estimate` - Get trade quotes
- `/api/trades/price/:token` - Get current price
- `/api/trades/prepare` - Prepare transaction
- `/api/trades/confirm` - Confirm after tx

### Real Price Display
- Prices fetched from bonding curve contracts
- No more "$0.00e+0" display
- Real-time price updates

## Testing

1. Launch a new token:
   - Go to https://blastabs.fun/launch
   - Fill in token details
   - Pay 0.01 ETH fee
   - Token and bonding curve will be deployed

2. Trade tokens:
   - Go to token page
   - Buy tokens with ETH
   - Sell tokens for ETH
   - Watch price change based on supply/demand

3. Check prices:
   - Price should show actual value
   - Market cap calculated correctly
   - Progress bar shows curve completion

## Troubleshooting

### "Internal JSON-RPC error"
- Make sure you deployed the new contracts
- Update backend with new addresses
- Clear browser cache

### Price shows "0"
- Check bonding curve contract is deployed
- Verify contract addresses are correct
- Check backend logs for errors

### Trade fails
- Ensure you have enough ETH
- Check token allowance for sells
- Verify slippage tolerance

## Contract Addresses (Examples)
```
LaunchFactory: 0x...
BaseToken (template): Created per launch
BondingCurve (template): Created per launch
```

## Next Steps
1. Add WebSocket support for real-time updates
2. Implement DEX migration at curve completion
3. Add liquidity locking mechanism
4. Create admin dashboard