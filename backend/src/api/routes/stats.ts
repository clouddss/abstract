import { Router } from 'express';
import { prisma } from '../../database/client';

const router = Router();

/**
 * GET /api/stats/platform
 * Get overall platform statistics
 */
router.get('/platform', async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '24h';

    // Get the latest platform stats
    const latestStats = await prisma.platformStats.findFirst({
      orderBy: { date: 'desc' }
    });

    // Calculate timeframe-specific stats
    const now = new Date();
    let startTime: Date;
    
    switch (timeframe) {
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get aggregated stats for the timeframe
    const [
      totalTokens,
      totalMigrated,
      totalTrades,
      totalVolume,
      totalFees,
      uniqueTraders
    ] = await Promise.all([
      prisma.token.count(),
      prisma.token.count({ where: { migrated: true } }),
      prisma.trade.count({ where: { timestamp: { gte: startTime } } }),
      prisma.trade.aggregate({
        where: { timestamp: { gte: startTime } },
        _sum: { amountIn: true }
      }),
      prisma.trade.aggregate({
        where: { timestamp: { gte: startTime } },
        _sum: { feeAmount: true }
      }),
      prisma.trade.groupBy({
        by: ['trader'],
        where: { timestamp: { gte: startTime } }
      }).then(result => result.length)
    ]);

    // Get trending tokens (most volume in timeframe)
    const trendingTokens = await prisma.token.findMany({
      include: {
        trades: {
          where: { timestamp: { gte: startTime } },
          select: { amountIn: true }
        }
      },
      take: 10
    });

    const trendingWithVolume = trendingTokens
      .map(token => ({
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        imageUrl: token.imageUrl,
        volume: token.trades.reduce((sum, trade) => sum + BigInt(trade.amountIn), 0n).toString(),
        progress: calculateProgress(token.soldSupply, token.curveSupply)
      }))
      .sort((a, b) => Number(BigInt(b.volume) - BigInt(a.volume)))
      .slice(0, 5);

    // Get recent launches
    const recentLaunches = await prisma.token.findMany({
      where: { createdAt: { gte: startTime } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        address: true,
        name: true,
        symbol: true,
        imageUrl: true,
        creator: true,
        createdAt: true,
        soldSupply: true,
        curveSupply: true
      }
    });

    const recentWithProgress = recentLaunches.map(token => ({
      ...token,
      progress: calculateProgress(token.soldSupply, token.curveSupply)
    }));

    res.json({
      success: true,
      data: {
        timeframe,
        overview: {
          totalTokens,
          totalMigrated,
          totalTrades,
          totalVolume: totalVolume._sum.amountIn || '0',
          totalFees: totalFees._sum.feeAmount || '0',
          uniqueTraders,
          migrationRate: totalTokens > 0 ? (totalMigrated / totalTokens) * 100 : 0
        },
        trending: trendingWithVolume,
        recentLaunches: recentWithProgress,
        historical: latestStats ? {
          totalTokensAllTime: latestStats.totalTokens,
          totalVolumeAllTime: latestStats.totalVolume,
          totalFeesAllTime: latestStats.totalFees,
          totalTradesAllTime: latestStats.totalTrades
        } : null
      }
    });

  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/stats/leaderboards
 * Get various leaderboards
 */
router.get('/leaderboards', async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '24h';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    // Calculate time filter
    const now = new Date();
    let startTime: Date;
    
    switch (timeframe) {
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Top traders by volume
    const topTraders = await prisma.trade.groupBy({
      by: ['trader'],
      where: { timestamp: { gte: startTime } },
      _sum: {
        amountIn: true,
        feeAmount: true
      },
      _count: {
        _all: true
      },
      orderBy: {
        _sum: {
          amountIn: 'desc'
        }
      },
      take: limit
    });

    // Top tokens by volume
    const topTokensByVolume = await prisma.trade.groupBy({
      by: ['tokenAddress'],
      where: { timestamp: { gte: startTime } },
      _sum: {
        amountIn: true
      },
      _count: {
        _all: true
      },
      orderBy: {
        _sum: {
          amountIn: 'desc'
        }
      },
      take: limit
    });

    // Get token details for top tokens
    const tokenAddresses = topTokensByVolume.map(t => t.tokenAddress);
    const tokenDetails = await prisma.token.findMany({
      where: { address: { in: tokenAddresses } },
      select: {
        address: true,
        name: true,
        symbol: true,
        imageUrl: true,
        soldSupply: true,
        curveSupply: true
      }
    });

    const topTokensWithDetails = topTokensByVolume.map(tokenStat => {
      const token = tokenDetails.find(t => t.address === tokenStat.tokenAddress);
      return {
        address: tokenStat.tokenAddress,
        name: token?.name || 'Unknown',
        symbol: token?.symbol || 'UNK',
        imageUrl: token?.imageUrl,
        volume: tokenStat._sum.amountIn || '0',
        trades: tokenStat._count._all,
        progress: token ? calculateProgress(token.soldSupply, token.curveSupply) : 0
      };
    });

    // Top holders by value
    const topHolders = await prisma.$queryRaw<Array<{
      wallet: string;
      totalValue: string;
      tokenCount: number;
    }>>`
      SELECT 
        h.wallet,
        SUM(CAST(h.balance AS NUMERIC) * CAST(t.market_cap AS NUMERIC) / CAST(t.sold_supply AS NUMERIC)) as total_value,
        COUNT(DISTINCT h.token_address) as token_count
      FROM holders h
      JOIN tokens t ON h.token_address = t.address
      WHERE CAST(h.balance AS NUMERIC) > 0
      GROUP BY h.wallet
      ORDER BY total_value DESC
      LIMIT ${limit}
    `;

    // Format leaderboards
    const formattedTraders = topTraders.map((trader, index) => ({
      rank: index + 1,
      address: trader.trader,
      volume: trader._sum.amountIn || '0',
      fees: trader._sum.feeAmount || '0',
      trades: trader._count._all
    }));

    const formattedTokens = topTokensWithDetails.map((token, index) => ({
      rank: index + 1,
      ...token
    }));

    const formattedHolders = topHolders.map((holder, index) => ({
      rank: index + 1,
      address: holder.wallet,
      totalValue: holder.totalValue,
      tokenCount: holder.tokenCount
    }));

    res.json({
      success: true,
      data: {
        timeframe,
        topTraders: formattedTraders,
        topTokens: formattedTokens,
        topHolders: formattedHolders
      }
    });

  } catch (error) {
    console.error('Error fetching leaderboards:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/stats/charts
 * Get chart data for various metrics
 */
router.get('/charts', async (req, res) => {
  try {
    const metric = req.query.metric as string || 'volume';
    const timeframe = req.query.timeframe as string || '7d';
    
    // Calculate time range
    const now = new Date();
    let startTime: Date;
    let interval: string;
    
    switch (timeframe) {
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        interval = 'hour';
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        interval = 'day';
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        interval = 'day';
        break;
      default:
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        interval = 'day';
    }

    let chartData: Array<{ timestamp: Date; value: string }> = [];

    switch (metric) {
      case 'volume':
        chartData = await getVolumeChart(startTime, interval);
        break;
      case 'trades':
        chartData = await getTradesChart(startTime, interval);
        break;
      case 'tokens':
        chartData = await getTokensChart(startTime, interval);
        break;
      case 'users':
        chartData = await getUsersChart(startTime, interval);
        break;
      default:
        chartData = await getVolumeChart(startTime, interval);
    }

    const formattedData = chartData.map(point => ({
      timestamp: point.timestamp.getTime(),
      value: parseFloat(point.value)
    }));

    res.json({
      success: true,
      data: {
        metric,
        timeframe,
        interval,
        data: formattedData
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

// Helper functions
function calculateProgress(soldSupply: string, curveSupply: string): number {
  const sold = BigInt(soldSupply);
  const curve = BigInt(curveSupply);
  if (curve === 0n) return 0;
  return Number((sold * 10000n) / curve) / 100;
}

async function getVolumeChart(startTime: Date, interval: string): Promise<Array<{ timestamp: Date; value: string }>> {
  // This is a simplified implementation
  // In production, you'd use proper time-series aggregation
  const trades = await prisma.trade.findMany({
    where: { timestamp: { gte: startTime } },
    select: { timestamp: true, amountIn: true },
    orderBy: { timestamp: 'asc' }
  });

  // Group by interval
  const grouped = new Map<string, bigint>();
  
  trades.forEach(trade => {
    const key = interval === 'hour' 
      ? trade.timestamp.toISOString().substring(0, 13) + ':00:00.000Z'
      : trade.timestamp.toISOString().substring(0, 10) + 'T00:00:00.000Z';
    
    const current = grouped.get(key) || 0n;
    grouped.set(key, current + BigInt(trade.amountIn));
  });

  return Array.from(grouped.entries()).map(([timestamp, value]) => ({
    timestamp: new Date(timestamp),
    value: value.toString()
  }));
}

async function getTradesChart(startTime: Date, interval: string): Promise<Array<{ timestamp: Date; value: string }>> {
  const trades = await prisma.trade.findMany({
    where: { timestamp: { gte: startTime } },
    select: { timestamp: true },
    orderBy: { timestamp: 'asc' }
  });

  const grouped = new Map<string, number>();
  
  trades.forEach(trade => {
    const key = interval === 'hour' 
      ? trade.timestamp.toISOString().substring(0, 13) + ':00:00.000Z'
      : trade.timestamp.toISOString().substring(0, 10) + 'T00:00:00.000Z';
    
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });

  return Array.from(grouped.entries()).map(([timestamp, value]) => ({
    timestamp: new Date(timestamp),
    value: value.toString()
  }));
}

async function getTokensChart(startTime: Date, interval: string): Promise<Array<{ timestamp: Date; value: string }>> {
  const tokens = await prisma.token.findMany({
    where: { createdAt: { gte: startTime } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' }
  });

  const grouped = new Map<string, number>();
  
  tokens.forEach(token => {
    const key = interval === 'hour' 
      ? token.createdAt.toISOString().substring(0, 13) + ':00:00.000Z'
      : token.createdAt.toISOString().substring(0, 10) + 'T00:00:00.000Z';
    
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });

  return Array.from(grouped.entries()).map(([timestamp, value]) => ({
    timestamp: new Date(timestamp),
    value: value.toString()
  }));
}

async function getUsersChart(startTime: Date, interval: string): Promise<Array<{ timestamp: Date; value: string }>> {
  const trades = await prisma.trade.findMany({
    where: { timestamp: { gte: startTime } },
    select: { timestamp: true, trader: true },
    orderBy: { timestamp: 'asc' }
  });

  const grouped = new Map<string, Set<string>>();
  
  trades.forEach(trade => {
    const key = interval === 'hour' 
      ? trade.timestamp.toISOString().substring(0, 13) + ':00:00.000Z'
      : trade.timestamp.toISOString().substring(0, 10) + 'T00:00:00.000Z';
    
    if (!grouped.has(key)) {
      grouped.set(key, new Set());
    }
    grouped.get(key)!.add(trade.trader);
  });

  return Array.from(grouped.entries()).map(([timestamp, traders]) => ({
    timestamp: new Date(timestamp),
    value: traders.size.toString()
  }));
}

export default router;