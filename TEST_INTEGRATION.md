# Abstract Platform Integration Testing Guide

This document provides comprehensive testing procedures for the fully integrated Abstract Platform frontend-backend system.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Test Data Setup](#test-data-setup)
4. [Testing Procedures](#testing-procedures)
5. [Expected Behaviors](#expected-behaviors)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [Integration Test Checklist](#integration-test-checklist)

## Prerequisites

### Required Software
- Node.js v18+ and npm v8+
- PostgreSQL 14+
- Redis 6+
- MetaMask or compatible Web3 wallet
- Docker & Docker Compose (for containerized testing)

### Required Accounts
- Abstract Testnet wallet with test ETH
- PostgreSQL database access
- Redis server access

### Required Environment Variables
- Copy `.env.example` files in both frontend and backend directories
- Configure with actual values for your test environment

## Environment Setup

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Setup database
npx prisma migrate dev
npx prisma generate

# Seed test data (see test-data-setup.ts)
npm run seed:test

# Start backend services
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your test values

# Start frontend
npm run dev
```

### 3. Smart Contract Setup

```bash
# From root directory
npm install

# Deploy contracts to testnet
npx hardhat run scripts/deploy-simple.ts --network abstract-testnet

# Update contract addresses in frontend/.env.local
```

## Test Data Setup

Run the test data setup script to populate your database with test tokens, trades, and users:

```bash
cd backend
npm run test:seed
```

This creates:
- 10 test tokens with varying progress levels
- 100+ test trades across tokens
- 50+ test wallet addresses with balances
- Test reward distributions
- Platform statistics

## Testing Procedures

### 1. Wallet Connection Flow

**Steps:**
1. Navigate to http://localhost:3000
2. Click "Connect Wallet" button
3. Select MetaMask
4. Approve connection request
5. Switch to Abstract Testnet if needed

**Expected Result:**
- Wallet address displays in header
- User balance shows correctly
- Navigation menu becomes accessible

**Verification:**
```bash
# Check console for successful connection
# Network ID should be 11124 (Abstract Testnet)
```

### 2. Token Creation Process

**Steps:**
1. Click "Launch Token" in navigation
2. Fill in token details:
   - Name: "Test Token"
   - Symbol: "TEST"
   - Description: "A test token for integration testing"
   - Image URL: https://example.com/image.png
3. Review gas estimate
4. Click "Create Token"
5. Confirm transaction in MetaMask

**Expected Result:**
- Transaction submitted successfully
- Redirect to token page after confirmation
- Token appears in "New Tokens" list
- Token data stored in database

**Backend Verification:**
```sql
-- Check token was created
SELECT * FROM tokens WHERE symbol = 'TEST' ORDER BY created_at DESC LIMIT 1;
```

### 3. Trading Functionality

#### Buy Tokens

**Steps:**
1. Navigate to token page (/token/[address])
2. Select "Buy" tab
3. Enter ETH amount (e.g., 0.1)
4. Review token amount and price impact
5. Click "Buy"
6. Confirm transaction

**Expected Result:**
- Transaction processes successfully
- Token balance updates
- Price chart reflects new price
- Trade appears in recent trades
- WebSocket broadcasts update

**Verification:**
```sql
-- Check trade was recorded
SELECT * FROM trades 
WHERE token_address = '0x...' 
AND type = 'BUY' 
ORDER BY timestamp DESC LIMIT 1;

-- Check holder balance updated
SELECT * FROM holders 
WHERE token_address = '0x...' 
AND wallet = '0x...';
```

#### Sell Tokens

**Steps:**
1. Navigate to token page with tokens you own
2. Select "Sell" tab
3. Enter token amount or percentage
4. Review ETH output
5. Click "Sell"
6. Confirm transaction

**Expected Result:**
- Transaction processes successfully
- Token balance decreases
- ETH balance increases
- Trade recorded in database

### 4. Rewards System

**Steps:**
1. Navigate to Rewards page (/rewards)
2. View available rewards
3. Check eligibility (must have traded)
4. Click "Claim Rewards"
5. Confirm transaction

**Expected Result:**
- Rewards claimed successfully
- ETH/USDC transferred to wallet
- Claim status updated in UI
- Database records updated

**Verification:**
```sql
-- Check reward distribution
SELECT * FROM reward_distributions 
WHERE wallet = '0x...' 
AND claimed = true;
```

### 5. Leaderboard

**Steps:**
1. Navigate to Leaderboard (/leaderboard)
2. View top traders by:
   - Volume
   - PnL
   - Tokens Created
3. Search for specific wallet
4. View detailed trader stats

**Expected Result:**
- Leaderboard loads with accurate data
- Sorting works correctly
- Search functionality works
- Stats update in real-time

### 6. Real-time Updates

**Steps:**
1. Open two browser windows
2. In Window 1: Navigate to a token page
3. In Window 2: Make a trade on the same token
4. Observe Window 1 for updates

**Expected Result:**
- Price updates immediately
- Recent trades list updates
- Chart refreshes with new data
- No page refresh required

**WebSocket Verification:**
```javascript
// Check browser console for WebSocket messages
// Should see: { type: 'trade', data: {...} }
```

## Expected Behaviors

### Performance Benchmarks
- Page load: < 2 seconds
- Transaction confirmation: < 30 seconds
- WebSocket latency: < 100ms
- API response time: < 500ms

### Data Consistency
- Token prices match bonding curve calculations
- Trade history is complete and ordered
- Holder balances are accurate
- Platform stats aggregate correctly

### Error Handling
- Network errors show user-friendly messages
- Transaction failures provide clear reasons
- Form validation prevents invalid inputs
- Rate limiting prevents spam

## Common Issues & Solutions

### Issue: Transaction Fails
**Solution:**
1. Check wallet has sufficient ETH
2. Verify correct network (Abstract Testnet)
3. Check gas price settings
4. Verify contract addresses in .env

### Issue: WebSocket Not Connecting
**Solution:**
1. Check WebSocket URL in frontend config
2. Verify backend WebSocket server running
3. Check for CORS issues
4. Inspect browser console for errors

### Issue: Data Not Updating
**Solution:**
1. Check indexer is running
2. Verify database connections
3. Check Redis for caching issues
4. Review API error logs

### Issue: Rewards Not Showing
**Solution:**
1. Ensure reward epoch is active
2. Check user has trading activity
3. Verify merkle tree generation
4. Check reward contract balance

## Integration Test Checklist

### Pre-Launch Checklist
- [ ] All environment variables configured
- [ ] Database migrated and seeded
- [ ] Contracts deployed and verified
- [ ] Frontend builds without errors
- [ ] Backend starts without errors
- [ ] WebSocket server accessible

### Functional Tests
- [ ] **Wallet Connection**
  - [ ] Connect MetaMask
  - [ ] Display correct balance
  - [ ] Handle network switching
  - [ ] Disconnect functionality

- [ ] **Token Creation**
  - [ ] Form validation works
  - [ ] Gas estimation accurate
  - [ ] Transaction submits
  - [ ] Token appears in list
  - [ ] Redirects to token page

- [ ] **Trading**
  - [ ] Buy tokens with ETH
  - [ ] Sell tokens for ETH
  - [ ] Slippage protection works
  - [ ] Price impact displays
  - [ ] Balance updates correctly

- [ ] **Token Pages**
  - [ ] Chart loads and updates
  - [ ] Trade history displays
  - [ ] Holder list accurate
  - [ ] Statistics correct
  - [ ] Social links work

- [ ] **Rewards**
  - [ ] Eligibility calculated correctly
  - [ ] Claim process works
  - [ ] Multiple claims prevented
  - [ ] Rewards transfer successfully

- [ ] **Leaderboard**
  - [ ] Rankings calculate correctly
  - [ ] Sorting functions work
  - [ ] Search finds users
  - [ ] Stats are accurate

- [ ] **Real-time Features**
  - [ ] WebSocket connects
  - [ ] Price updates live
  - [ ] Trades appear instantly
  - [ ] Stats refresh automatically

### Edge Cases
- [ ] Handle zero balance trades
- [ ] Prevent negative values
- [ ] Handle maximum uint256 values
- [ ] Test with slow network
- [ ] Test with high gas prices
- [ ] Handle contract pauses

### Security Tests
- [ ] Input validation on all forms
- [ ] XSS prevention in user content
- [ ] CSRF protection enabled
- [ ] Rate limiting active
- [ ] Wallet signature verification

### Performance Tests
- [ ] Load 100+ tokens efficiently
- [ ] Handle 1000+ trades in history
- [ ] Chart renders large datasets
- [ ] Search responds quickly
- [ ] WebSocket handles high volume

## Post-Testing

### Data Cleanup
```bash
# Reset test database
cd backend
npm run db:reset

# Clear Redis cache
redis-cli FLUSHALL
```

### Logs to Review
- Backend API logs: `backend/logs/api.log`
- Indexer logs: `backend/logs/indexer.log`
- Frontend console logs
- Network traffic in browser DevTools

### Metrics to Track
- Total test transactions
- Average response times
- Error rates by endpoint
- WebSocket message volume
- Database query performance

## Continuous Testing

For ongoing testing:
1. Set up automated E2E tests with Cypress
2. Configure GitHub Actions for CI/CD
3. Monitor production with Sentry
4. Set up alerts for anomalies
5. Regular security audits

---

This guide should be updated as new features are added or issues are discovered during testing.