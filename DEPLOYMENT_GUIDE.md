# 🚀 Deployment Guide - Abstract Token Launch Platform

## Prerequisites
- Node.js 18+ installed
- 0.1+ ETH on Abstract testnet (Chain ID: 11124)
- Git configured

## Quick Deploy (One Command)

```bash
npx hardhat run scripts/deploy-full-system.ts --network abstract-testnet
```

## Step-by-Step Deployment

### 1. Clone and Setup
```bash
git clone <your-repo>
cd Abstract
npm install
```

### 2. Configure Environment
Create `.env` file:
```env
PRIVATE_KEY=your_private_key_here
ABSTRACT_RPC_URL=https://api.testnet.abs.xyz
```

### 3. Compile Contracts
```bash
npx hardhat compile
```

### 4. Deploy Full System
```bash
npx hardhat run scripts/deploy-full-system.ts --network abstract-testnet
```

This will:
- Deploy LaunchFactoryLib (library for factory functions)
- Deploy LaunchFactory (main factory contract)
- Save deployment info to `deployments/latest.json`
- Display contract addresses for backend configuration

### 5. Optional: Deploy Test Token
```bash
DEPLOY_TEST_TOKEN=true npx hardhat run scripts/deploy-full-system.ts --network abstract-testnet
```

## Post-Deployment Steps

### 1. Update Backend
Add the contract addresses to your backend `.env`:
```env
LAUNCH_FACTORY_ADDRESS=<factory_address_from_deployment>
LAUNCH_FACTORY_LIB_ADDRESS=<lib_address_from_deployment>
PLATFORM_TREASURY=<treasury_address>
```

### 2. Deploy Backend
On your server:
```bash
cd backend
npm run build
pm2 restart backend
pm2 logs backend --lines 50
```

### 3. Verify Deployment
- Check explorer: https://explorer.testnet.abs.xyz/address/<factory_address>
- Visit frontend: https://blastabs.fun
- Test token launch: https://blastabs.fun/launch

## Contract Features

### LaunchFactory
- Deploys real ERC20 tokens (1B supply)
- Creates bonding curves with exponential pricing
- 0.01 ETH launch fee
- Validates metadata (URLs, social handles)

### BaseToken
- ERC20 with permit functionality
- 1,000,000,000 token supply
- Metadata storage on-chain
- Migration capabilities

### BondingCurve
- Exponential pricing: price = BASE_PRICE * (1 + supply/PRECISION)^1.5
- Base price: 0.000001 ETH
- Buy/sell functionality
- 0.5% platform fee + 0.5% creator fee
- Auto-migration at 70% supply

## Troubleshooting

### "Contract size exceeds limit"
The contracts use a library (LaunchFactoryLib) to reduce size. This is deployed automatically.

### "Insufficient balance"
You need at least 0.1 ETH for deployment. Get testnet ETH from a faucet.

### "Transaction failed"
Check:
- Network is correct (abstract-testnet)
- Private key has funds
- RPC URL is accessible

### Price shows "$0.00e+0"
After deployment:
1. Update backend with new contract addresses
2. Restart backend
3. Clear browser cache

## Useful Commands

### Check deployment status
```bash
cat deployments/latest.json
```

### Verify contracts on explorer
```bash
npx hardhat verify --network abstract-testnet <contract_address> <constructor_args>
```

### Test token launch locally
```bash
npx hardhat run scripts/e2e-test.ts --network abstract-testnet
```

## Scripts Available

- `deploy-full-system.ts` - Main deployment script
- `check-balance.ts` - Check deployer balance
- `check-treasury.ts` - Check treasury balance
- `update-treasury.ts` - Update treasury address
- `register-token.ts` - Manually register token in DB
- `e2e-test.ts` - End-to-end testing

## Support

If deployment fails:
1. Check `deployments/partial-deployment-*.json` for partially deployed contracts
2. Review error messages in console
3. Ensure all prerequisites are met
4. Try deployment with higher gas limit if needed