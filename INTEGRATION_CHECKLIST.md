# Abstract Platform Integration Test Checklist

## Quick Reference Testing Guide

This checklist provides a streamlined approach to testing all major features of the Abstract Platform.

### Prerequisites ✅

- [ ] Node.js v18+ installed
- [ ] PostgreSQL running
- [ ] Redis running
- [ ] MetaMask installed with Abstract Testnet
- [ ] Test ETH in wallet

### Environment Setup ✅

#### Backend
```bash
cd backend
npm install
npx prisma migrate dev
npm run test:seed
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your values
npm run dev
```

#### Contracts (if needed)
```bash
npx hardhat run scripts/deploy-simple.ts --network abstract-testnet
```

### Core Features Testing ✅

#### 1. Wallet Connection
- [ ] Connect wallet button visible
- [ ] MetaMask popup appears
- [ ] Correct network (Abstract Testnet)
- [ ] Wallet address displays
- [ ] Balance shows correctly
- [ ] Disconnect works

#### 2. Homepage
- [ ] Stats cards load
- [ ] Trending tokens display
- [ ] Recent trades update
- [ ] Navigation menu works
- [ ] Search functionality
- [ ] Responsive on mobile

#### 3. Token List (/tokens)
- [ ] Tokens load with pagination
- [ ] Sorting works (volume, market cap, holders)
- [ ] Search filters tokens
- [ ] Progress bars accurate
- [ ] Click through to token pages

#### 4. Token Creation (/launch)
- [ ] Form validation works
- [ ] Image preview displays
- [ ] Gas estimate shows
- [ ] Transaction submits
- [ ] Success redirect to token page
- [ ] Token appears in list

#### 5. Token Trading Page (/token/[address])
- [ ] Token info displays correctly
- [ ] Price chart loads and updates
- [ ] Buy/Sell toggle works
- [ ] Amount calculations correct
- [ ] Slippage settings work
- [ ] Max button works
- [ ] Insufficient balance handling
- [ ] Transaction confirmation
- [ ] Balance updates after trade
- [ ] Trade appears in history

#### 6. Trading Interface Features
- [ ] Real-time price updates
- [ ] Chart time intervals (1H, 1D, 1W)
- [ ] Order book (if implemented)
- [ ] Trade history loads
- [ ] Holder list displays
- [ ] Social links work

#### 7. Rewards System (/rewards)
- [ ] Rewards page loads
- [ ] Eligibility displays correctly
- [ ] Available rewards show
- [ ] Claim button enabled/disabled properly
- [ ] Claim transaction works
- [ ] Rewards transfer to wallet
- [ ] Claimed status updates

#### 8. Leaderboard (/leaderboard)
- [ ] Top traders load
- [ ] Sorting options work
- [ ] Search by wallet works
- [ ] Stats are accurate
- [ ] Pagination works
- [ ] Click to view trader profile

#### 9. Real-time Features
- [ ] WebSocket connects (check console)
- [ ] Price updates without refresh
- [ ] New trades appear instantly
- [ ] Stats update live
- [ ] No duplicate messages

### Edge Cases & Error Handling ✅

#### Transaction Errors
- [ ] Insufficient ETH balance
- [ ] User rejects transaction
- [ ] Network timeout handling
- [ ] Gas estimation failure

#### Data Validation
- [ ] Empty form submission blocked
- [ ] Invalid addresses rejected
- [ ] Negative amounts prevented
- [ ] XSS attempts blocked

#### Network Issues
- [ ] Wrong network detection
- [ ] Network switching prompt
- [ ] API offline handling
- [ ] WebSocket reconnection

### Performance Checks ✅

- [ ] Page load < 3 seconds
- [ ] Smooth scrolling
- [ ] No memory leaks (monitor DevTools)
- [ ] API responses < 1 second
- [ ] Chart renders smoothly

### Mobile Testing ✅

- [ ] Responsive layout
- [ ] Touch interactions work
- [ ] Wallet connection on mobile
- [ ] Charts viewable
- [ ] Forms usable

### Security Verification ✅

- [ ] HTTPS only
- [ ] No sensitive data in console
- [ ] Proper CORS headers
- [ ] Rate limiting active
- [ ] Input sanitization

### Final Checks ✅

- [ ] All console errors resolved
- [ ] No broken images
- [ ] All links work
- [ ] Proper error messages
- [ ] Loading states display

## Quick Commands

### Check Backend Health
```bash
curl http://localhost:5000/api/health
```

### Check WebSocket
```javascript
// In browser console
const ws = new WebSocket('ws://localhost:5000');
ws.onmessage = (e) => console.log('WS:', e.data);
```

### Database Queries
```sql
-- Check tokens
SELECT COUNT(*) FROM tokens;

-- Check recent trades
SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10;

-- Check active holders
SELECT COUNT(DISTINCT wallet) FROM holders WHERE balance > '0';
```

### Reset Test Data
```bash
cd backend
npm run db:reset
npm run test:seed
```

## Common Test Scenarios

### Scenario 1: New User Journey
1. Visit site without wallet
2. Connect wallet
3. Browse tokens
4. Create first token
5. Make first trade
6. Check rewards

### Scenario 2: Active Trader
1. Connect as existing user
2. Check portfolio
3. Trade multiple tokens
4. Monitor real-time updates
5. Claim rewards
6. Check leaderboard position

### Scenario 3: Token Creator
1. Launch new token
2. Add initial liquidity
3. Monitor progress
4. Share token link
5. Track holders
6. Watch for migration

## Troubleshooting

### Backend Not Starting
```bash
# Check logs
tail -f backend/logs/api.log

# Check database connection
psql -U your_user -d your_database

# Check Redis
redis-cli ping
```

### Frontend Issues
```bash
# Clear cache
rm -rf frontend/.next
npm run dev

# Check environment variables
cat frontend/.env.local
```

### Contract Issues
```bash
# Verify deployment
npx hardhat verify --network abstract-testnet CONTRACT_ADDRESS

# Check balance
npx hardhat run scripts/check-balance.ts
```

---

✅ = Required for launch
⚡ = Performance critical
🔒 = Security critical
📱 = Mobile important