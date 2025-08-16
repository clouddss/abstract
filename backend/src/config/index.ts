import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

const configSchema = z.object({
  // Server
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database
  DATABASE_URL: z.string(),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Blockchain
  ABSTRACT_RPC_URL: z.string().default('https://api.testnet.abs.xyz'),
  CHAIN_ID: z.number().default(11124),
  
  // Contract Addresses
  LAUNCH_FACTORY_ADDRESS: z.string().optional(),
  PLATFORM_ROUTER_ADDRESS: z.string().optional(),
  REWARDS_VAULT_ADDRESS: z.string().optional(),
  PLATFORM_TREASURY_ADDRESS: z.string().optional(),
  
  // Platform Configuration
  PLATFORM_FEE_PERCENTAGE: z.number().default(250), // 2.5% in basis points
  
  // DEX Routers
  UNISWAP_V2_ROUTER: z.string().optional(),
  UNISWAP_V3_ROUTER: z.string().optional(),
  
  // Indexer
  INDEXER_INTERVAL_MS: z.number().default(5000), // 5 seconds
  INDEXER_BATCH_SIZE: z.number().default(1000),
  START_BLOCK: z.number().default(0),
  CONFIRMATION_BLOCKS: z.number().default(3),
  
  // API
  RATE_LIMIT_WINDOW_MS: z.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX: z.number().default(100),
  MAX_PAGE_SIZE: z.number().default(100),
  DEFAULT_PAGE_SIZE: z.number().default(20),
  
  // IPFS
  IPFS_GATEWAY: z.string().default('https://ipfs.io/ipfs/'),
  PINATA_API_KEY: z.string().optional(),
  PINATA_SECRET_KEY: z.string().optional(),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRATION: z.string().default('7d'),
  ENCRYPTION_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().default('*'),
  ADMIN_API_KEYS: z.string().optional(),
  
  // WebSocket
  WS_PORT: z.number().default(3002),
  WS_HEARTBEAT_INTERVAL: z.number().default(30000),
  WS_MAX_CONNECTIONS: z.number().default(1000),
  
  // Monitoring
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  ENABLE_REQUEST_LOGGING: z.boolean().default(true),
  
  // Health Check
  HEALTH_CHECK_TIMEOUT: z.number().default(5000),
  SHUTDOWN_TIMEOUT: z.number().default(30000),
});

const env = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test',
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  ABSTRACT_RPC_URL: process.env.ABSTRACT_RPC_URL,
  CHAIN_ID: process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : undefined,
  LAUNCH_FACTORY_ADDRESS: process.env.LAUNCH_FACTORY_ADDRESS,
  PLATFORM_ROUTER_ADDRESS: process.env.PLATFORM_ROUTER_ADDRESS,
  REWARDS_VAULT_ADDRESS: process.env.REWARDS_VAULT_ADDRESS,
  PLATFORM_TREASURY_ADDRESS: process.env.PLATFORM_TREASURY_ADDRESS,
  PLATFORM_FEE_PERCENTAGE: process.env.PLATFORM_FEE_PERCENTAGE ? parseInt(process.env.PLATFORM_FEE_PERCENTAGE) : undefined,
  UNISWAP_V2_ROUTER: process.env.UNISWAP_V2_ROUTER,
  UNISWAP_V3_ROUTER: process.env.UNISWAP_V3_ROUTER,
  INDEXER_INTERVAL_MS: process.env.INDEXER_INTERVAL_MS ? parseInt(process.env.INDEXER_INTERVAL_MS) : undefined,
  INDEXER_BATCH_SIZE: process.env.INDEXER_BATCH_SIZE ? parseInt(process.env.INDEXER_BATCH_SIZE) : undefined,
  START_BLOCK: process.env.START_BLOCK ? parseInt(process.env.START_BLOCK) : undefined,
  CONFIRMATION_BLOCKS: process.env.CONFIRMATION_BLOCKS ? parseInt(process.env.CONFIRMATION_BLOCKS) : undefined,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : undefined,
  RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : undefined,
  MAX_PAGE_SIZE: process.env.MAX_PAGE_SIZE ? parseInt(process.env.MAX_PAGE_SIZE) : undefined,
  DEFAULT_PAGE_SIZE: process.env.DEFAULT_PAGE_SIZE ? parseInt(process.env.DEFAULT_PAGE_SIZE) : undefined,
  IPFS_GATEWAY: process.env.IPFS_GATEWAY,
  PINATA_API_KEY: process.env.PINATA_API_KEY,
  PINATA_SECRET_KEY: process.env.PINATA_SECRET_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRATION: process.env.JWT_EXPIRATION,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  ADMIN_API_KEYS: process.env.ADMIN_API_KEYS,
  WS_PORT: process.env.WS_PORT ? parseInt(process.env.WS_PORT) : undefined,
  WS_HEARTBEAT_INTERVAL: process.env.WS_HEARTBEAT_INTERVAL ? parseInt(process.env.WS_HEARTBEAT_INTERVAL) : undefined,
  WS_MAX_CONNECTIONS: process.env.WS_MAX_CONNECTIONS ? parseInt(process.env.WS_MAX_CONNECTIONS) : undefined,
  SENTRY_DSN: process.env.SENTRY_DSN,
  LOG_LEVEL: process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug',
  LOG_FORMAT: process.env.LOG_FORMAT as 'json' | 'pretty',
  ENABLE_REQUEST_LOGGING: process.env.ENABLE_REQUEST_LOGGING === 'true',
  HEALTH_CHECK_TIMEOUT: process.env.HEALTH_CHECK_TIMEOUT ? parseInt(process.env.HEALTH_CHECK_TIMEOUT) : undefined,
  SHUTDOWN_TIMEOUT: process.env.SHUTDOWN_TIMEOUT ? parseInt(process.env.SHUTDOWN_TIMEOUT) : undefined,
};

export const appConfig = configSchema.parse(env);

export const contractAddresses = {
  launchFactory: appConfig.LAUNCH_FACTORY_ADDRESS,
  platformRouter: appConfig.PLATFORM_ROUTER_ADDRESS,
  rewardsVault: appConfig.REWARDS_VAULT_ADDRESS,
} as const;

export const isProduction = appConfig.NODE_ENV === 'production';
export const isDevelopment = appConfig.NODE_ENV === 'development';
export const isTest = appConfig.NODE_ENV === 'test';