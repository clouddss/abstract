import { apiClient } from '../client';
import {
  GetPlatformStatsParams,
  GetPlatformStatsResponse,
  GetLeaderboardsParams,
  GetLeaderboardsResponse,
  GetChartsParams,
  GetChartsResponse,
  ChartMetric,
} from '../types/stats.types';

export class StatsService {
  private static instance: StatsService;
  
  private constructor() {}

  public static getInstance(): StatsService {
    if (!StatsService.instance) {
      StatsService.instance = new StatsService();
    }
    return StatsService.instance;
  }

  /**
   * Get overall platform statistics
   */
  async getPlatformStats(params?: GetPlatformStatsParams): Promise<GetPlatformStatsResponse> {
    return apiClient.get<GetPlatformStatsResponse>('/stats/platform', { params });
  }

  /**
   * Get 24-hour platform stats
   */
  async get24hStats(): Promise<GetPlatformStatsResponse> {
    return this.getPlatformStats({ timeframe: '24h' });
  }

  /**
   * Get 7-day platform stats
   */
  async get7dStats(): Promise<GetPlatformStatsResponse> {
    return this.getPlatformStats({ timeframe: '7d' });
  }

  /**
   * Get 30-day platform stats
   */
  async get30dStats(): Promise<GetPlatformStatsResponse> {
    return this.getPlatformStats({ timeframe: '30d' });
  }

  /**
   * Get various leaderboards
   */
  async getLeaderboards(params?: GetLeaderboardsParams): Promise<GetLeaderboardsResponse> {
    return apiClient.get<GetLeaderboardsResponse>('/stats/leaderboards', { params });
  }

  /**
   * Get top traders leaderboard
   */
  async getTopTraders(timeframe: '24h' | '7d' | '30d' = '24h', limit: number = 10): Promise<GetLeaderboardsResponse['topTraders']> {
    const response = await this.getLeaderboards({ timeframe, limit });
    return response.topTraders;
  }

  /**
   * Get top tokens leaderboard
   */
  async getTopTokens(timeframe: '24h' | '7d' | '30d' = '24h', limit: number = 10): Promise<GetLeaderboardsResponse['topTokens']> {
    const response = await this.getLeaderboards({ timeframe, limit });
    return response.topTokens;
  }

  /**
   * Get top holders leaderboard
   */
  async getTopHolders(limit: number = 10): Promise<GetLeaderboardsResponse['topHolders']> {
    const response = await this.getLeaderboards({ limit });
    return response.topHolders;
  }

  /**
   * Get chart data for various metrics
   */
  async getChartData(params?: GetChartsParams): Promise<GetChartsResponse> {
    return apiClient.get<GetChartsResponse>('/stats/charts', { params });
  }

  /**
   * Get volume chart data
   */
  async getVolumeChart(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<GetChartsResponse> {
    return this.getChartData({ metric: 'volume', timeframe });
  }

  /**
   * Get trades chart data
   */
  async getTradesChart(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<GetChartsResponse> {
    return this.getChartData({ metric: 'trades', timeframe });
  }

  /**
   * Get tokens chart data
   */
  async getTokensChart(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<GetChartsResponse> {
    return this.getChartData({ metric: 'tokens', timeframe });
  }

  /**
   * Get users chart data
   */
  async getUsersChart(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<GetChartsResponse> {
    return this.getChartData({ metric: 'users', timeframe });
  }

  /**
   * Get all charts data at once
   */
  async getAllCharts(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<Record<ChartMetric, GetChartsResponse>> {
    const metrics: ChartMetric[] = ['volume', 'trades', 'tokens', 'users'];
    const promises = metrics.map(metric => this.getChartData({ metric, timeframe }));
    const results = await Promise.all(promises);
    
    return metrics.reduce((acc, metric, index) => {
      acc[metric] = results[index];
      return acc;
    }, {} as Record<ChartMetric, GetChartsResponse>);
  }

  /**
   * Get platform health metrics
   */
  async getPlatformHealth(): Promise<{
    isHealthy: boolean;
    metrics: {
      activeUsers: number;
      migrationRate: number;
      volumeGrowth: number;
      newTokens: number;
    };
  }> {
    const [current, previous] = await Promise.all([
      this.get24hStats(),
      this.getPlatformStats({ timeframe: '7d' })
    ]);

    const volumeGrowth = previous.overview.totalVolume !== '0' 
      ? ((parseFloat(current.overview.totalVolume) - parseFloat(previous.overview.totalVolume)) / parseFloat(previous.overview.totalVolume)) * 100
      : 0;

    const metrics = {
      activeUsers: current.overview.uniqueTraders,
      migrationRate: current.overview.migrationRate,
      volumeGrowth,
      newTokens: current.recentLaunches.length,
    };

    // Platform is considered healthy if:
    // - Has active users
    // - Migration rate is above 10%
    // - Has new token launches
    const isHealthy = metrics.activeUsers > 0 && metrics.migrationRate > 10 && metrics.newTokens > 0;

    return { isHealthy, metrics };
  }
}

// Export singleton instance
export const statsService = StatsService.getInstance();