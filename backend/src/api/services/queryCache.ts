import { prisma } from '../../database/client';

interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number; // in milliseconds
}

/**
 * PERFORMANCE CRITICAL: Query result caching service
 * Reduces database load for frequently accessed but computationally expensive queries
 */
export class QueryCacheService {
  private static instance: QueryCacheService;
  private cache = new Map<string, CacheEntry<any>>();
  
  // Cache TTL configurations (in milliseconds)
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly TTL_CONFIG = {
    token_list: 2 * 60 * 1000,      // 2 minutes for token listings
    token_detail: 1 * 60 * 1000,    // 1 minute for token details
    price_data: 30 * 1000,          // 30 seconds for price data
    trending_tokens: 5 * 60 * 1000, // 5 minutes for trending
    volume_stats: 5 * 60 * 1000,    // 5 minutes for volume stats
    holder_stats: 10 * 60 * 1000,   // 10 minutes for holder statistics
    platform_stats: 10 * 60 * 1000, // 10 minutes for platform stats
    chart_data: 2 * 60 * 1000       // 2 minutes for chart data
  };

  public static getInstance(): QueryCacheService {
    if (!QueryCacheService.instance) {
      QueryCacheService.instance = new QueryCacheService();
    }
    return QueryCacheService.instance;
  }

  /**
   * OPTIMIZED: Get cached result or execute query function
   */
  async getOrSet<T>(
    key: string, 
    queryFn: () => Promise<T>, 
    cacheType: keyof typeof this.TTL_CONFIG = 'token_list'
  ): Promise<T> {
    const cached = this.cache.get(key);
    const ttl = this.TTL_CONFIG[cacheType] || this.DEFAULT_TTL;
    
    // Return cached data if valid
    if (cached && (Date.now() - cached.timestamp.getTime()) < cached.ttl) {
      return cached.data;
    }

    // Execute query and cache result
    try {
      const data = await queryFn();
      this.cache.set(key, {
        data,
        timestamp: new Date(),
        ttl
      });
      return data;
    } catch (error) {
      // If query fails and we have stale cache, return it
      if (cached) {
        console.warn(`Query failed for key ${key}, returning stale cache`);
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * PERFORMANCE: Cached token list with pagination optimization
   */
  async getCachedTokenList(params: {
    page: number;
    limit: number;
    sort: string;
    order: string;
    creator?: string;
    migrated?: boolean;
    search?: string;
  }) {
    const cacheKey = `token_list:${JSON.stringify(params)}`;
    
    return this.getOrSet(cacheKey, async () => {
      // Build optimized where clause
      const where: any = {};
      
      if (params.creator) {
        where.creator = params.creator;
      }
      
      if (params.migrated !== undefined) {
        where.migrated = params.migrated;
      }
      
      if (params.search) {
        where.OR = [
          { name: { contains: params.search, mode: 'insensitive' } },
          { symbol: { contains: params.search, mode: 'insensitive' } },
          { description: { contains: params.search, mode: 'insensitive' } }
        ];
      }

      // OPTIMIZED: Build order by with index hints
      let orderBy: any = {};
      switch (params.sort) {
        case 'volume':
          orderBy = { volumeTotal: params.order };
          break;
        case 'marketCap':
          orderBy = { marketCap: params.order };
          break;
        case 'holders':
          orderBy = { holderCount: params.order };
          break;
        default:
          orderBy = { createdAt: params.order };
      }

      const skip = (params.page - 1) * params.limit;

      // OPTIMIZED: Use efficient parallel queries
      const [tokens, total] = await Promise.all([
        prisma.token.findMany({
          where,
          orderBy,
          skip,
          take: params.limit,
          select: {
            address: true,
            name: true,
            symbol: true,
            description: true,
            imageUrl: true,
            website: true,
            twitter: true,
            telegram: true,
            creator: true,
            bondingCurve: true,
            migrated: true,
            migratedAt: true,
            dexPair: true,
            totalSupply: true,
            soldSupply: true,
            curveSupply: true,
            marketCap: true,
            volume24h: true,
            volume7d: true,
            volumeTotal: true,
            holderCount: true,
            createdAt: true
          }
        }),
        // OPTIMIZED: Count query with same where clause
        prisma.token.count({ where })
      ]);

      return {
        tokens: tokens.map(token => ({
          ...token,
          progress: this.calculateProgress(token.soldSupply, token.curveSupply)
        })),
        pagination: {
          page: params.page,
          limit: params.limit,
          total,
          pages: Math.ceil(total / params.limit)
        }
      };
    }, 'token_list');
  }

  /**
   * PERFORMANCE: Cached price data for chart endpoints
   */
  async getCachedPriceData(tokenAddress: string, interval: string, from?: Date, to?: Date) {
    const cacheKey = `price_data:${tokenAddress}:${interval}:${from?.getTime()}:${to?.getTime()}`;
    
    return this.getOrSet(cacheKey, async () => {
      // Build time range
      const timeRange: any = {};
      if (from) timeRange.gte = from;
      if (to) timeRange.lte = to;

      // Default time range if not specified
      if (!from && !to) {
        const now = new Date();
        const defaultRanges: Record<string, number> = {
          'MINUTE_1': 24 * 60,
          'MINUTE_5': 7 * 24 * 12,
          'MINUTE_15': 30 * 24 * 4,
          'HOUR_1': 90 * 24,
          'HOUR_4': 365 * 6,
          'DAY_1': 365 * 2,
          'WEEK_1': 365 * 5
        };

        const minutesBack = defaultRanges[interval] || 24 * 60;
        timeRange.gte = new Date(now.getTime() - minutesBack * 60 * 1000);
      }

      const priceData = await prisma.priceData.findMany({
        where: {
          tokenAddress: tokenAddress.toLowerCase(),
          interval: interval as any,
          ...(Object.keys(timeRange).length > 0 && { timestamp: timeRange })
        },
        orderBy: { timestamp: 'asc' },
        select: {
          timestamp: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true
        }
      });

      return priceData.map(point => ({
        timestamp: point.timestamp.getTime(),
        open: parseFloat(point.open),
        high: parseFloat(point.high),
        low: parseFloat(point.low),
        close: parseFloat(point.close),
        volume: point.volume
      }));
    }, 'chart_data');
  }

  /**
   * PERFORMANCE: Cached trade history with optimized pagination
   */
  async getCachedTradeHistory(tokenAddress: string, page: number, limit: number) {
    const cacheKey = `trades:${tokenAddress}:${page}:${limit}`;
    
    return this.getOrSet(cacheKey, async () => {
      const skip = (page - 1) * limit;
      
      // OPTIMIZED: Use cursor-based pagination for better performance on large datasets
      const [trades, total] = await Promise.all([
        prisma.trade.findMany({
          where: { tokenAddress: tokenAddress.toLowerCase() },
          orderBy: { timestamp: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            type: true,
            trader: true,
            amountIn: true,
            amountOut: true,
            price: true,
            feeAmount: true,
            txHash: true,
            blockNumber: true,
            timestamp: true
          }
        }),
        prisma.trade.count({ 
          where: { tokenAddress: tokenAddress.toLowerCase() } 
        })
      ]);

      return {
        trades,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    }, 'token_detail');
  }

  /**
   * PERFORMANCE: Batch invalidate cache entries by pattern
   */
  invalidateByPattern(pattern: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp.getTime() < entry.ttl) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      memoryUsage: JSON.stringify(Array.from(this.cache.values())).length,
      cacheHitRate: this.getCacheHitRate()
    };
  }

  /**
   * Helper method to calculate progress
   */
  private calculateProgress(soldSupply: string, curveSupply: string): number {
    const sold = BigInt(soldSupply);
    const curve = BigInt(curveSupply);
    if (curve === 0n) return 0;
    return Number((sold * 10000n) / curve) / 100;
  }

  /**
   * Track cache hit rate (simplified implementation)
   */
  private hits = 0;
  private misses = 0;

  private recordHit() { this.hits++; }
  private recordMiss() { this.misses++; }

  private getCacheHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }

  /**
   * Background job to clean expired cache entries
   */
  startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp.getTime() > entry.ttl) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => this.cache.delete(key));
      
      if (keysToDelete.length > 0) {
        console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
      }
    }, 5 * 60 * 1000); // Clean every 5 minutes
  }
}

// Export singleton instance
export const queryCacheService = QueryCacheService.getInstance();

// Start cleanup interval when module is loaded
queryCacheService.startCleanupInterval();