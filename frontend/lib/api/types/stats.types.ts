import { Address, TimeframeParams, ChartDataPoint } from './common.types';

// Platform stats
export interface PlatformOverview {
  totalTokens: number;
  totalMigrated: number;
  totalTrades: number;
  totalVolume: string;
  totalFees: string;
  uniqueTraders: number;
  migrationRate: number;
}

export interface TrendingToken {
  address: Address;
  name: string;
  symbol: string;
  imageUrl?: string;
  volume: string;
  progress: number;
}

export interface RecentLaunch {
  address: Address;
  name: string;
  symbol: string;
  imageUrl?: string;
  creator: Address;
  createdAt: string;
  soldSupply: string;
  curveSupply: string;
  progress: number;
}

export interface HistoricalStats {
  totalTokensAllTime: number;
  totalVolumeAllTime: string;
  totalFeesAllTime: string;
  totalTradesAllTime: number;
}

export interface GetPlatformStatsParams extends TimeframeParams {}

export interface GetPlatformStatsResponse {
  timeframe: string;
  overview: PlatformOverview;
  trending: TrendingToken[];
  recentLaunches: RecentLaunch[];
  historical?: HistoricalStats;
}

// Leaderboards
export interface TraderLeaderboardEntry {
  rank: number;
  address: Address;
  volume: string;
  fees: string;
  trades: number;
}

export interface TokenLeaderboardEntry {
  rank: number;
  address: Address;
  name: string;
  symbol: string;
  imageUrl?: string;
  volume: string;
  trades: number;
  progress: number;
}

export interface HolderLeaderboardEntry {
  rank: number;
  address: Address;
  totalValue: string;
  tokenCount: number;
}

export interface GetLeaderboardsParams extends TimeframeParams {
  limit?: number;
}

export interface GetLeaderboardsResponse {
  timeframe: string;
  topTraders: TraderLeaderboardEntry[];
  topTokens: TokenLeaderboardEntry[];
  topHolders: HolderLeaderboardEntry[];
}

// Charts
export type ChartMetric = 'volume' | 'trades' | 'tokens' | 'users';

export interface GetChartsParams extends TimeframeParams {
  metric?: ChartMetric;
}

export interface GetChartsResponse {
  metric: string;
  timeframe: string;
  interval: string;
  data: ChartDataPoint[];
}