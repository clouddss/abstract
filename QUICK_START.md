# Abstract Platform Quick Start Guide

Get the Abstract Platform running locally in under 10 minutes!

## Prerequisites

Ensure you have the following installed:
- Node.js v18+ 
- PostgreSQL 14+
- Redis 6+
- Git

## 🚀 Quick Setup (5 minutes)

### 1. Clone and Install (1 minute)

```bash
# Clone the repository
git clone <repository-url>
cd Abstract

# Install all dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Environment Configuration (2 minutes)

#### Backend Setup
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/abstract_platform"

# Redis
REDIS_URL="redis://localhost:6379"

# Ethereum RPC
ETH_RPC_URL="https://api.testnet.abs.xyz"

# Server
PORT=5000
NODE_ENV=development
```

#### Frontend Setup
```bash
cd ../frontend
cp .env.example .env.local
```

Edit `frontend/.env.local`:
```env
# API URL
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Chain Configuration
NEXT_PUBLIC_CHAIN_ID=11124
NEXT_PUBLIC_CHAIN_RPC_URL=https://api.testnet.abs.xyz

# Contract Addresses (use defaults for testing)
NEXT_PUBLIC_LAUNCH_FACTORY_ADDRESS=0x1234567890123456789012345678901234567890
```

### 3. Database Setup (1 minute)

```bash
# Create database
createdb abstract_platform

# Run migrations
cd backend
npx prisma migrate dev

# Seed with test data
npm run test:seed
```

### 4. Start Services (1 minute)

Open 3 terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Redis (if not running):**
```bash
redis-server
```

### 5. Access the Platform

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- API Health: http://localhost:5000/api/health

## 🧪 Test the Platform

### 1. Connect Wallet
- Install MetaMask
- Add Abstract Testnet:
  - Network Name: Abstract Testnet
  - RPC URL: https://api.testnet.abs.xyz
  - Chain ID: 11124
  - Currency Symbol: ETH

### 2. Get Test ETH
Visit the Abstract Testnet faucet to get test ETH.

### 3. Explore Features
- Browse tokens at `/tokens`
- Create a token at `/launch`
- Trade tokens at `/token/[address]`
- Check rewards at `/rewards`
- View leaderboard at `/leaderboard`

## 📁 Project Structure

```
Abstract/
├── frontend/          # Next.js frontend
│   ├── app/          # App routes
│   ├── components/   # React components
│   ├── hooks/        # Custom hooks
│   └── lib/          # Utilities & API
├── backend/          # Express backend
│   ├── src/
│   │   ├── api/      # REST API routes
│   │   ├── indexer/  # Blockchain indexer
│   │   └── database/ # Prisma models
│   └── prisma/       # Database schema
├── contracts/        # Solidity contracts
└── scripts/          # Deployment scripts
```

## 🛠 Common Commands

### Backend Commands
```bash
cd backend

# Development
npm run dev              # Start development server
npm run test:seed       # Seed test data
npm run db:reset        # Reset database

# Database
npx prisma studio       # Open database GUI
npx prisma migrate dev  # Run migrations

# Production
npm run build          # Build for production
npm run start:prod     # Start production server
```

### Frontend Commands
```bash
cd frontend

# Development
npm run dev            # Start development server
npm run build          # Build for production
npm run start          # Start production server

# Code Quality
npm run lint           # Run linter
npm run type-check     # Check TypeScript
```

### Smart Contract Commands
```bash
# From root directory

# Testing
npx hardhat test

# Deployment
npx hardhat run scripts/deploy-simple.ts --network abstract-testnet

# Verification
npx hardhat verify --network abstract-testnet CONTRACT_ADDRESS
```

## 🔧 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready

# Check connection
psql -U postgres -c "SELECT 1"

# Reset database
cd backend
npm run db:reset
npm run test:seed
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different ports
PORT=3001 npm run dev  # Frontend
PORT=5001 npm run dev  # Backend
```

### Module Not Found
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Next.js cache
rm -rf .next
```

### WebSocket Connection Failed
- Check backend is running on port 5000
- Check no firewall blocking WebSocket
- Try `ws://localhost:5000` directly

## 🚢 Docker Setup (Alternative)

For a containerized setup:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📚 Next Steps

1. **Read Documentation**
   - [TEST_INTEGRATION.md](./TEST_INTEGRATION.md) - Full testing guide
   - [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment

2. **Customize Platform**
   - Modify token creation parameters
   - Add new trading features
   - Customize UI theme

3. **Deploy to Production**
   - Deploy contracts to mainnet
   - Set up production database
   - Configure domain and SSL

## 🆘 Getting Help

- Check existing issues on GitHub
- Join our Discord community
- Read the [FAQ](./docs/FAQ.md)
- Contact support

---

Happy building! 🚀