// Export client
export { apiClient, ApiClient, ApiClientError } from './client';
export type { ApiResponse, ApiError } from './client';

// Export services
export { tokensService, TokensService } from './services/tokens.service';
export { rewardsService, RewardsService } from './services/rewards.service';
export { statsService, StatsService } from './services/stats.service';
export { authService, AuthService } from './services/auth.service';
export { tradesService, TradesService } from './services/trades.service';

// Export all types
export * from './types/common.types';
export * from './types/token.types';
export * from './types/reward.types';
export * from './types/stats.types';

// Export specific service types
export type {
  AuthRequest,
  AuthResponse,
  VerifyResponse,
} from './services/auth.service';

export type {
  EstimateTradeRequest,
  EstimateTradeResponse,
  ExecuteTradeRequest,
  ExecuteTradeResponse,
  TradeStatus,
  GetUserTradesParams,
  UserTrade,
  GetUserTradesResponse,
} from './services/trades.service';

// Re-export commonly used types for convenience
export type {
  Address,
  PaginationParams,
  PaginationResponse,
  TimeframeParams,
  ChartDataPoint,
  SortOrder,
} from './types/common.types';

export { TradeType, ChartInterval } from './types/common.types';

// Helper to initialize the API client with auth
export async function initializeApi(): Promise<boolean> {
  try {
    // Initialize auth from stored token
    const authInitialized = await authService.initializeAuth();
    
    if (authInitialized) {
      console.log('API client initialized with authentication');
    } else {
      console.log('API client initialized without authentication');
    }
    
    return authInitialized;
  } catch (error) {
    console.error('Failed to initialize API client:', error);
    return false;
  }
}

// Helper to handle API errors in components
export function handleApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

// Helper to format large numbers
export function formatNumber(value: string | number, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(decimals)}B`;
  } else if (num >= 1e6) {
    return `${(num / 1e6).toFixed(decimals)}M`;
  } else if (num >= 1e3) {
    return `${(num / 1e3).toFixed(decimals)}K`;
  }
  
  return num.toFixed(decimals);
}

// Helper to format percentages
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

// Helper to format addresses
export function formatAddress(address: string, chars: number = 6): string {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// Helper to format timestamps
export function formatTimestamp(timestamp: string | number | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return `${seconds}s ago`;
  }
}

// Export utility functions
export const utils = {
  formatNumber,
  formatPercentage,
  formatAddress,
  formatTimestamp,
  handleApiError,
};