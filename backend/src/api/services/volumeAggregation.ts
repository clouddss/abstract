import { prisma } from '../../database/client';
import { Prisma } from '@prisma/client';

/**
 * Efficient volume aggregation service using raw SQL for better performance
 */
export class VolumeAggregationService {
  
  /**
   * Calculate volume metrics for a specific token using optimized SQL
   */
  static async calculateTokenVolume(tokenAddress: string) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Use raw SQL for maximum performance
    const volumeQuery = Prisma.sql`
      SELECT 
        -- 24h volume (ETH amount)
        COALESCE(SUM(
          CASE 
            WHEN timestamp >= ${oneDayAgo} THEN 
              CASE 
                WHEN type = 'buy' THEN amount_in::numeric 
                ELSE amount_out::numeric 
              END
            ELSE 0
          END
        ), 0) as volume_24h,
        
        -- 7d volume (ETH amount)
        COALESCE(SUM(
          CASE 
            WHEN timestamp >= ${sevenDaysAgo} THEN 
              CASE 
                WHEN type = 'buy' THEN amount_in::numeric 
                ELSE amount_out::numeric 
              END
            ELSE 0
          END
        ), 0) as volume_7d,
        
        -- Total volume (ETH amount)
        COALESCE(SUM(
          CASE 
            WHEN type = 'buy' THEN amount_in::numeric 
            ELSE amount_out::numeric 
          END
        ), 0) as volume_total,
        
        -- Transaction count in 24h
        COUNT(
          CASE 
            WHEN timestamp >= ${oneDayAgo} THEN 1 
            ELSE NULL 
          END
        ) as tx_count_24h,
        
        -- Total transaction count
        COUNT(*) as tx_count_total
        
      FROM trades 
      WHERE token_address = ${tokenAddress.toLowerCase()}
    `;

    const result = await prisma.$queryRaw<Array<{
      volume_24h: string;
      volume_7d: string;
      volume_total: string;
      tx_count_24h: bigint;
      tx_count_total: bigint;
    }>>(volumeQuery);

    return result[0] || {
      volume_24h: '0',
      volume_7d: '0',
      volume_total: '0',
      tx_count_24h: 0n,
      tx_count_total: 0n
    };
  }

  /**
   * Get top tokens by volume with efficient aggregation
   */
  static async getTopTokensByVolume(timeframe: '24h' | '7d' | 'total' = '24h', limit: number = 50) {
    const timeCondition = timeframe === '24h' 
      ? Prisma.sql`timestamp >= NOW() - INTERVAL '24 hours'`
      : timeframe === '7d'
      ? Prisma.sql`timestamp >= NOW() - INTERVAL '7 days'`
      : Prisma.sql`TRUE`;

    const query = Prisma.sql`
      SELECT 
        t.address,
        t.name,
        t.symbol,
        t.market_cap,
        t.holder_count,
        COALESCE(v.volume, '0') as volume,
        COALESCE(v.tx_count, 0) as tx_count,
        t.created_at
      FROM tokens t
      LEFT JOIN (
        SELECT 
          token_address,
          SUM(
            CASE 
              WHEN type = 'buy' THEN amount_in::numeric 
              ELSE amount_out::numeric 
            END
          ) as volume,
          COUNT(*) as tx_count
        FROM trades 
        WHERE ${timeCondition}
        GROUP BY token_address
      ) v ON t.address = v.token_address
      WHERE t.migrated = false
      ORDER BY COALESCE(v.volume, 0) DESC
      LIMIT ${limit}
    `;

    return await prisma.$queryRaw<Array<{
      address: string;
      name: string;
      symbol: string;
      market_cap: string;
      holder_count: number;
      volume: string;
      tx_count: bigint;
      created_at: Date;
    }>>(query);
  }

  /**
   * Get platform-wide volume statistics
   */
  static async getPlatformVolumeStats() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const query = Prisma.sql`
      SELECT 
        -- 24h stats
        COALESCE(SUM(
          CASE 
            WHEN timestamp >= ${oneDayAgo} THEN 
              CASE 
                WHEN type = 'buy' THEN amount_in::numeric 
                ELSE amount_out::numeric 
              END
            ELSE 0
          END
        ), 0) as volume_24h,
        
        COUNT(
          CASE 
            WHEN timestamp >= ${oneDayAgo} THEN 1 
            ELSE NULL 
          END
        ) as trades_24h,
        
        COUNT(DISTINCT 
          CASE 
            WHEN timestamp >= ${oneDayAgo} THEN trader 
            ELSE NULL 
          END
        ) as unique_traders_24h,
        
        -- 7d stats
        COALESCE(SUM(
          CASE 
            WHEN timestamp >= ${sevenDaysAgo} THEN 
              CASE 
                WHEN type = 'buy' THEN amount_in::numeric 
                ELSE amount_out::numeric 
              END
            ELSE 0
          END
        ), 0) as volume_7d,
        
        COUNT(
          CASE 
            WHEN timestamp >= ${sevenDaysAgo} THEN 1 
            ELSE NULL 
          END
        ) as trades_7d,
        
        -- All time stats
        COALESCE(SUM(
          CASE 
            WHEN type = 'buy' THEN amount_in::numeric 
            ELSE amount_out::numeric 
          END
        ), 0) as volume_total,
        
        COUNT(*) as trades_total,
        COUNT(DISTINCT trader) as unique_traders_total
        
      FROM trades
    `;

    const result = await prisma.$queryRaw<Array<{
      volume_24h: string;
      trades_24h: bigint;
      unique_traders_24h: bigint;
      volume_7d: string;
      trades_7d: bigint;
      volume_total: string;
      trades_total: bigint;
      unique_traders_total: bigint;
    }>>(query);

    return result[0];
  }

  /**
   * Get volume distribution by time (hourly breakdown for last 24h)
   */
  static async getVolumeDistribution(tokenAddress?: string) {
    const tokenCondition = tokenAddress 
      ? Prisma.sql`AND token_address = ${tokenAddress.toLowerCase()}`
      : Prisma.sql``;

    const query = Prisma.sql`
      SELECT 
        DATE_TRUNC('hour', timestamp) as hour,
        SUM(
          CASE 
            WHEN type = 'buy' THEN amount_in::numeric 
            ELSE amount_out::numeric 
          END
        ) as volume,
        COUNT(*) as trade_count
      FROM trades 
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
        ${tokenCondition}
      GROUP BY DATE_TRUNC('hour', timestamp)
      ORDER BY hour ASC
    `;

    return await prisma.$queryRaw<Array<{
      hour: Date;
      volume: string;
      trade_count: bigint;
    }>>(query);
  }

  /**
   * Get trader activity statistics
   */
  static async getTraderActivity(timeframe: '24h' | '7d' | '30d' = '24h') {
    const timeCondition = timeframe === '24h' 
      ? Prisma.sql`timestamp >= NOW() - INTERVAL '24 hours'`
      : timeframe === '7d'
      ? Prisma.sql`timestamp >= NOW() - INTERVAL '7 days'`
      : Prisma.sql`timestamp >= NOW() - INTERVAL '30 days'`;

    const query = Prisma.sql`
      SELECT 
        trader,
        COUNT(*) as trade_count,
        SUM(
          CASE 
            WHEN type = 'buy' THEN amount_in::numeric 
            ELSE amount_out::numeric 
          END
        ) as total_volume,
        COUNT(DISTINCT token_address) as unique_tokens_traded,
        MIN(timestamp) as first_trade,
        MAX(timestamp) as last_trade
      FROM trades 
      WHERE ${timeCondition}
      GROUP BY trader
      ORDER BY total_volume DESC
      LIMIT 100
    `;

    return await prisma.$queryRaw<Array<{
      trader: string;
      trade_count: bigint;
      total_volume: string;
      unique_tokens_traded: bigint;
      first_trade: Date;
      last_trade: Date;
    }>>(query);
  }

  /**
   * Batch update token volume metrics efficiently
   */
  static async batchUpdateTokenVolumes(tokenAddresses: string[]) {
    const updates = await Promise.all(
      tokenAddresses.map(async (address) => {
        const volume = await this.calculateTokenVolume(address);
        return {
          address: address.toLowerCase(),
          ...volume
        };
      })
    );

    // Use a transaction for atomic updates
    await prisma.$transaction(
      updates.map(update => 
        prisma.token.update({
          where: { address: update.address },
          data: {
            volume24h: update.volume_24h,
            volume7d: update.volume_7d,
            volumeTotal: update.volume_total,
            txCount: Number(update.tx_count_total),
            updatedAt: new Date()
          }
        })
      )
    );

    return updates;
  }

  /**
   * Refresh materialized view for token statistics
   */
  static async refreshTokenStatsView() {
    try {
      await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY token_stats_mv`;
      return { success: true, refreshedAt: new Date() };
    } catch (error) {
      console.error('Error refreshing materialized view:', error);
      return { success: false, error: error.message };
    }
  }
}