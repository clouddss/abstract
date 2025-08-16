import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { appConfig } from '../../config';

// Validate JWT secret at startup
function validateJWTSecret(secret: string | undefined): string {
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }
  
  // Check for common weak secrets
  const weakSecrets = ['secret', 'password', 'jwt-secret', '123456', 'your-secret-key'];
  if (weakSecrets.includes(secret.toLowerCase())) {
    throw new Error('JWT_SECRET appears to be a weak/default value. Use a strong, unique secret.');
  }
  
  return secret;
}

// Validate secret once at module load
const JWT_SECRET = validateJWTSecret(appConfig.JWT_SECRET);

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        address: string;
      };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Additional token validation
    if (!token || token.trim() === '') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format'
      });
    }
    
    // Verify token with validated secret
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'], // Explicitly specify allowed algorithms
      maxAge: appConfig.JWT_EXPIRATION
    }) as any;
    
    // Validate decoded payload
    if (!decoded.userId || !decoded.address) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token payload'
      });
    }
    
    // Add user info to request
    req.user = {
      userId: decoded.userId,
      address: decoded.address.toLowerCase() // Normalize address
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token expired'
      });
    }
    
    if (error instanceof jwt.NotBeforeError) {
      return res.status(401).json({
        success: false,
        error: 'Token not yet valid'
      });
    }
    
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
}

// Optional auth middleware - doesn't fail if no token
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    if (!token || token.trim() === '') {
      return next();
    }
    
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: appConfig.JWT_EXPIRATION
    }) as any;
    
    // Validate decoded payload
    if (decoded.userId && decoded.address) {
      req.user = {
        userId: decoded.userId,
        address: decoded.address.toLowerCase()
      };
    }
  } catch {
    // Ignore errors, user just won't be authenticated
  }
  
  next();
}