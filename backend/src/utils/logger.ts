import pino from 'pino';
import { appConfig, isProduction } from '../config';

// Create structured logger
const logger = pino({
  level: appConfig.LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isProduction ? {
    // Production configuration
    base: {
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown',
      service: 'abstract-pump-api',
      version: process.env.npm_package_version || '1.0.0'
    }
  } : {
    // Development configuration
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  })
});

// Request logger
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  // Log request
  logger.info({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    walletAddress: req.headers['x-wallet-address'],
  }, 'Request started');

  // Log response
  const originalSend = res.send;
  res.send = function(body: any) {
    const duration = Date.now() - start;
    
    logger.info({
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      contentLength: body?.length || 0,
    }, 'Request completed');
    
    return originalSend.call(this, body);
  };

  next();
};

// Error logger
export const errorLogger = (err: any, req: any, res: any, next: any) => {
  logger.error({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode || 500
    },
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    walletAddress: req.headers['x-wallet-address'],
  }, 'Request error');

  next(err);
};

// Blockchain operation logger
export const blockchainLogger = logger.child({ component: 'blockchain' });

// Database operation logger
export const databaseLogger = logger.child({ component: 'database' });

// Performance logger
export const performanceLogger = logger.child({ component: 'performance' });

// Security logger
export const securityLogger = logger.child({ component: 'security' });

// Application logger
export const appLogger = logger.child({ component: 'application' });

export default logger;