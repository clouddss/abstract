import { Router } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import { prisma } from '../../database/client';
import { validateRequest } from '../middleware/validation';
import { Interval } from '@prisma/client';
import tokenLaunchRouter from './tokens-launch';
import { queryCacheService } from '../services/queryCache';

const router = Router();

// Mount launch routes
router.use('/', tokenLaunchRouter);

// Validation schemas
const createTokenSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50),
    symbol: z.string().min(1).max(10),
    description: z.string().max(500).optional(),
    imageUrl: z.string().url().optional(),
    website: z.string().url().optional(),
    twitter: z.string().max(50).optional(),
    telegram: z.string().max(50).optional()
  })
});

const getTokensSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
    sort: z.enum(['created', 'volume', 'marketCap', 'holders']).default('created'),
    order: z.enum(['asc', 'desc']).default('desc'),
    creator: z.string().optional(),
    migrated: z.string().transform(val => val === 'true').optional(),
    search: z.string().optional()
  })
});

const getTokenSchema = z.object({
  params: z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  })
});

const getTokenChartSchema = z.object({
  params: z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  }),
  query: z.object({
    interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']).default('1h'),
    from: z.string().transform(val => new Date(val)).optional(),
    to: z.string().transform(val => new Date(val)).optional()
  })
});

/**
 * POST /api/tokens/create
 * Create a new token (this would typically be called by the frontend after deploying)
 */
router.post('/create', validateRequest(createTokenSchema), async (req, res) => {
  try {
    const { name, symbol, description, imageUrl, website, twitter, telegram } = req.body;

    // In a real implementation, this would:
    // 1. Validate the user's wallet signature
    // 2. Call the LaunchFactory contract
    // 3. Return the transaction hash for the user to confirm
    
    res.status(200).json({
      success: true,
      message: 'Token creation initiated. Please confirm the transaction in your wallet.',
      data: {
        estimatedGas: '800000',
        launchFee: '0.01'
      }
    });

  } catch (error) {
    console.error('Error in create token:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/tokens
 * Get all tokens with filtering, sorting, and pagination
 */
router.get('/', validateRequest(getTokensSchema), async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const sort = req.query.sort as string || 'created';
    const order = req.query.order as 'asc' | 'desc' || 'desc';
    const creator = req.query.creator as string | undefined;
    const migrated = req.query.migrated === 'true' ? true : req.query.migrated === 'false' ? false : undefined;
    const search = req.query.search as string | undefined;
    
    // OPTIMIZED: Use cached token list query to reduce database load
    const result = await queryCacheService.getCachedTokenList({
      page,
      limit,
      sort,
      order,
      creator,
      migrated,
      search
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/tokens/:address
 * Get detailed information about a specific token
 */
router.get('/:address', validateRequest(getTokenSchema), async (req, res) => {
  try {
    const { address } = req.params;

    // OPTIMIZED: Use separate optimized queries instead of include to avoid N+1
    const [token, recentTrades, topHolders, tradeCounts] = await Promise.all([
      prisma.token.findUnique({
        where: { address: address.toLowerCase() }
      }),
      // Optimized: Get recent trades with single query
      prisma.trade.findMany({
        where: { tokenAddress: address.toLowerCase() },
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: {
          id: true,
          type: true,
          trader: true,
          amountIn: true,
          amountOut: true,
          price: true,
          timestamp: true,
          txHash: true
        }
      }),
      // Optimized: Get top holders with single query
      prisma.holder.findMany({
        where: {
          tokenAddress: address.toLowerCase(),
          balance: { gt: '0' }
        },
        orderBy: { balance: 'desc' },
        take: 50,
        select: {
          wallet: true,
          balance: true,
          firstBoughtAt: true,
          lastActivity: true
        }
      }),
      // Optimized: Get counts efficiently
      prisma.$queryRaw<Array<{ trade_count: bigint, holder_count: bigint }>>`
        SELECT 
          (SELECT COUNT(*) FROM trades WHERE token_address = ${address.toLowerCase()}) as trade_count,
          (SELECT COUNT(*) FROM holders WHERE token_address = ${address.toLowerCase()} AND balance::numeric > 0) as holder_count
      `
    ]);

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    // Calculate additional metrics
    const bondingCurveProgress = await getBondingCurveProgress(token);
    const migrationProgress = await getMigrationProgress(token);
    const currentPrice = await getCurrentTokenPrice(address);
    
    // Get 24h price change
    const priceChange24h = await getPriceChange24h(address);

    // Calculate bonding curve balance and holder stats
    const bondingCurveBalance = BigInt(token.curveSupply) - BigInt(token.soldSupply);
    const allHolders = [];
    
    // For percentage calculation, we only consider what's actually in circulation
    // This is the sold supply (tokens bought by users)
    const circulatingSupply = BigInt(token.soldSupply);
    
    // Add bonding curve as first holder showing remaining liquidity
    if (bondingCurveBalance > 0n && !token.migrated) {
      // For bonding curve, show it as "Liquidity" with the remaining tokens
      // Don't include it in percentage calculation since it's not circulating
      allHolders.push({
        address: token.bondingCurve,
        balance: bondingCurveBalance.toString(),
        percentage: 0, // Bonding curve doesn't count towards holder percentages
        firstBought: token.createdAt,
        lastActivity: token.updatedAt,
        isBondingCurve: true,
        isLiquidity: true
      });
    }
    
    // Add regular holders with correct percentage of circulating supply
    const regularHolders = topHolders.map(holder => {
      // Calculate percentage based on circulating supply (sold tokens only)
      const percentage = circulatingSupply > 0n 
        ? calculateHolderPercentage(holder.balance, token.soldSupply)
        : 0;
      
      return {
        address: holder.wallet,
        balance: holder.balance,
        percentage,
        firstBought: holder.firstBoughtAt,
        lastActivity: holder.lastActivity,
        isBondingCurve: false,
        isLiquidity: false
      };
    });
    
    allHolders.push(...regularHolders);
    
    // Sort holders: Bonding curve first, then by balance descending
    const topHolders = allHolders
      .sort((a, b) => {
        // Bonding curve always comes first
        if (a.isBondingCurve) return -1;
        if (b.isBondingCurve) return 1;
        
        // Then sort by balance
        const balA = BigInt(a.balance);
        const balB = BigInt(b.balance);
        return balB > balA ? 1 : balB < balA ? -1 : 0;
      })
      .slice(0, 10);

    // Format recent trades - already optimized above

    res.json({
      success: true,
      data: {
        ...token,
        bondingCurveProgress,
        migrationProgress,
        currentPrice,
        priceChange24h,
        topHolders,
        recentTrades,
        stats: {
          totalTrades: Number(tradeCounts[0]?.trade_count || 0),
          totalHolders: Number(tradeCounts[0]?.holder_count || 0),
          actualHolders: topHolders.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching token details:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/tokens/:address/chart
 * Get price chart data for a token
 */
router.get('/:address/chart', validateRequest(getTokenChartSchema), async (req, res) => {
  try {
    const { address } = req.params;
    const interval = req.query.interval as string || '1h';
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    // Convert interval to database enum
    const intervalMap: Record<string, string> = {
      '1m': 'MINUTE_1',
      '5m': 'MINUTE_5',
      '15m': 'MINUTE_15',
      '1h': 'HOUR_1',
      '4h': 'HOUR_4',
      '1d': 'DAY_1',
      '1w': 'WEEK_1'
    };

    const dbInterval = intervalMap[interval];
    if (!dbInterval) {
      return res.status(400).json({
        success: false,
        error: 'Invalid interval'
      });
    }

    // Build time range
    const timeRange: any = {};
    if (from) timeRange.gte = from;
    if (to) timeRange.lte = to;

    // Default time range if not specified
    if (!from && !to) {
      const now = new Date();
      const defaultRanges: Record<string, number> = {
        '1m': 24 * 60, // 24 hours in minutes
        '5m': 7 * 24 * 12, // 7 days in 5-minute intervals
        '15m': 30 * 24 * 4, // 30 days in 15-minute intervals
        '1h': 90 * 24, // 90 days in hours
        '4h': 365 * 6, // 365 days in 4-hour intervals
        '1d': 365 * 2, // 2 years in days
        '1w': 365 * 5 // 5 years in weeks
      };

      const minutesBack = defaultRanges[interval] || 24 * 60;
      timeRange.gte = new Date(now.getTime() - minutesBack * 60 * 1000);
    }

    // OPTIMIZED: Use cached price data query
    const chartData = await queryCacheService.getCachedPriceData(
      address,
      dbInterval,
      from,
      to
    );

    res.json({
      success: true,
      data: {
        interval,
        data: chartData
      }
    });

  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/tokens/:address/trades
 * Get trade history for a token
 */
router.get('/:address/trades', async (req, res) => {
  try {
    const { address } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    // OPTIMIZED: Use cached trade history query
    const result = await queryCacheService.getCachedTradeHistory(
      address.toLowerCase(),
      page,
      limit
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Helper functions
function calculateProgress(soldSupply: string, curveSupply: string): number {
  const sold = BigInt(soldSupply);
  const curve = BigInt(curveSupply);
  // FIXED: Prevent division by zero
  if (curve === 0n) return 0;
  return Number((sold * 10000n) / curve) / 100; // Percentage
}

function calculateHolderPercentage(balance: string, totalSupply: string): number {
  const holderBalance = BigInt(balance);
  const total = BigInt(totalSupply);
  // FIXED: Prevent division by zero
  if (total === 0n) return 0;
  return Number((holderBalance * 10000n) / total) / 100; // Percentage
}

async function getCurrentTokenPrice(address: string): Promise<string> {
  try {
    // Get token from database to find bonding curve
    const token = await prisma.token.findUnique({
      where: { address: address.toLowerCase() },
      select: { bondingCurve: true, migrated: true, marketCap: true, soldSupply: true }
    });
    
    if (!token || !token.bondingCurve) {
      return '0';
    }
    
    // If migrated, get price from trades
    if (token.migrated) {
      const latestTrade = await prisma.trade.findFirst({
        where: { tokenAddress: address.toLowerCase() },
        orderBy: { timestamp: 'desc' }
      });
      return latestTrade?.price ? ethers.formatEther(latestTrade.price) : '0';
    }
    
    // Get price from bonding curve contract
    const { getProvider, BONDING_CURVE_ABI } = await import('../../contracts/LaunchFactory');
    const provider = getProvider();
    const bondingCurve = new ethers.Contract(
      token.bondingCurve,
      BONDING_CURVE_ABI,
      provider
    );
    
    try {
      const price = await bondingCurve.getCurrentPrice();
      return ethers.formatEther(price);
    } catch {
      // Fallback: calculate price from market cap and supply
      if (token.marketCap && token.soldSupply && BigInt(token.soldSupply) > 0n) {
        const marketCapWei = BigInt(token.marketCap);
        const soldSupply = BigInt(token.soldSupply);
        // FIXED: Use BigInt arithmetic to prevent precision loss
        const priceWei = (marketCapWei * ethers.parseEther('1')) / soldSupply;
        return ethers.formatEther(priceWei);
      }
      return '0.000001'; // Default minimum price
    }
  } catch (error) {
    console.error('Error getting token price:', error);
    return '0';
  }
}

async function getPriceChange24h(address: string): Promise<number> {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [currentTrade, oldTrade] = await Promise.all([
      prisma.trade.findFirst({
        where: { tokenAddress: address.toLowerCase() },
        orderBy: { timestamp: 'desc' }
      }),
      prisma.trade.findFirst({
        where: { 
          tokenAddress: address.toLowerCase(),
          timestamp: { lte: oneDayAgo }
        },
        orderBy: { timestamp: 'desc' }
      })
    ]);

    if (!currentTrade || !oldTrade) return 0;

    // FIXED: Use BigInt arithmetic for precise calculation, then convert to float for percentage
    const currentPriceBig = BigInt(currentTrade.price);
    const oldPriceBig = BigInt(oldTrade.price);

    // FIXED: Prevent division by zero
    if (oldPriceBig === 0n) return 0;

    // Calculate percentage change using BigInt arithmetic for precision
    const priceDifference = currentPriceBig - oldPriceBig;
    const percentageChange = Number((priceDifference * 10000n) / oldPriceBig) / 100;
    
    return percentageChange;
  } catch {
    return 0;
  }
}

/**
 * Calculate bonding curve progress (how much of the curve is sold)
 */
async function getBondingCurveProgress(token: any): Promise<number> {
  try {
    if (!token.bondingCurve) return 0;
    
    const { getProvider, BONDING_CURVE_ABI } = await import('../../contracts/LaunchFactory');
    const provider = getProvider();
    const bondingCurve = new ethers.Contract(
      token.bondingCurve,
      BONDING_CURVE_ABI,
      provider
    );
    
    // Try to get actual progress from contract
    try {
      const [tokensSold, maxSupply] = await Promise.all([
        bondingCurve.tokensSold ? bondingCurve.tokensSold() : BigInt(token.soldSupply || '0'),
        bondingCurve.maxSupply ? bondingCurve.maxSupply() : BigInt(token.curveSupply || '700000000000000000000000000')
      ]);
      
      // FIXED: Prevent division by zero
      if (maxSupply === 0n) return 0;
      // FIXED: Use proper BigInt arithmetic to avoid precision loss
      return Number((tokensSold * 10000n) / maxSupply) / 100;
    } catch {
      // Fallback to database values
      const sold = BigInt(token.soldSupply || '0');
      const curve = BigInt(token.curveSupply || '700000000000000000000000000');
      // FIXED: Prevent division by zero
      if (curve === 0n) return 0;
      // FIXED: Use proper BigInt arithmetic to avoid precision loss
      return Number((sold * 10000n) / curve) / 100;
    }
  } catch (error) {
    console.error('Error calculating bonding curve progress:', error);
    return 0;
  }
}

/**
 * Calculate migration progress (ETH raised vs migration threshold)
 */
async function getMigrationProgress(token: any): Promise<number> {
  try {
    if (!token.bondingCurve) return 0;
    
    const { getProvider, BONDING_CURVE_ABI } = await import('../../contracts/LaunchFactory');
    const provider = getProvider();
    const bondingCurve = new ethers.Contract(
      token.bondingCurve,
      BONDING_CURVE_ABI,
      provider
    );
    
    // Migration threshold is typically 85 ETH for Abstract
    const MIGRATION_THRESHOLD = ethers.parseEther('85');
    
    try {
      // Get current ETH balance in bonding curve
      const ethBalance = await provider.getBalance(token.bondingCurve);
      
      // FIXED: Prevent division by zero
      if (MIGRATION_THRESHOLD === 0n) return 100;
      // FIXED: Use proper BigInt arithmetic to avoid precision loss
      const progress = Number((ethBalance * 10000n) / MIGRATION_THRESHOLD) / 100;
      return Math.min(progress, 100); // Cap at 100%
    } catch {
      // Fallback calculation based on volume
      const volumeTotal = BigInt(token.volumeTotal || '0');
      // FIXED: Prevent division by zero and use proper BigInt arithmetic
      if (MIGRATION_THRESHOLD === 0n) return 100;
      const progress = Number((volumeTotal * 10000n) / MIGRATION_THRESHOLD) / 100;
      return Math.min(progress, 100);
    }
  } catch (error) {
    console.error('Error calculating migration progress:', error);
    return 0;
  }
}

export default router;