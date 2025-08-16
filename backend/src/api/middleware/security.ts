import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { appConfig } from '../../config';
import crypto from 'crypto';

// Enhanced rate limiting for different endpoints
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message || 'Too many requests, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use IP + user identifier for more precise rate limiting
      const baseKey = req.ip || 'unknown';
      const userKey = req.headers['x-wallet-address'] || req.user?.address || '';
      return `${baseKey}:${userKey}`;
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    }
  });
};

// Specific rate limits for different endpoint types
export const apiLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window per IP
  'Too many API requests'
);

export const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 login attempts per window
  'Too many authentication attempts'
);

export const createTokenLimiter = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // 10 token creations per hour
  'Too many token creation attempts'
);

export const tradeLimiter = createRateLimit(
  60 * 1000, // 1 minute
  30, // 30 trades per minute
  'Too many trade requests'
);

// Input sanitization middleware
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      if (typeof obj === 'string') {
        // Remove potentially dangerous characters
        return obj
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  };

  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  next();
}

// Request signature validation for critical operations
export function validateSignature(requiredFields: string[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['x-wallet-signature'] as string;
      const address = req.headers['x-wallet-address'] as string;
      const timestamp = req.headers['x-timestamp'] as string;

      if (!signature || !address || !timestamp) {
        return res.status(401).json({
          success: false,
          error: 'Missing signature, address, or timestamp'
        });
      }

      // Check timestamp (5 minutes tolerance)
      const now = Date.now();
      const requestTime = parseInt(timestamp);
      if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
        return res.status(401).json({
          success: false,
          error: 'Request timestamp too old or too far in future'
        });
      }

      // Create message to verify
      const message = createSignatureMessage(req, timestamp, requiredFields);
      
      // Store for later verification in route handlers
      req.signatureData = {
        signature,
        address: address.toLowerCase(),
        message,
        timestamp: requestTime
      };

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature format'
      });
    }
  };
}

function createSignatureMessage(req: Request, timestamp: string, fields: string[]): string {
  const parts = [
    req.method,
    req.path,
    timestamp
  ];

  // Add specific fields from body if required
  for (const field of fields) {
    const value = req.body[field];
    if (value !== undefined) {
      parts.push(`${field}:${value}`);
    }
  }

  return parts.join('\n');
}

// Admin API key validation
export function validateAdminKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required'
    });
  }

  const adminKeys = appConfig.ADMIN_API_KEYS?.split(',').map(k => k.trim()) || [];
  
  if (!adminKeys.includes(apiKey)) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  next();
}

// Request ID for tracing
export function addRequestId(req: Request, res: Response, next: NextFunction) {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

// Security headers
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent content type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy for API responses
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  
  next();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      signatureData?: {
        signature: string;
        address: string;
        message: string;
        timestamp: number;
      };
    }
  }
}