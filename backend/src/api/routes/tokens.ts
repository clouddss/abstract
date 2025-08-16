import { Router } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import { prisma } from '../../database/client';
import { validateRequest } from '../middleware/validation';
import { Interval } from '@prisma/client';
import tokenLaunchRouter from './tokens-launch';

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
    
    // Build where clause
    const where: any = {};
    
    if (creator) {
      where.creator = creator;
    }
    
    if (migrated !== undefined) {
      where.migrated = migrated;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { symbol: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Build order by
    let orderBy: any = {};
    switch (sort) {
      case 'volume':
        orderBy = { volumeTotal: order };
        break;
      case 'marketCap':
        orderBy = { marketCap: order };
        break;
      case 'holders':
        orderBy = { holderCount: order };
        break;
      default:
        orderBy = { createdAt: order };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get tokens and total count
    const [tokens, total] = await Promise.all([
      prisma.token.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              trades: true,
              holders: true
            }
          }
        }
      }),
      prisma.token.count({ where })
    ]);

    // Format response
    const formattedTokens = tokens.map(token => ({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      description: token.description,
      imageUrl: token.imageUrl,
      website: token.website,
      twitter: token.twitter,
      telegram: token.telegram,
      creator: token.creator,
      bondingCurve: token.bondingCurve,
      migrated: token.migrated,
      migratedAt: token.migratedAt,
      dexPair: token.dexPair,
      totalSupply: token.totalSupply,
      soldSupply: token.soldSupply,
      marketCap: token.marketCap,
      volume24h: token.volume24h,
      volume7d: token.volume7d,
      volumeTotal: token.volumeTotal,
      holders: token.holderCount,
      trades: token._count.trades,
      createdAt: token.createdAt,
      progress: calculateProgress(token.soldSupply, token.curveSupply)
    }));

    res.json({
      success: true,
      data: {
        tokens: formattedTokens,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
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

    const token = await prisma.token.findUnique({
      where: { address: address.toLowerCase() },
      include: {
        trades: {
          orderBy: { timestamp: 'desc' },
          take: 10
        },
        holders: {
          orderBy: { balance: 'desc' },
          take: 50,
          where: {
            balance: { gt: '0' }
          }
        },
        _count: {
          select: {
            trades: true,
            holders: true
          }
        }
      }
    });

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    // Calculate additional metrics
    const progress = calculateProgress(token.soldSupply, token.curveSupply);
    const currentPrice = await getCurrentTokenPrice(address);
    
    // Get 24h price change
    const priceChange24h = await getPriceChange24h(address);

    // Format holders
    const topHolders = token.holders.map(holder => ({
      address: holder.wallet,
      balance: holder.balance,
      percentage: calculateHolderPercentage(holder.balance, token.soldSupply),
      firstBought: holder.firstBoughtAt,
      lastActivity: holder.lastActivity
    }));

    // Format recent trades
    const recentTrades = token.trades.map(trade => ({
      id: trade.id,
      type: trade.type,
      trader: trade.trader,
      amountIn: trade.amountIn,
      amountOut: trade.amountOut,
      price: trade.price,
      timestamp: trade.timestamp,
      txHash: trade.txHash
    }));

    res.json({
      success: true,
      data: {
        ...token,
        progress,
        currentPrice,
        priceChange24h,
        topHolders,
        recentTrades,
        stats: {
          totalTrades: token._count.trades,
          totalHolders: token._count.holders
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

    const priceData = await prisma.priceData.findMany({
      where: {
        tokenAddress: address,
        interval: dbInterval as Interval,
        ...(Object.keys(timeRange).length > 0 && { timestamp: timeRange })
      },
      orderBy: { timestamp: 'asc' }
    });

    const chartData = priceData.map(point => ({
      timestamp: point.timestamp.getTime(),
      open: parseFloat(point.open),
      high: parseFloat(point.high),
      low: parseFloat(point.low),
      close: parseFloat(point.close),
      volume: point.volume
    }));

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
    const skip = (page - 1) * limit;

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where: { tokenAddress: address.toLowerCase() },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit
      }),
      prisma.trade.count({ where: { tokenAddress: address.toLowerCase() } })
    ]);

    res.json({
      success: true,
      data: {
        trades,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
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
  if (curve === 0n) return 0;
  return Number((sold * 10000n) / curve) / 100; // Percentage
}

function calculateHolderPercentage(balance: string, totalSupply: string): number {
  const holderBalance = BigInt(balance);
  const total = BigInt(totalSupply);
  if (total === 0n) return 0;
  return Number((holderBalance * 10000n) / total) / 100; // Percentage
}

async function getCurrentTokenPrice(address: string): Promise<string> {
  try {
    // Get token from database to find bonding curve
    const token = await prisma.token.findUnique({
      where: { address: address.toLowerCase() },
      select: { bondingCurve: true, migrated: true }
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
      return latestTrade?.price || '0';
    }
    
    // Get price from bonding curve contract
    const { getProvider, BONDING_CURVE_ABI } = await import('../../contracts/LaunchFactory');
    const provider = getProvider();
    const bondingCurve = new ethers.Contract(
      token.bondingCurve,
      BONDING_CURVE_ABI,
      provider
    );
    
    const price = await bondingCurve.getCurrentPrice();
    return ethers.formatEther(price);
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

    const currentPrice = parseFloat(currentTrade.price);
    const oldPrice = parseFloat(oldTrade.price);

    if (oldPrice === 0) return 0;

    return ((currentPrice - oldPrice) / oldPrice) * 100;
  } catch {
    return 0;
  }
}

export default router;