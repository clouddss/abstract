import { PrismaClient, TradeType, Interval } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

// Test wallets
const TEST_WALLETS = [
  '0x1234567890123456789012345678901234567890',
  '0x2345678901234567890123456789012345678901',
  '0x3456789012345678901234567890123456789012',
  '0x4567890123456789012345678901234567890123',
  '0x5678901234567890123456789012345678901234',
  '0x6789012345678901234567890123456789012345',
  '0x7890123456789012345678901234567890123456',
  '0x8901234567890123456789012345678901234567',
  '0x9012345678901234567890123456789012345678',
  '0x0123456789012345678901234567890123456789',
];

// Test token data
const TEST_TOKENS = [
  {
    name: 'Alpha Token',
    symbol: 'ALPHA',
    description: 'The first test token with high activity',
    imageUrl: 'https://placehold.co/400x400/e3f2fd/1976d2?text=ALPHA',
    progress: 85,
    holders: 150,
    volume: '250000000000000000000', // 250 ETH
  },
  {
    name: 'Beta Coin',
    symbol: 'BETA',
    description: 'Second test token with moderate trading',
    imageUrl: 'https://placehold.co/400x400/fce4ec/d81b60?text=BETA',
    progress: 60,
    holders: 85,
    volume: '150000000000000000000', // 150 ETH
  },
  {
    name: 'Gamma Protocol',
    symbol: 'GAMMA',
    description: 'Protocol token for testing governance features',
    imageUrl: 'https://placehold.co/400x400/f3e5f5/7b1fa2?text=GAMMA',
    progress: 40,
    holders: 45,
    volume: '75000000000000000000', // 75 ETH
  },
  {
    name: 'Delta Finance',
    symbol: 'DELTA',
    description: 'DeFi focused test token',
    imageUrl: 'https://placehold.co/400x400/e8f5e9/388e3c?text=DELTA',
    progress: 95,
    holders: 200,
    volume: '500000000000000000000', // 500 ETH
  },
  {
    name: 'Epsilon Network',
    symbol: 'EPS',
    description: 'Network utility token for testing',
    imageUrl: 'https://placehold.co/400x400/fff3e0/f57c00?text=EPS',
    progress: 25,
    holders: 30,
    volume: '25000000000000000000', // 25 ETH
  },
  {
    name: 'Zeta Gaming',
    symbol: 'ZETA',
    description: 'Gaming ecosystem test token',
    imageUrl: 'https://placehold.co/400x400/ffebee/c62828?text=ZETA',
    progress: 70,
    holders: 120,
    volume: '180000000000000000000', // 180 ETH
  },
  {
    name: 'Eta Social',
    symbol: 'ETA',
    description: 'Social platform test token',
    imageUrl: 'https://placehold.co/400x400/e1f5fe/0097a7?text=ETA',
    progress: 50,
    holders: 65,
    volume: '90000000000000000000', // 90 ETH
  },
  {
    name: 'Theta Vault',
    symbol: 'THETA',
    description: 'Yield vault test token',
    imageUrl: 'https://placehold.co/400x400/f1f8e9/827717?text=THETA',
    progress: 30,
    holders: 40,
    volume: '40000000000000000000', // 40 ETH
  },
  {
    name: 'Iota Bridge',
    symbol: 'IOTA',
    description: 'Cross-chain bridge test token',
    imageUrl: 'https://placehold.co/400x400/efebe9/5d4037?text=IOTA',
    progress: 80,
    holders: 95,
    volume: '200000000000000000000', // 200 ETH
  },
  {
    name: 'Kappa Meme',
    symbol: 'KAPPA',
    description: 'The ultimate meme test token 🚀',
    imageUrl: 'https://placehold.co/400x400/e8eaf6/3f51b5?text=KAPPA',
    progress: 99,
    holders: 500,
    volume: '1000000000000000000000', // 1000 ETH
  },
];

// Helper functions
function generateAddress(): string {
  return ethers.Wallet.createRandom().address.toLowerCase();
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

async function seedTestData() {
  console.log('🌱 Starting test data seeding...');

  try {
    // Clear existing data
    console.log('🧹 Clearing existing test data...');
    await prisma.trade.deleteMany({});
    await prisma.holder.deleteMany({});
    await prisma.priceData.deleteMany({});
    await prisma.rewardDistribution.deleteMany({});
    await prisma.rewardEpoch.deleteMany({});
    await prisma.token.deleteMany({});
    await prisma.platformStats.deleteMany({});

    console.log('✅ Existing data cleared');

    // Create test tokens
    console.log('🪙 Creating test tokens...');
    const tokens = [];

    for (const tokenData of TEST_TOKENS) {
      const tokenAddress = generateAddress();
      const bondingCurveAddress = generateAddress();
      const creatorAddress = randomElement(TEST_WALLETS);
      
      const curveSupply = '700000000000000000000000000'; // 700M tokens
      const soldSupply = ethers.parseUnits(
        (700000000 * tokenData.progress / 100).toString(),
        18
      ).toString();
      
      const token = await prisma.token.create({
        data: {
          address: tokenAddress,
          name: tokenData.name,
          symbol: tokenData.symbol,
          description: tokenData.description,
          imageUrl: tokenData.imageUrl,
          website: `https://${tokenData.symbol.toLowerCase()}.example.com`,
          twitter: `${tokenData.symbol.toLowerCase()}_token`,
          telegram: `${tokenData.symbol.toLowerCase()}_community`,
          creator: creatorAddress,
          bondingCurve: bondingCurveAddress,
          curveSupply,
          soldSupply,
          volumeTotal: tokenData.volume,
          volume24h: ethers.parseUnits(
            (parseFloat(ethers.formatEther(tokenData.volume)) * 0.3).toString(),
            18
          ).toString(),
          volume7d: ethers.parseUnits(
            (parseFloat(ethers.formatEther(tokenData.volume)) * 0.7).toString(),
            18
          ).toString(),
          marketCap: ethers.parseUnits(
            (tokenData.progress * 10).toString(),
            18
          ).toString(),
          holderCount: tokenData.holders,
          migrated: tokenData.progress >= 100,
          migratedAt: tokenData.progress >= 100 ? new Date() : null,
          createdAt: new Date(Date.now() - randomBetween(1, 30) * 24 * 60 * 60 * 1000),
        },
      });
      
      tokens.push(token);
      console.log(`✅ Created token: ${token.name} (${token.symbol})`);
    }

    // Create trades for each token
    console.log('💱 Creating test trades...');
    let totalTrades = 0;

    for (const token of tokens) {
      const tradeCount = randomBetween(50, 200);
      const baseTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
      
      for (let i = 0; i < tradeCount; i++) {
        const trader = randomElement(TEST_WALLETS);
        const isBuy = Math.random() > 0.4; // 60% buys, 40% sells
        const timestamp = new Date(baseTime + (i / tradeCount) * 7 * 24 * 60 * 60 * 1000);
        
        const ethAmount = ethers.parseUnits(
          (Math.random() * 2 + 0.1).toFixed(4),
          18
        ).toString();
        
        const tokenAmount = ethers.parseUnits(
          (Math.random() * 1000000 + 10000).toFixed(0),
          18
        ).toString();
        
        const price = ethers.parseUnits(
          (Math.random() * 0.001 + 0.0001).toFixed(6),
          18
        ).toString();
        
        await prisma.trade.create({
          data: {
            tokenAddress: token.address,
            trader,
            type: isBuy ? TradeType.BUY : TradeType.SELL,
            amountIn: isBuy ? ethAmount : tokenAmount,
            amountOut: isBuy ? tokenAmount : ethAmount,
            price,
            feeAmount: ethers.parseUnits(
              (parseFloat(ethers.formatEther(ethAmount)) * 0.01).toString(),
              18
            ).toString(),
            txHash: `0x${Buffer.from(ethers.randomBytes(32)).toString('hex')}`,
            blockNumber: 1000000 + i,
            blockHash: `0x${Buffer.from(ethers.randomBytes(32)).toString('hex')}`,
            logIndex: 0,
            timestamp,
          },
        });
        
        totalTrades++;
      }
    }

    console.log(`✅ Created ${totalTrades} trades`);

    // Create holders for each token
    console.log('👥 Creating test holders...');
    let totalHolders = 0;

    for (const token of tokens) {
      const holderCount = Math.min(token.holderCount, TEST_WALLETS.length);
      const holders = TEST_WALLETS.slice(0, holderCount);
      
      for (const wallet of holders) {
        const balance = ethers.parseUnits(
          (Math.random() * 10000000 + 100000).toFixed(0),
          18
        ).toString();
        
        await prisma.holder.create({
          data: {
            tokenAddress: token.address,
            wallet,
            balance,
            avgHoldTime: randomBetween(3600, 604800), // 1 hour to 1 week
            firstBoughtAt: new Date(Date.now() - randomBetween(1, 30) * 24 * 60 * 60 * 1000),
            totalBought: balance,
            totalSold: '0',
            realizedPnl: ethers.parseUnits(
              (Math.random() * 10 - 5).toFixed(4),
              18
            ).toString(),
            unrealizedPnl: ethers.parseUnits(
              (Math.random() * 20 - 10).toFixed(4),
              18
            ).toString(),
          },
        });
        
        totalHolders++;
      }
    }

    console.log(`✅ Created ${totalHolders} holder records`);

    // Create price data for charts
    console.log('📊 Creating price chart data...');
    let totalPricePoints = 0;

    for (const token of tokens) {
      const now = new Date();
      const intervals = [
        { type: Interval.MINUTE_1, count: 60, duration: 60 * 1000 },
        { type: Interval.HOUR_1, count: 24, duration: 60 * 60 * 1000 },
        { type: Interval.DAY_1, count: 30, duration: 24 * 60 * 60 * 1000 },
      ];
      
      for (const interval of intervals) {
        let basePrice = Math.random() * 0.001 + 0.0001;
        
        for (let i = 0; i < interval.count; i++) {
          const timestamp = new Date(now.getTime() - (interval.count - i) * interval.duration);
          const volatility = 0.05;
          
          const open = basePrice;
          const change = (Math.random() - 0.5) * volatility;
          const close = open * (1 + change);
          const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
          const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
          
          await prisma.priceData.create({
            data: {
              tokenAddress: token.address,
              timestamp,
              open: ethers.parseUnits(open.toFixed(8), 18).toString(),
              high: ethers.parseUnits(high.toFixed(8), 18).toString(),
              low: ethers.parseUnits(low.toFixed(8), 18).toString(),
              close: ethers.parseUnits(close.toFixed(8), 18).toString(),
              volume: ethers.parseUnits(
                (Math.random() * 100 + 10).toFixed(4),
                18
              ).toString(),
              volumeUsd: ethers.parseUnits(
                (Math.random() * 100000 + 1000).toFixed(2),
                18
              ).toString(),
              interval: interval.type,
            },
          });
          
          basePrice = close;
          totalPricePoints++;
        }
      }
    }

    console.log(`✅ Created ${totalPricePoints} price data points`);

    // Create reward epochs and distributions
    console.log('🎁 Creating reward epochs and distributions...');
    
    const currentEpoch = await prisma.rewardEpoch.create({
      data: {
        epochNumber: 1,
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        totalEthRewards: ethers.parseUnits('10', 18).toString(),
        totalUsdcRewards: ethers.parseUnits('10000', 6).toString(),
        snapshotTaken: true,
        finalized: false,
      },
    });

    // Create reward distributions for active traders
    for (const wallet of TEST_WALLETS) {
      for (const token of tokens.slice(0, 3)) { // Top 3 tokens
        await prisma.rewardDistribution.create({
          data: {
            epochNumber: currentEpoch.epochNumber,
            tokenAddress: token.address,
            wallet,
            ethAmount: ethers.parseUnits(
              (Math.random() * 0.1 + 0.01).toFixed(4),
              18
            ).toString(),
            usdcAmount: ethers.parseUnits(
              (Math.random() * 100 + 10).toFixed(2),
              6
            ).toString(),
            weight: ethers.parseUnits(
              (Math.random() * 100).toFixed(2),
              18
            ).toString(),
            claimed: Math.random() > 0.7, // 30% claimed
          },
        });
      }
    }

    console.log('✅ Created reward epochs and distributions');

    // Create platform statistics
    console.log('📈 Creating platform statistics...');
    
    const stats = await prisma.platformStats.create({
      data: {
        totalTokens: tokens.length,
        totalTrades: totalTrades,
        totalVolume: tokens.reduce((sum, token) => {
          return (BigInt(sum) + BigInt(token.volumeTotal)).toString();
        }, '0'),
        totalFees: ethers.parseUnits('50', 18).toString(),
        activeTraders: TEST_WALLETS.length,
        newTokens24h: 3,
        volume24h: ethers.parseUnits('1500', 18).toString(),
        fees24h: ethers.parseUnits('15', 18).toString(),
        migratedTokens: tokens.filter(t => t.migrated).length,
        totalHolders: totalHolders,
      },
    });

    console.log('✅ Created platform statistics');

    // Summary
    console.log('\n🎉 Test data seeding completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Tokens: ${tokens.length}`);
    console.log(`   - Trades: ${totalTrades}`);
    console.log(`   - Holders: ${totalHolders}`);
    console.log(`   - Price Points: ${totalPricePoints}`);
    console.log(`   - Test Wallets: ${TEST_WALLETS.length}`);
    
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedTestData()
  .then(() => {
    console.log('✅ Seeding complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });