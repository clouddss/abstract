import { Response } from 'express';
import { appLogger, securityLogger } from './logger';
import { appConfig } from '../config';

// Custom error classes
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: any
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, true, 'RATE_LIMIT_ERROR');
  }
}

export class BlockchainError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 502, true, 'BLOCKCHAIN_ERROR', details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, true, 'DATABASE_ERROR', details);
  }
}

// Error response formatter
export function formatErrorResponse(error: any, req?: any): any {
  const isProduction = appConfig.NODE_ENV === 'production';
  
  // Base response
  const response: any = {
    success: false,
    error: error.message || 'Internal server error',
    code: error.code,
    timestamp: new Date().toISOString(),
  };

  // Add request ID if available
  if (req?.requestId) {
    response.requestId = req.requestId;
  }

  // Add details for operational errors
  if (error.isOperational && error.details) {
    response.details = error.details;
  }

  // Only add stack trace in development
  if (!isProduction && error.stack) {
    response.stack = error.stack;
  }

  return response;
}

// Centralized error handler
export function handleError(error: any, req?: any, res?: Response): void {
  const isProduction = appConfig.NODE_ENV === 'production';

  // Log the error
  if (error.isOperational) {
    appLogger.warn({
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details
      },
      requestId: req?.requestId,
      url: req?.url,
      method: req?.method,
      ip: req?.ip,
      userAgent: req?.get('User-Agent')
    }, 'Operational error occurred');
  } else {
    appLogger.error({
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      requestId: req?.requestId,
      url: req?.url,
      method: req?.method,
      ip: req?.ip,
      userAgent: req?.get('User-Agent')
    }, 'Unexpected error occurred');
  }

  // Security logging for auth-related errors
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    securityLogger.warn({
      error: error.message,
      ip: req?.ip,
      userAgent: req?.get('User-Agent'),
      url: req?.url,
      headers: req?.headers
    }, 'Security-related error');
  }

  // Send response if res object is provided
  if (res && !res.headersSent) {
    const statusCode = error.statusCode || 500;
    const response = formatErrorResponse(error, req);
    
    res.status(statusCode).json(response);
  }
}

// Async error wrapper
export function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Circuit breaker for external services
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: number = 60000, // 1 minute
    private readonly monitoringPeriod: number = 300000 // 5 minutes
  ) {}

  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.resetTimeout) {
        if (fallback) {
          return fallback();
        }
        throw new AppError('Service temporarily unavailable', 503, true, 'CIRCUIT_BREAKER_OPEN');
      } else {
        this.state = 'HALF_OPEN';
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback && this.state === 'OPEN') {
        return fallback();
      }
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      appLogger.warn({
        failures: this.failures,
        threshold: this.failureThreshold
      }, 'Circuit breaker opened due to repeated failures');
    }
  }

  getState(): string {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}

// Retry mechanism with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryCondition?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    retryCondition = () => true
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's the last attempt or condition is not met
      if (attempt === maxRetries || !retryCondition(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      appLogger.warn({
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: error.message
      }, 'Retrying failed operation');

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Blockchain operation specific retry logic
export function isRetryableBlockchainError(error: any): boolean {
  const retryableErrors = [
    'NETWORK_ERROR',
    'TIMEOUT',
    'REPLACEMENT_UNDERPRICED',
    'NONCE_EXPIRED',
    'SERVER_ERROR',
    'INSUFFICIENT_FUNDS'
  ];

  const errorMessage = error.message?.toLowerCase() || '';
  
  return retryableErrors.some(retryableError => 
    errorMessage.includes(retryableError.toLowerCase())
  ) || error.code === 'NETWORK_ERROR';
}

// Create circuit breakers for different services
export const blockchainCircuitBreaker = new CircuitBreaker(3, 30000); // 3 failures, 30s timeout
export const databaseCircuitBreaker = new CircuitBreaker(5, 60000);   // 5 failures, 60s timeout
export const externalApiCircuitBreaker = new CircuitBreaker(5, 120000); // 5 failures, 2min timeout

// Error monitoring and alerting
export class ErrorMonitor {
  private errorCounts: Map<string, number> = new Map();
  private resetTime: number = Date.now();
  
  constructor(private readonly alertThreshold: number = 10) {}

  recordError(error: AppError): void {
    const key = error.code || 'UNKNOWN_ERROR';
    const count = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, count + 1);

    // Check if we need to alert
    if (count + 1 >= this.alertThreshold) {
      this.sendAlert(key, count + 1);
      this.errorCounts.set(key, 0); // Reset counter after alert
    }

    // Reset counts every hour
    if (Date.now() - this.resetTime > 3600000) {
      this.errorCounts.clear();
      this.resetTime = Date.now();
    }
  }

  private sendAlert(errorCode: string, count: number): void {
    appLogger.error({
      errorCode,
      count,
      threshold: this.alertThreshold
    }, 'Error threshold exceeded - alert triggered');

    // In production, this would integrate with alerting services
    // like PagerDuty, Slack, etc.
  }
}

export const errorMonitor = new ErrorMonitor();