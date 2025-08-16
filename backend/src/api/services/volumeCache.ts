import { prisma } from '../../database/client';
import { TradeType } from '@prisma/client';

interface VolumeCache {
  tokenAddress: string;
  volume24h: string;
  volume7d: string;
  volumeTotal: string;
  holderCount: number;
  lastUpdated: Date;
}

// In-memory cache for volume data
const volumeCache = new Map<string, VolumeCache>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached volume data or calculate if not cached/expired
 */
export async function getCachedVolumeData(tokenAddress: string): Promise<VolumeCache> {
  const cacheKey = tokenAddress.toLowerCase();
  const cached = volumeCache.get(cacheKey);
  
  // Return cached data if valid
  if (cached && (Date.now() - cached.lastUpdated.getTime()) < CACHE_TTL) {
    return cached;
  }

  // Calculate fresh data
  const volumeData = await calculateVolumeData(tokenAddress);
  
  // Cache the result
  volumeCache.set(cacheKey, volumeData);
  
  return volumeData;
}

/**
 * Calculate volume data from database with optimized queries
 */
async function calculateVolumeData(tokenAddress: string): Promise<VolumeCache> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Use Promise.all for parallel execution
  const [volume24hTrades, volume7dTrades, token, holderCount] = await Promise.all([
    // 24h volume with optimized query
    prisma.trade.findMany({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        timestamp: { gte: oneDayAgo }
      },
      select: { type: true, amountIn: true, amountOut: true }
    }),
    
    // 7d volume with optimized query
    prisma.trade.findMany({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        timestamp: { gte: sevenDaysAgo }
      },
      select: { type: true, amountIn: true, amountOut: true }
    }),
    
    // Token total volume
    prisma.token.findUnique({
      where: { address: tokenAddress.toLowerCase() },
      select: { volumeTotal: true }
    }),
    
    // Holder count
    prisma.holder.count({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        balance: { gt: '0' }
      }
    })
  ]);

  // Calculate ETH volume properly
  const volume24h = volume24hTrades.reduce((sum, trade) => {
    const ethAmount = trade.type === TradeType.BUY ? trade.amountIn : trade.amountOut;
    return sum + BigInt(ethAmount);
  }, 0n);

  const volume7d = volume7dTrades.reduce((sum, trade) => {
    const ethAmount = trade.type === TradeType.BUY ? trade.amountIn : trade.amountOut;
    return sum + BigInt(ethAmount);
  }, 0n);

  return {
    tokenAddress: tokenAddress.toLowerCase(),
    volume24h: volume24h.toString(),
    volume7d: volume7d.toString(),
    volumeTotal: token?.volumeTotal || '0',
    holderCount,
    lastUpdated: now
  };
}

/**
 * Invalidate cache for a specific token
 */
export function invalidateVolumeCache(tokenAddress: string): void {
  volumeCache.delete(tokenAddress.toLowerCase());
}

/**
 * Clear all cache (useful for testing or memory management)
 */
export function clearVolumeCache(): void {
  volumeCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  return {
    size: volumeCache.size,
    entries: Array.from(volumeCache.keys()),
    memoryUsage: JSON.stringify(Array.from(volumeCache.values())).length
  };
}

/**
 * Background job to clean expired cache entries
 */
export function cleanExpiredCache(): void {
  const now = Date.now();
  
  for (const [key, value] of volumeCache.entries()) {
    if (now - value.lastUpdated.getTime() > CACHE_TTL) {
      volumeCache.delete(key);
    }
  }
}

// Start cache cleanup interval
setInterval(cleanExpiredCache, CACHE_TTL);

/**
 * Batch update volume cache for multiple tokens
 */
export async function batchUpdateVolumeCache(tokenAddresses: string[]): Promise<Map<string, VolumeCache>> {
  const results = new Map<string, VolumeCache>();
  
  // Process in batches to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < tokenAddresses.length; i += batchSize) {
    const batch = tokenAddresses.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (tokenAddress) => {
      const data = await calculateVolumeData(tokenAddress);
      volumeCache.set(tokenAddress.toLowerCase(), data);
      results.set(tokenAddress.toLowerCase(), data);
      return data;
    });
    
    await Promise.all(batchPromises);
  }
  
  return results;
}