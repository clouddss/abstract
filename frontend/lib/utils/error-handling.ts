import { toast } from 'react-hot-toast';

// Error types
export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER = 'SERVER',
  CONTRACT = 'CONTRACT',
  WALLET = 'WALLET',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TRANSACTION = 'TRANSACTION',
  UNKNOWN = 'UNKNOWN',
}

// Error messages mapping
const ERROR_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.NETWORK]: 'Network error. Please check your connection and try again.',
  [ErrorType.VALIDATION]: 'Invalid input. Please check your data and try again.',
  [ErrorType.AUTHENTICATION]: 'Authentication required. Please connect your wallet.',
  [ErrorType.AUTHORIZATION]: 'You do not have permission to perform this action.',
  [ErrorType.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorType.RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
  [ErrorType.SERVER]: 'Server error. Please try again later.',
  [ErrorType.CONTRACT]: 'Smart contract error. Please check the transaction details.',
  [ErrorType.WALLET]: 'Wallet error. Please check your wallet connection.',
  [ErrorType.INSUFFICIENT_FUNDS]: 'Insufficient funds. Please add more ETH to your wallet.',
  [ErrorType.TRANSACTION]: 'Transaction failed. Please try again.',
  [ErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again.',
};

// Custom error class
export class AppError extends Error {
  constructor(
    public type: ErrorType,
    public message: string,
    public details?: any,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Error parsing function
export function parseError(error: any): AppError {
  // Handle Ethereum/Web3 errors
  if (error?.code) {
    switch (error.code) {
      case 4001: // User rejected
        return new AppError(
          ErrorType.WALLET,
          'Transaction rejected by user',
          error
        );
      case -32700:
      case -32600:
      case -32601:
      case -32602:
      case -32603:
        return new AppError(
          ErrorType.CONTRACT,
          'Smart contract error',
          error
        );
      case 'INSUFFICIENT_FUNDS':
        return new AppError(
          ErrorType.INSUFFICIENT_FUNDS,
          'Insufficient funds for transaction',
          error
        );
      case 'NETWORK_ERROR':
        return new AppError(
          ErrorType.NETWORK,
          'Network connection error',
          error
        );
    }
  }

  // Handle HTTP errors
  if (error?.response) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        return new AppError(
          ErrorType.VALIDATION,
          data?.message || 'Invalid request',
          data,
          status
        );
      case 401:
        return new AppError(
          ErrorType.AUTHENTICATION,
          data?.message || 'Authentication required',
          data,
          status
        );
      case 403:
        return new AppError(
          ErrorType.AUTHORIZATION,
          data?.message || 'Access denied',
          data,
          status
        );
      case 404:
        return new AppError(
          ErrorType.NOT_FOUND,
          data?.message || 'Resource not found',
          data,
          status
        );
      case 429:
        return new AppError(
          ErrorType.RATE_LIMIT,
          data?.message || 'Rate limit exceeded',
          data,
          status
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return new AppError(
          ErrorType.SERVER,
          data?.message || 'Server error',
          data,
          status
        );
    }
  }

  // Handle network errors
  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return new AppError(
      ErrorType.NETWORK,
      'Network connection error',
      error
    );
  }

  // Default error
  return new AppError(
    ErrorType.UNKNOWN,
    error?.message || 'An unexpected error occurred',
    error
  );
}

// Error handling hook
export function useErrorHandler() {
  const handleError = (error: any, showToast = true) => {
    const appError = parseError(error);
    
    // Log error for debugging
    console.error('[Error]', {
      type: appError.type,
      message: appError.message,
      details: appError.details,
      stack: error?.stack,
    });

    // Show toast notification
    if (showToast) {
      const message = ERROR_MESSAGES[appError.type] || appError.message;
      toast.error(message, {
        duration: 5000,
        position: 'bottom-right',
      });
    }

    return appError;
  };

  return { handleError };
}

// Retry logic for failed requests
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    shouldRetry = (error) => {
      const appError = parseError(error);
      return [ErrorType.NETWORK, ErrorType.RATE_LIMIT, ErrorType.SERVER].includes(
        appError.type
      );
    },
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (i === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff with jitter
      delay = Math.min(delay * 2 + Math.random() * 1000, maxDelay);
    }
  }

  throw lastError;
}

// Error boundary component props
export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Global error handler for unhandled promises
export function setupGlobalErrorHandler() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    const appError = parseError(event.reason);
    toast.error(ERROR_MESSAGES[appError.type] || 'An unexpected error occurred');
    event.preventDefault();
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Only show toast for non-network errors to avoid spam
    if (!event.error?.message?.includes('ChunkLoadError')) {
      toast.error('An unexpected error occurred. Please refresh the page.');
    }
  });
}

// Transaction error helper
export function getTransactionErrorMessage(error: any): string {
  const appError = parseError(error);

  // Specific transaction error messages
  if (error?.reason) {
    switch (error.reason) {
      case 'insufficient funds':
        return 'Insufficient ETH for gas fees';
      case 'user rejected':
        return 'Transaction cancelled';
      case 'gas required exceeds limit':
        return 'Gas limit exceeded. Try a smaller amount';
      default:
        return error.reason;
    }
  }

  // Check for common patterns
  if (error?.message) {
    if (error.message.includes('insufficient')) {
      return 'Insufficient funds for this transaction';
    }
    if (error.message.includes('rejected')) {
      return 'Transaction was rejected';
    }
    if (error.message.includes('gas')) {
      return 'Gas estimation failed. Please try again';
    }
  }

  return ERROR_MESSAGES[appError.type] || 'Transaction failed';
}

// Form validation error helper
export function getFieldError(errors: any, field: string): string | undefined {
  if (!errors || !errors[field]) return undefined;
  
  const error = errors[field];
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.type === 'required') return 'This field is required';
  if (error.type === 'min') return `Minimum value is ${error.min}`;
  if (error.type === 'max') return `Maximum value is ${error.max}`;
  if (error.type === 'pattern') return 'Invalid format';
  
  return 'Invalid value';
}