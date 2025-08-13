# Abstract Pump Platform

A complete Pump.fun-style token launch and trading platform built for the Abstract blockchain (EVM L2). Features bonding curve mechanism, platform fees, rewards distribution, and automated DEX migration.

## 🌟 Features

### Core Features
- **Token Launch**: Create ERC-20 tokens with metadata and bonding curve pricing
- **Bonding Curve Trading**: Exponential price discovery with `price = basePrice * supply^1.5`
- **Automated DEX Migration**: Auto-migrate to Uniswap V2/V3 at 70% curve completion
- **Rewards System**: Daily epoch-based rewards for top-50 holders with merkle proofs
- **Platform Fees**: 0.5% fees split between treasury, creators, and holders
- **Real-time Indexing**: Comprehensive blockchain event monitoring and data indexing

### Smart Contracts
- **LaunchFactory**: Deploy tokens with bonding curves
- **BaseToken**: ERC-20 with EIP-2612 permit and metadata
- **BondingCurve**: Virtual AMM for initial token sales
- **PlatformRouter**: Fee collection and DEX routing
- **RewardsVault**: Epoch-based rewards distribution

### Backend Services
- **Indexer**: Real-time blockchain event monitoring
- **API**: RESTful endpoints for tokens, trades, rewards, and statistics
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for performance optimization

### Frontend
- **Next.js 14**: Modern React framework with App Router
- **TailwindCSS**: Utility-first styling
- **Wagmi**: Ethereum integration
- **TanStack Query**: Data fetching and caching

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### 1. Clone Repository
```bash
git clone <repository-url>
cd Abstract
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start with Docker
```bash
# Start all services
npm run docker:up

# Or start development environment
npm run dev
```

### 4. Access the Platform
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Health: http://localhost:3001/health

## 📋 Environment Variables

### Required Variables
```env
# Network Configuration
ABSTRACT_RPC_URL=https://api.testnet.abs.xyz
DEPLOYER_PRIVATE_KEY=your_private_key_here

# Platform Configuration
PLATFORM_TREASURY_ADDRESS=0x...
UNISWAP_V2_ROUTER=0x...
UNISWAP_V3_ROUTER=0x...

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/abstract_pump
REDIS_URL=redis://localhost:6379

# Contract Addresses (after deployment)
LAUNCH_FACTORY_ADDRESS=0x...
PLATFORM_ROUTER_ADDRESS=0x...
REWARDS_VAULT_ADDRESS=0x...
```

## 🏗️ Architecture

### Smart Contract Architecture
```
LaunchFactory
├── BaseToken (ERC-20 + Metadata)
├── BondingCurve (Virtual AMM)
├── PlatformRouter (Fee Collection)
└── RewardsVault (Epoch Rewards)
```

### Backend Architecture
```
Backend Services
├── API Server (Express.js)
├── Indexer Service (Event Processing)
├── Database (PostgreSQL + Prisma)
└── Cache (Redis)
```

### Frontend Architecture
```
Next.js 14 App
├── Pages (App Router)
├── Components (React + TailwindCSS)
├── Hooks (Data Fetching)
└── Web3 Integration (Wagmi)
```

## 🔧 Development

### Install Dependencies
```bash
# Root dependencies
npm install

# Backend dependencies
cd backend && npm install

# Frontend dependencies
cd frontend && npm install
```

### Database Setup
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### Run Services Individually
```bash
# Backend API
cd backend && npm run dev

# Indexer Service
cd backend && npm run indexer

# Frontend
cd frontend && npm run dev
```

### Smart Contract Development
```bash
# Compile contracts
npm run compile

# Run tests
npm run test

# Deploy to Abstract testnet
npm run deploy:testnet

# Verify contracts
npm run verify
```

## 📊 API Endpoints

### Tokens
- `GET /api/tokens` - List all tokens with filtering
- `GET /api/tokens/:address` - Get token details
- `GET /api/tokens/:address/chart` - Price chart data
- `GET /api/tokens/:address/trades` - Trade history
- `POST /api/tokens/create` - Create new token

### Rewards
- `GET /api/rewards/:wallet` - User's rewards
- `POST /api/rewards/claim` - Claim rewards
- `GET /api/rewards/epochs` - All reward epochs
- `GET /api/rewards/leaderboard` - Rewards leaderboard

### Statistics
- `GET /api/stats/platform` - Platform statistics
- `GET /api/stats/leaderboards` - Various leaderboards
- `GET /api/stats/charts` - Chart data for metrics

## 🧪 Testing

### Smart Contract Tests
```bash
npm run test
```

### API Tests
```bash
cd backend && npm run test
```

### Frontend Tests
```bash
cd frontend && npm run test
```

## 🚀 Deployment

### Smart Contracts
```bash
# Deploy to Abstract testnet
npm run deploy:testnet

# Verify contracts
npm run verify
```

### Backend Services
```bash
# Production build
cd backend && npm run build

# Start production server
npm start

# Start indexer
npm run indexer
```

### Frontend
```bash
# Production build
cd frontend && npm run build

# Start production server
npm start
```

### Docker Production
```bash
# Build and start production services
docker-compose --profile production up -d

# With nginx reverse proxy
docker-compose up nginx
```

## 🔒 Security Features

### Smart Contract Security
- Reentrancy guards on all state-changing functions
- CEI (Checks-Effects-Interactions) pattern
- Access control with role-based permissions
- Slippage protection and MEV resistance
- Flash loan attack prevention
- Integer overflow protection

### Backend Security
- Rate limiting on API endpoints
- Input validation with Zod schemas
- SQL injection prevention with Prisma
- Environment variable validation
- CORS configuration
- Helmet.js security headers

### Frontend Security
- XSS prevention
- CSRF protection
- Secure wallet integration
- Input sanitization
- Environment variable isolation

## 📈 Monitoring & Analytics

### Metrics Tracked
- Total tokens launched
- Trading volume and fees
- User engagement metrics
- Rewards distribution
- Migration success rate
- Platform performance

### Database Schema
- `tokens` - Token information and metadata
- `trades` - All trading activity
- `holders` - Token holder balances and history
- `rewards` - Epoch-based reward distributions
- `platform_stats` - Aggregated platform metrics

## 🛠️ Configuration

### Bonding Curve Parameters
- Base Price: 0.00001 ETH
- Curve Exponent: 1.5
- Migration Threshold: 70% of max supply
- Maximum Supply: 1 billion tokens
- Curve Supply: 700 million tokens

### Fee Structure
- Platform Fee: 0.5%
- Creator Fee: 0.5%
- Total Trading Fee: 1.0%

### Fee Distribution
- Platform Treasury: 50%
- Token Creator: 20%
- Top Holders: 30%

### Rewards System
- Epoch Duration: 24 hours
- Top Holder Count: 50
- Minimum Holding: 0.1% of supply
- Claim Period: 30 days

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For technical support:
- Open an issue on GitHub
- Join our Discord community
- Email: support@abstractpump.xyz

## 🔗 Links

- [Abstract Chain](https://abs.xyz)
- [Documentation](https://docs.abstractpump.xyz)
- [Discord](https://discord.gg/abstractpump)
- [Twitter](https://twitter.com/AbstractPump)

---

Built with ❤️ for the Abstract ecosystem