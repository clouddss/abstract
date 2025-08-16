import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { trackApiCall } from '../utils/performance';

// Types for API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: any;
}

// Custom error class for API errors
export class ApiClientError extends Error {
  public readonly status?: number;
  public readonly data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.data = data;
  }
}

// Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Cache configuration
interface CacheEntry<T> {
  data: T;
  expiry: number;
  etag?: string;
}

interface CacheConfig {
  ttl: number;
  key?: string;
}

interface RequestMetrics {
  startTime: number;
  endTime?: number;
  endpoint: string;
  status?: number;
  error?: string;
}

// Create axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Add auth token if available
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    // Add wallet address if connected
    if (typeof window !== 'undefined' && window.ethereum) {
      const walletAddress = localStorage.getItem('wallet_address');
      if (walletAddress) {
        config.headers['X-Wallet-Address'] = walletAddress;
      }
    }

    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    // Log response in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }

    return response;
  },
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: number };

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[API Error] ${originalRequest.method?.toUpperCase()} ${originalRequest.url}`, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    }

    // Handle network errors
    if (!error.response) {
      throw new ApiClientError('Network error. Please check your connection.', undefined, error);
    }

    // Handle 401 Unauthorized
    if (error.response.status === 401 && originalRequest.url !== '/auth/refresh') {
      // Try to refresh token once
      if (!originalRequest._retry) {
        originalRequest._retry = 1;
        
        try {
          // Import authService dynamically to avoid circular dependency
          const { authService } = await import('./services/auth.service');
          const refreshResponse = await authService.refresh();
          
          // Retry original request with new token
          if (refreshResponse.accessToken) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${refreshResponse.accessToken}`;
            return axiosInstance(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed, clear auth and redirect
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('wallet_address');
            localStorage.removeItem('auth_expires_at');
            window.dispatchEvent(new CustomEvent('auth:logout'));
          }
        }
      }
    }

    // Retry logic for 5xx errors
    if (
      error.response.status >= 500 &&
      originalRequest._retry !== undefined &&
      originalRequest._retry < MAX_RETRIES
    ) {
      originalRequest._retry = (originalRequest._retry || 0) + 1;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * originalRequest._retry!));
      
      return axiosInstance(originalRequest);
    }

    // Extract error message
    const errorMessage = error.response.data?.error || 
                        'An unexpected error occurred';

    throw new ApiClientError(
      errorMessage,
      error.response.status,
      error.response.data
    );
  }
);

// API client class
export class ApiClient {
  private static instance: ApiClient;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private requestQueue: Map<string, Promise<any>> = new Map();
  private circuitBreaker: Map<string, { failures: number; lastFailure: number; isOpen: boolean }> = new Map();
  
  private constructor() {
    this.startCacheCleanup();
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private startCacheCleanup(): void {
    if (typeof window === 'undefined') return;
    
    // Clean expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiry) {
          this.cache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  private getCacheKey(config: AxiosRequestConfig, customKey?: string): string {
    if (customKey) return customKey;
    
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';
    const params = JSON.stringify(config.params || {});
    
    return `${method}:${url}:${params}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number, etag?: string): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
      etag
    });
  }

  private async deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.requestQueue.has(key)) {
      return this.requestQueue.get(key)!;
    }
    
    const promise = requestFn();
    this.requestQueue.set(key, promise);
    
    try {
      const result = await promise;
      this.requestQueue.delete(key);
      return result;
    } catch (error) {
      this.requestQueue.delete(key);
      throw error;
    }
  }

  private isCircuitBreakerOpen(endpoint: string): boolean {
    const breaker = this.circuitBreaker.get(endpoint);
    if (!breaker) return false;

    // Reset circuit breaker after 5 minutes
    if (Date.now() - breaker.lastFailure > 5 * 60 * 1000) {
      this.circuitBreaker.delete(endpoint);
      return false;
    }

    return breaker.isOpen;
  }

  private recordFailure(endpoint: string): void {
    const breaker = this.circuitBreaker.get(endpoint) || { failures: 0, lastFailure: 0, isOpen: false };
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    // Open circuit breaker after 5 failures
    if (breaker.failures >= 5) {
      breaker.isOpen = true;
    }
    
    this.circuitBreaker.set(endpoint, breaker);
  }

  private recordSuccess(endpoint: string): void {
    this.circuitBreaker.delete(endpoint);
  }

  // Generic request method with enhanced features
  private async request<T>(
    config: AxiosRequestConfig & { cache?: CacheConfig },
    customCacheKey?: string
  ): Promise<T> {
    const endpoint = `${config.method?.toUpperCase() || 'GET'} ${config.url}`;
    
    return trackApiCall(endpoint, async () => {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen(endpoint)) {
        throw new ApiClientError('Service temporarily unavailable (circuit breaker open)', 503);
      }

      // Check cache for GET requests
      if (config.method === 'GET' && config.cache) {
        const cacheKey = this.getCacheKey(config, customCacheKey);
        const cached = this.getFromCache<T>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Request deduplication for GET requests
      const dedupeKey = config.method === 'GET' ? this.getCacheKey(config, customCacheKey) : undefined;
      
      const makeRequest = async (): Promise<T> => {
        try {
          const response: AxiosResponse<ApiResponse<T>> = await axiosInstance(config);
          
          if (!response.data.success) {
            throw new ApiClientError(
              response.data.error || 'Request failed',
              response.status,
              response.data
            );
          }

          // Record success for circuit breaker
          this.recordSuccess(endpoint);

          return response.data.data!;
        } catch (error) {
          // Record failure for circuit breaker
          this.recordFailure(endpoint);
          
          if (error instanceof ApiClientError) {
            throw error;
          }
          
          if (axios.isAxiosError(error)) {
            throw new ApiClientError(
              error.response?.data?.error || error.message,
              error.response?.status,
              error.response?.data
            );
          }
          
          throw new ApiClientError('An unexpected error occurred');
        }
      };

      const result = dedupeKey 
        ? await this.deduplicateRequest(dedupeKey, makeRequest)
        : await makeRequest();

      // Cache result for GET requests
      if (config.method === 'GET' && config.cache) {
        const cacheKey = this.getCacheKey(config, customCacheKey);
        this.setCache(cacheKey, result, config.cache.ttl);
      }

      return result;
    });
  }

  // HTTP methods with enhanced features
  public async get<T>(
    url: string, 
    config?: AxiosRequestConfig & { cache?: CacheConfig },
    customCacheKey?: string
  ): Promise<T> {
    const enhancedConfig = {
      ...config,
      method: 'GET' as const,
      url,
      cache: config?.cache || { ttl: 30000 } // Default 30s cache for GET requests
    };
    return this.request<T>(enhancedConfig, customCacheKey);
  }

  public async post<T>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  public async put<T>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  public async patch<T>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  public async delete<T>(
    url: string, 
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  // Utility methods
  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheSize(): number {
    return this.cache.size;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health', { cache: { ttl: 5000 } });
      return true;
    } catch {
      return false;
    }
  }

  public getMetrics() {
    return {
      cacheSize: this.cache.size,
      circuitBreakers: Array.from(this.circuitBreaker.entries()).map(([endpoint, state]) => ({
        endpoint,
        failures: state.failures,
        isOpen: state.isOpen,
        lastFailure: new Date(state.lastFailure).toISOString()
      })),
      activeRequests: this.requestQueue.size
    };
  }

  // Set auth token
  public setAuthToken(token: string | null): void {
    if (token) {
      localStorage.setItem('auth_token', token);
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      localStorage.removeItem('auth_token');
      delete axiosInstance.defaults.headers.common['Authorization'];
    }
  }

  // Set wallet address
  public setWalletAddress(address: string | null): void {
    if (address) {
      localStorage.setItem('wallet_address', address);
      axiosInstance.defaults.headers.common['X-Wallet-Address'] = address;
    } else {
      localStorage.removeItem('wallet_address');
      delete axiosInstance.defaults.headers.common['X-Wallet-Address'];
    }
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();