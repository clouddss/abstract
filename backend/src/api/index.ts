import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { appConfig } from '../config';

// Import routes
import tokensRouter from './routes/tokens';
import rewardsRouter from './routes/rewards';
import statsRouter from './routes/stats';

const app = express();

// Security middleware
app.use(helmet());

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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-wallet-signature', 'x-api-key'],
  exposedHeaders: ['x-total-count', 'x-page-count'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: appConfig.RATE_LIMIT_WINDOW_MS,
  max: appConfig.RATE_LIMIT_MAX,
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (appConfig.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: appConfig.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/tokens', tokensRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/stats', statsRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Abstract Pump Platform API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      tokens: '/api/tokens',
      rewards: '/api/rewards',
      stats: '/api/stats',
      health: '/health'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  // Don't leak error details in production
  const message = appConfig.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message || 'Unknown error';

  res.status(err.status || 500).json({
    success: false,
    error: message,
    ...(appConfig.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

export default app;