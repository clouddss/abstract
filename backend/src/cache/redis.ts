import Redis from 'ioredis';
import { appConfig, isProduction } from '../config';
import { appLogger } from '../utils/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean;
}

class CacheManager {
  private redis: Redis;
  private connected: boolean = false;

  constructor() {
    this.redis = new Redis(appConfig.REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      ...(isProduction && {
        // Production optimizations
        connectTimeout: 10000,
        commandTimeout: 5000,
        family: 4, // Use IPv4
        keepAlive: 30000,
      })
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.redis.on('connect', () => {
      appLogger.info('Connected to Redis');
      this.connected = true;
    });

    this.redis.on('ready', () => {
      appLogger.info('Redis is ready');
    });

    this.redis.on('error', (error) => {
      appLogger.error({ error }, 'Redis connection error');
      this.connected = false;
    });

    this.redis.on('close', () => {
      appLogger.warn('Redis connection closed');
      this.connected = false;
    });

    this.redis.on('reconnecting', () => {
      appLogger.info('Reconnecting to Redis');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.redis.connect();
    } catch (error) {
      appLogger.error({ error }, 'Failed to connect to Redis');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      appLogger.info('Disconnected from Redis');
    } catch (error) {
      appLogger.error({ error }, 'Error disconnecting from Redis');
    }
  }

  isConnected(): boolean {
    return this.connected && this.redis.status === 'ready';
  }

  // Generic cache operations
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected()) {
      appLogger.warn({ key }, 'Redis not connected, cache miss');
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error) {
      appLogger.error({ error, key }, 'Error getting cache value');
      return null;
    }
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected()) {
      appLogger.warn({ key }, 'Redis not connected, cannot cache');
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      
      if (options.ttl) {
        await this.redis.setex(key, options.ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      appLogger.error({ error, key }, 'Error setting cache value');
      return false;
    }
  }

  async del(key: string | string[]): Promise<number> {
    if (!this.isConnected()) {
      appLogger.warn({ key }, 'Redis not connected, cannot delete');
      return 0;
    }

    try {
      return await this.redis.del(key);
    } catch (error) {
      appLogger.error({ error, key }, 'Error deleting cache value');
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected()) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      appLogger.error({ error, key }, 'Error checking cache existence');
      return false;
    }
  }

  async increment(key: string, value: number = 1): Promise<number | null> {
    if (!this.isConnected()) return null;

    try {
      return await this.redis.incrby(key, value);
    } catch (error) {
      appLogger.error({ error, key }, 'Error incrementing cache value');
      return null;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected()) return false;

    try {
      const result = await this.redis.expire(key, seconds);
      return result === 1;
    } catch (error) {
      appLogger.error({ error, key }, 'Error setting cache expiration');
      return false;
    }
  }

  // Pattern-based operations
  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected()) return [];

    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      appLogger.error({ error, pattern }, 'Error getting cache keys');
      return [];
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    if (!this.isConnected()) return 0;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      
      return await this.redis.del(...keys);
    } catch (error) {
      appLogger.error({ error, pattern }, 'Error deleting cache pattern');
      return 0;
    }
  }

  // Specialized cache methods for the application
  async cacheTokenData(tokenAddress: string, data: any, ttl: number = 300): Promise<boolean> {
    const key = `token:${tokenAddress.toLowerCase()}`;
    return this.set(key, data, { ttl });
  }

  async getTokenData(tokenAddress: string): Promise<any | null> {
    const key = `token:${tokenAddress.toLowerCase()}`;
    return this.get(key);
  }

  async cacheTokenPrice(tokenAddress: string, price: string, ttl: number = 60): Promise<boolean> {
    const key = `price:${tokenAddress.toLowerCase()}`;
    return this.set(key, { price, timestamp: Date.now() }, { ttl });
  }

  async getTokenPrice(tokenAddress: string): Promise<{ price: string; timestamp: number } | null> {
    const key = `price:${tokenAddress.toLowerCase()}`;
    return this.get(key);
  }

  async cacheLeaderboard(data: any, ttl: number = 600): Promise<boolean> {
    return this.set('leaderboard', data, { ttl });
  }

  async getLeaderboard(): Promise<any | null> {
    return this.get('leaderboard');
  }

  async cacheStats(data: any, ttl: number = 300): Promise<boolean> {
    return this.set('platform:stats', data, { ttl });
  }

  async getStats(): Promise<any | null> {
    return this.get('platform:stats');
  }

  // Rate limiting helpers
  async incrementRateLimit(key: string, windowSeconds: number): Promise<number> {
    const result = await this.increment(key);
    if (result === 1) {
      await this.expire(key, windowSeconds);
    }
    return result || 0;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected()) return false;

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      appLogger.error({ error }, 'Redis health check failed');
      return false;
    }
  }

  // Get cache statistics
  async getStats(): Promise<any> {
    if (!this.isConnected()) return null;

    try {
      const info = await this.redis.info('memory');
      const dbSize = await this.redis.dbsize();
      
      return {
        connected: this.connected,
        dbSize,
        memory: this.parseRedisInfo(info)
      };
    } catch (error) {
      appLogger.error({ error }, 'Error getting Redis stats');
      return null;
    }
  }

  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const stats: any = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        stats[key] = value;
      }
    }
    
    return stats;
  }
}

// Export singleton instance
export const cache = new CacheManager();

// Cache decorator for automatic caching
export function cached(ttl: number = 300, keyPrefix: string = '') {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${keyPrefix}:${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache first
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Execute original method
      const result = await method.apply(this, args);
      
      // Cache the result
      await cache.set(cacheKey, result, { ttl });
      
      return result;
    };
  };
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await cache.disconnect();
});

process.on('SIGTERM', async () => {
  await cache.disconnect();
});