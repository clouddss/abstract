import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { appConfig, isProduction } from '../config';

// Import middleware
import { requestLogger, errorLogger } from '../utils/logger';
import { handleError } from '../utils/errors';
import { 
  addRequestId, 
  securityHeaders, 
  sanitizeInput,
  apiLimiter 
} from './middleware/security';

// Import routes
import authRouter from './routes/auth';
import tokensRouter from './routes/tokens';
import tradesRouter from './routes/trades';
import rewardsRouter from './routes/rewards';
import statsRouter from './routes/stats';
import healthRouter from './routes/health';

const app = express();

// Trust proxy for rate limiting behind NGINX/load balancer
app.set('trust proxy', true);

// Disable x-powered-by header
app.disable('x-powered-by');

// Compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // Only compress responses larger than 1KB
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Custom security headers
app.use(securityHeaders);

// Add request ID for tracing
app.use(addRequestId);

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc) in development
    if (!origin && appConfig.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Handle wildcard
    if (appConfig.CORS_ORIGIN === '*') {
      return callback(null, true);
    }
    
    // Check against allowed origins
    const allowedOrigins = appConfig.CORS_ORIGIN.split(',').map(o => o.trim());
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'x-wallet-address', 
    'x-wallet-signature', 
    'x-api-key',
    'x-timestamp'
  ],
  exposedHeaders: ['x-total-count', 'x-page-count', 'x-request-id'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf, encoding) => {
    // Store raw body for signature verification if needed
    if (buf && buf.length) {
      (req as any).rawBody = buf.toString(encoding || 'utf8');
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '1mb',
  parameterLimit: 100 // Limit URL parameters
}));

// Input sanitization
app.use(sanitizeInput);

// Request logging
if (appConfig.NODE_ENV !== 'test') {
  app.use(requestLogger);
}

// Rate limiting for API routes
app.use('/api/', apiLimiter);

// Health checks (no auth required)
app.use('/health', healthRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Abstract Pump Platform API',
    version: process.env.npm_package_version || '1.0.0',
    environment: appConfig.NODE_ENV,
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      tokens: '/api/tokens',
      trades: '/api/trades',
      rewards: '/api/rewards',
      stats: '/api/stats',
      health: '/health'
    },
    features: {
      rateLimit: true,
      caching: true,
      monitoring: true,
      security: true
    }
  });
});

// API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/tokens', tokensRouter);
app.use('/api/v1/trades', tradesRouter);
app.use('/api/v1/rewards', rewardsRouter);
app.use('/api/v1/stats', statsRouter);

// Legacy routes (without version) - redirect to v1
app.use('/api/auth', (req, res) => res.redirect(301, `/api/v1/auth${req.url}`));
app.use('/api/tokens', (req, res) => res.redirect(301, `/api/v1/tokens${req.url}`));
app.use('/api/trades', (req, res) => res.redirect(301, `/api/v1/trades${req.url}`));
app.use('/api/rewards', (req, res) => res.redirect(301, `/api/v1/rewards${req.url}`));
app.use('/api/stats', (req, res) => res.redirect(301, `/api/v1/stats${req.url}`));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    suggestion: 'Check the API documentation for available endpoints'
  });
});

// Error logging middleware
app.use(errorLogger);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  handleError(err, req, res);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;