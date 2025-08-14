import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

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
                        error.response.data?.message || 
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
  
  private constructor() {}

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  // Generic request method
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await axiosInstance(config);
      
      if (!response.data.success) {
        throw new ApiClientError(
          response.data.error || 'Request failed',
          response.status,
          response.data
        );
      }

      return response.data.data!;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      
      if (axios.isAxiosError(error)) {
        throw new ApiClientError(
          error.message,
          error.response?.status,
          error.response?.data
        );
      }
      
      throw new ApiClientError('An unexpected error occurred');
    }
  }

  // HTTP methods
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  public async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url });
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