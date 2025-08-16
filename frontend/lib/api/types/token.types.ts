import { Address, PaginationParams, PaginationResponse, TradeType, ChartInterval } from './common.types';

// Token creation
export interface CreateTokenRequest {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}

export interface CreateTokenResponse {
  estimatedGas: string;
  launchFee: string;
}

// Launch token transaction data
export interface LaunchTokenResponse {
  to: string;
  data: string;
  value: string;
  launchFee: string;
  message: string;
}

// Token listing
export type TokenSortField = 'created' | 'volume' | 'marketCap' | 'holders';

export interface GetTokensParams extends PaginationParams {
  sort?: TokenSortField;
  order?: 'asc' | 'desc';
  creator?: Address;
  migrated?: boolean;
  search?: string;
}

export interface TokenListItem {
  address: Address;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  creator: Address;
  bondingCurve: Address;
  migrated: boolean;
  migratedAt?: string;
  dexPair?: Address;
  totalSupply: string;
  soldSupply: string;
  marketCap: string;
  volume24h: string;
  volume7d: string;
  volumeTotal: string;
  holders: number;
  trades: number;
  createdAt: string;
  progress: number; // Percentage 0-100
}

export interface GetTokensResponse {
  tokens: TokenListItem[];
  pagination: PaginationResponse;
}

// Token details
export interface TokenHolder {
  address: Address;
  balance: string;
  percentage: number;
  firstBought: string;
  lastActivity: string;
  isBondingCurve?: boolean;
  isLiquidity?: boolean;
}

export interface TokenTrade {
  id: string;
  type: TradeType;
  trader: Address;
  amountIn: string;
  amountOut: string;
  price: string;
  timestamp: string;
  txHash: string;
}

export interface TokenDetails extends TokenListItem {
  curveSupply: string;
  currentPrice: string;
  priceChange24h: number;
  bondingCurveProgress: number; // Percentage 0-100
  migrationProgress: number; // Percentage 0-100
  topHolders: TokenHolder[];
  recentTrades: TokenTrade[];
  stats: {
    totalTrades: number;
    totalHolders: number;
    actualHolders?: number;
  };
}

// Token chart
export interface GetTokenChartParams {
  interval?: ChartInterval;
  from?: Date | string;
  to?: Date | string;
}

export interface ChartDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
}

export interface TokenChartResponse {
  interval: string;
  data: ChartDataPoint[];
}

// Token trades
export interface GetTokenTradesParams extends PaginationParams {}

export interface TokenTradesResponse {
  trades: TokenTrade[];
  pagination: PaginationResponse;
}