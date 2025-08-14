// Common types used across the API

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface TimeframeParams {
  timeframe?: '24h' | '7d' | '30d' | 'all';
}

export interface ChartDataPoint {
  timestamp: number;
  value: number;
}

export interface ChartData {
  metric: string;
  timeframe: string;
  interval: string;
  data: ChartDataPoint[];
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// Ethereum address type
export type Address = `0x${string}`;

// Sort options
export type SortOrder = 'asc' | 'desc';

// Common enums
export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum ChartInterval {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  ONE_DAY = '1d',
  ONE_WEEK = '1w'
}