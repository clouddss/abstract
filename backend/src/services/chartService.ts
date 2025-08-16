import { PrismaClient, Interval, Trade } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

interface OHLCV {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export class ChartService {
  private static instance: ChartService;

  private constructor() {}

  static getInstance(): ChartService {
    if (!ChartService.instance) {
      ChartService.instance = new ChartService();
    }
    return ChartService.instance;
  }

  /**
   * Generate chart data from trades for a specific token
   */
  async generateChartDataFromTrades(tokenAddress: string, interval: Interval = Interval.HOUR_1) {
    try {
      // Validate input parameters
      if (!tokenAddress || typeof tokenAddress !== 'string') {
        throw new Error('Invalid token address provided');
      }

      if (!interval || !Object.values(Interval).includes(interval)) {
        throw new Error('Invalid interval provided');
      }

      // Get all trades for the token
      const trades = await prisma.trade.findMany({
        where: { tokenAddress: tokenAddress.toLowerCase() },
        orderBy: { timestamp: 'asc' }
      });

      if (!trades || trades.length === 0) {
        console.log(`No trades found for token ${tokenAddress}`);
        return [];
      }

      // Group trades by interval
      const intervals = this.groupTradesByInterval(trades, interval);
      
      if (!intervals || intervals.size === 0) {
        console.log(`No valid intervals found for token ${tokenAddress}`);
        return [];
      }
      
      // Generate OHLCV data for each interval
      const chartData = [];
      for (const [intervalStart, intervalTrades] of intervals) {
        if (!intervalTrades || intervalTrades.length === 0) {
          continue; // Skip empty intervals
        }
        
        const ohlcv = this.calculateOHLCV(intervalTrades);
        
        // Validate OHLCV data before adding
        if (ohlcv && ohlcv.open && ohlcv.high && ohlcv.low && ohlcv.close && ohlcv.volume) {
          chartData.push({
            tokenAddress: tokenAddress.toLowerCase(),
            interval,
            timestamp: new Date(intervalStart),
            open: ohlcv.open,
            high: ohlcv.high,
            low: ohlcv.low,
            close: ohlcv.close,
            volume: ohlcv.volume,
            trades: intervalTrades.length
          });
        }
      }

      // Upsert chart data
      for (const data of chartData) {
        await prisma.priceData.upsert({
          where: {
            tokenAddress_timestamp_interval: {
              tokenAddress: data.tokenAddress,
              timestamp: data.timestamp,
              interval: data.interval
            }
          },
          update: {
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
            volumeUsd: "0" // Would calculate USD value in production
          },
          create: {
            tokenAddress: data.tokenAddress,
            timestamp: data.timestamp,
            interval: data.interval,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
            volumeUsd: "0" // Would calculate USD value in production
          }
        });
      }

      console.log(`Generated ${chartData.length} chart data points for ${tokenAddress}`);
      return chartData;
    } catch (error) {
      console.error('Error generating chart data:', error);
      throw error;
    }
  }

  /**
   * Group trades by time interval
   */
  private groupTradesByInterval(trades: Trade[], interval: Interval): Map<number, Trade[]> {
    if (!trades || trades.length === 0) {
      return new Map();
    }

    const grouped = new Map<number, Trade[]>();
    
    const intervalMs = this.getIntervalMilliseconds(interval);
    if (!intervalMs || intervalMs <= 0) {
      console.error('Invalid interval milliseconds:', intervalMs);
      return new Map();
    }
    
    for (const trade of trades) {
      if (!trade || !trade.timestamp) {
        console.warn('Invalid trade data encountered:', trade);
        continue;
      }

      try {
        const timestamp = trade.timestamp.getTime();
        const intervalStart = Math.floor(timestamp / intervalMs) * intervalMs;
        
        if (!grouped.has(intervalStart)) {
          grouped.set(intervalStart, []);
        }
        const intervalTrades = grouped.get(intervalStart);
        if (intervalTrades) {
          intervalTrades.push(trade);
        }
      } catch (error) {
        console.error('Error processing trade timestamp:', error, trade);
        continue;
      }
    }
    
    return grouped;
  }

  /**
   * Calculate OHLCV from trades in an interval
   */
  private calculateOHLCV(trades: Trade[]): OHLCV {
    if (!trades || trades.length === 0) {
      return { open: '0', high: '0', low: '0', close: '0', volume: '0' };
    }

    // Sort trades by timestamp
    const validTrades = trades.filter(trade => trade && trade.timestamp);
    if (validTrades.length === 0) {
      return { open: '0', high: '0', low: '0', close: '0', volume: '0' };
    }

    validTrades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate prices from trades
    const prices: number[] = [];
    
    for (const trade of validTrades) {
      try {
        if (!trade.amountIn || !trade.amountOut || !trade.type) {
          console.warn('Invalid trade data for price calculation:', trade);
          continue;
        }

        const amountIn = BigInt(trade.amountIn);
        const amountOut = BigInt(trade.amountOut);
        
        if (amountIn <= 0n || amountOut <= 0n) {
          console.warn('Invalid trade amounts:', { amountIn, amountOut });
          continue;
        }
        
        let price: number;
        if (trade.type === 'BUY') {
          // ETH in / tokens out = price per token in ETH
          const ethIn = Number(ethers.formatEther(amountIn));
          const tokensOut = Number(ethers.formatEther(amountOut));
          if (tokensOut > 0) {
            price = ethIn / tokensOut;
          } else {
            continue;
          }
        } else {
          // ETH out / tokens in = price per token in ETH
          const ethOut = Number(ethers.formatEther(amountOut));
          const tokensIn = Number(ethers.formatEther(amountIn));
          if (tokensIn > 0) {
            price = ethOut / tokensIn;
          } else {
            continue;
          }
        }

        if (isFinite(price) && price > 0) {
          prices.push(price);
        }
      } catch (error) {
        console.error('Error calculating price for trade:', error, trade);
        continue;
      }
    }

    if (prices.length === 0) {
      return { open: '0', high: '0', low: '0', close: '0', volume: '0' };
    }

    // Calculate volume (total ETH traded)
    let volume = BigInt(0);
    for (const trade of validTrades) {
      try {
        if (!trade.amountIn || !trade.amountOut || !trade.type) {
          continue;
        }
        
        const ethAmount = trade.type === 'BUY' ? BigInt(trade.amountIn) : BigInt(trade.amountOut);
        if (ethAmount > 0n) {
          volume += ethAmount;
        }
      } catch (error) {
        console.error('Error calculating volume for trade:', error, trade);
        continue;
      }
    }

    return {
      open: prices[0].toString(),
      high: Math.max(...prices).toString(),
      low: Math.min(...prices).toString(),
      close: prices[prices.length - 1].toString(),
      volume: ethers.formatEther(volume)
    };
  }

  /**
   * Get interval duration in milliseconds
   */
  private getIntervalMilliseconds(interval: Interval): number {
    const intervals: Record<Interval, number> = {
      [Interval.MINUTE_1]: 60 * 1000,
      [Interval.MINUTE_5]: 5 * 60 * 1000,
      [Interval.MINUTE_15]: 15 * 60 * 1000,
      [Interval.HOUR_1]: 60 * 60 * 1000,
      [Interval.HOUR_4]: 4 * 60 * 60 * 1000,
      [Interval.DAY_1]: 24 * 60 * 60 * 1000,
      [Interval.WEEK_1]: 7 * 24 * 60 * 60 * 1000
    };
    
    return intervals[interval];
  }

  /**
   * Update chart data when a new trade occurs
   */
  async updateChartDataForTrade(trade: Trade) {
    try {
      if (!trade) {
        console.error('Invalid trade data provided to updateChartDataForTrade');
        return;
      }

      if (!trade.tokenAddress || !trade.timestamp || !trade.type || !trade.amountIn || !trade.amountOut) {
        console.error('Incomplete trade data:', trade);
        return;
      }

      const intervals = [
        Interval.MINUTE_1,
        Interval.MINUTE_5,
        Interval.MINUTE_15,
        Interval.HOUR_1,
        Interval.HOUR_4,
        Interval.DAY_1,
        Interval.WEEK_1
      ];

      for (const interval of intervals) {
        try {
          await this.updateIntervalData(trade, interval);
        } catch (error) {
          console.error(`Error updating interval ${interval} for trade:`, error);
          // Continue with other intervals
        }
      }
    } catch (error) {
      console.error('Error updating chart data for trade:', error);
    }
  }

  /**
   * Update a specific interval with new trade data
   */
  private async updateIntervalData(trade: Trade, interval: Interval) {
    try {
      if (!trade || !interval) {
        throw new Error('Invalid trade or interval provided');
      }

      const intervalMs = this.getIntervalMilliseconds(interval);
      if (!intervalMs || intervalMs <= 0) {
        throw new Error(`Invalid interval milliseconds: ${intervalMs}`);
      }

      const timestamp = trade.timestamp.getTime();
      const intervalStart = new Date(Math.floor(timestamp / intervalMs) * intervalMs);

      // Validate trade data
      if (!trade.amountIn || !trade.amountOut || !trade.type) {
        throw new Error('Invalid trade data for interval update');
      }

      // Calculate trade price
      const amountIn = BigInt(trade.amountIn);
      const amountOut = BigInt(trade.amountOut);
      
      if (amountIn <= 0n || amountOut <= 0n) {
        throw new Error('Invalid trade amounts');
      }

      let price: number;
      if (trade.type === 'BUY') {
        const ethIn = Number(ethers.formatEther(amountIn));
        const tokensOut = Number(ethers.formatEther(amountOut));
        if (tokensOut <= 0) {
          throw new Error('Invalid tokens out amount');
        }
        price = ethIn / tokensOut;
      } else {
        const ethOut = Number(ethers.formatEther(amountOut));
        const tokensIn = Number(ethers.formatEther(amountIn));
        if (tokensIn <= 0) {
          throw new Error('Invalid tokens in amount');
        }
        price = ethOut / tokensIn;
      }

      if (!isFinite(price) || price <= 0) {
        throw new Error(`Invalid calculated price: ${price}`);
      }
      
      const ethVolume = trade.type === 'BUY' ? amountIn : amountOut;

      // Check if interval data exists
      const existing = await prisma.priceData.findUnique({
        where: {
          tokenAddress_timestamp_interval: {
            tokenAddress: trade.tokenAddress,
            timestamp: intervalStart,
            interval
          }
        }
      });

      if (existing) {
        // Update existing interval - validate existing data
        const existingHigh = parseFloat(existing.high);
        const existingLow = parseFloat(existing.low);
        const existingVolume = existing.volume;

        if (!isFinite(existingHigh) || !isFinite(existingLow) || !existingVolume) {
          console.warn('Invalid existing price data, skipping update:', existing);
          return;
        }

        const newHigh = Math.max(existingHigh, price);
        const newLow = Math.min(existingLow, price);
        
        let newVolume: bigint;
        try {
          newVolume = BigInt(ethers.parseEther(existingVolume)) + ethVolume;
        } catch (error) {
          console.error('Error parsing existing volume:', existingVolume, error);
          newVolume = ethVolume; // Fallback to current trade volume
        }

        await prisma.priceData.update({
          where: {
            tokenAddress_timestamp_interval: {
              tokenAddress: trade.tokenAddress,
              timestamp: intervalStart,
              interval
            }
          },
          data: {
            high: newHigh.toString(),
            low: newLow.toString(),
            close: price.toString(),
            volume: ethers.formatEther(newVolume),
            volumeUsd: "0" // Would calculate USD value in production
          }
        });
      } else {
        // Create new interval
        await prisma.priceData.create({
          data: {
            tokenAddress: trade.tokenAddress,
            interval,
            timestamp: intervalStart,
            open: price.toString(),
            high: price.toString(),
            low: price.toString(),
            close: price.toString(),
            volume: ethers.formatEther(ethVolume),
            volumeUsd: "0" // Would calculate USD value in production
          }
        });
      }
    } catch (error) {
      console.error('Error in updateIntervalData:', error);
      throw error;
    }
  }

  /**
   * Generate initial chart data for all tokens
   */
  async generateAllTokenCharts() {
    try {
      const tokens = await prisma.token.findMany({
        select: { address: true }
      });

      console.log(`Generating charts for ${tokens.length} tokens...`);

      for (const token of tokens) {
        await this.generateChartDataFromTrades(token.address);
      }

      console.log('Chart generation complete');
    } catch (error) {
      console.error('Error generating all charts:', error);
    }
  }

  /**
   * Clean up old chart data
   */
  async cleanupOldData(daysToKeep: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deleted = await prisma.priceData.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });

    console.log(`Deleted ${deleted.count} old chart data points`);
    return deleted.count;
  }
}

export const chartService = ChartService.getInstance();