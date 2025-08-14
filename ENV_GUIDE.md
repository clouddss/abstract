# Environment Configuration Guide

## Overview

The project now uses separate environment files for different deployment scenarios:

### Frontend Environment Files
- `.env.local` - Local development configuration
- `.env.production` - Production deployment configuration

### Backend Environment Files
- `.env` - Minimal defaults (safe to commit)
- `.env.local` - Local development configuration
- `.env.production` - Production deployment configuration

## Important Security Notice

⚠️ **CRITICAL**: Your previous `.env` file contained a private key. This has been removed. Never commit private keys or sensitive data to version control.

## Configuration Structure

### Frontend Variables (NEXT_PUBLIC_*)
All frontend environment variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.

Key configurations:
- API URLs
- Chain configuration (Abstract testnet)
- Contract addresses
- Feature flags
- External service keys (public keys only)

### Backend Variables
Backend variables contain sensitive data and should never be exposed to the frontend.

Key configurations:
- Database credentials
- Redis connection
- JWT secrets
- Encryption keys
- Private API keys
- Admin credentials

## Setup Instructions

### For Local Development

1. **Backend Setup**:
   ```bash
   cd backend
   cp .env.local .env
   # Edit .env to add your local database password
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   # .env.local is already configured for local development
   ```

### For Production Deployment

1. **Backend Setup**:
   ```bash
   cd backend
   cp .env.production .env
   # Edit .env and update:
   # - DATABASE_URL with production credentials
   # - Generate strong JWT_SECRET
   # - Generate strong ENCRYPTION_KEY
   # - Update CORS_ORIGIN with your domain
   # - Add production API keys
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   cp .env.production .env.local
   # Edit .env.local and update:
   # - NEXT_PUBLIC_API_URL with your production API URL
   # - Add production service keys
   ```

## Generating Secure Values

### Generate JWT Secret
```bash
openssl rand -base64 32
```

### Generate Encryption Key (32 characters)
```bash
openssl rand -hex 16
```

### Generate Admin API Keys
```bash
openssl rand -hex 32
```

## Contract Addresses to Update

After deploying smart contracts, update these addresses in both frontend and backend:
- `LAUNCH_FACTORY_ADDRESS`
- `PLATFORM_ROUTER_ADDRESS`
- `REWARDS_VAULT_ADDRESS`
- `WETH_ADDRESS`
- `USDC_ADDRESS`

## Ubuntu Server Deployment

When deploying to your Ubuntu server:

1. Upload the appropriate `.env.production` files
2. Rename them to `.env` or `.env.local` as needed
3. Update with production-specific values
4. Never commit the production `.env` files

## Environment Variable Priority

Next.js loads environment variables in this order:
1. `.env.local`
2. `.env.production` (when NODE_ENV=production)
3. `.env`

Backend loads from `.env` file only.

## Checklist Before Deployment

- [ ] Generated strong JWT_SECRET
- [ ] Generated strong ENCRYPTION_KEY
- [ ] Updated DATABASE_URL with production credentials
- [ ] Updated CORS_ORIGIN with production domains
- [ ] Deployed contracts and updated addresses
- [ ] Removed any private keys from code
- [ ] Updated API URLs in frontend
- [ ] Configured HTTPS/SSL for production

## Common Issues

1. **Frontend can't connect to backend**
   - Check NEXT_PUBLIC_API_URL matches your backend URL
   - Verify CORS_ORIGIN includes your frontend domain

2. **Database connection fails**
   - Verify DATABASE_URL credentials
   - Check PostgreSQL is running
   - Ensure database exists

3. **Contract calls fail**
   - Verify contract addresses are correct
   - Check chain ID matches (11124 for Abstract testnet)
   - Ensure RPC URL is accessible