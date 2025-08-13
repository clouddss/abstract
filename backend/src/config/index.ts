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
  
  // Indexer
  INDEXER_INTERVAL_MS: z.number().default(5000), // 5 seconds
  INDEXER_BATCH_SIZE: z.number().default(1000),
  START_BLOCK: z.number().default(0),
  
  // API
  RATE_LIMIT_WINDOW_MS: z.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX: z.number().default(100),
  
  // IPFS
  IPFS_GATEWAY: z.string().default('https://ipfs.io/ipfs/'),
  PINATA_API_KEY: z.string().optional(),
  PINATA_SECRET_KEY: z.string().optional(),
  
  // Security
  JWT_SECRET: z.string().optional(),
  CORS_ORIGIN: z.string().default('*'),
});

const env = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test',
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  ABSTRACT_RPC_URL: process.env.ABSTRACT_RPC_URL,
  CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID) : undefined,
  LAUNCH_FACTORY_ADDRESS: process.env.LAUNCH_FACTORY_ADDRESS,
  PLATFORM_ROUTER_ADDRESS: process.env.PLATFORM_ROUTER_ADDRESS,
  REWARDS_VAULT_ADDRESS: process.env.REWARDS_VAULT_ADDRESS,
  INDEXER_INTERVAL_MS: process.env.INDEXER_INTERVAL_MS ? parseInt(process.env.INDEXER_INTERVAL_MS) : undefined,
  INDEXER_BATCH_SIZE: process.env.INDEXER_BATCH_SIZE ? parseInt(process.env.INDEXER_BATCH_SIZE) : undefined,
  START_BLOCK: process.env.START_BLOCK ? parseInt(process.env.START_BLOCK) : undefined,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : undefined,
  RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : undefined,
  IPFS_GATEWAY: process.env.IPFS_GATEWAY,
  PINATA_API_KEY: process.env.PINATA_API_KEY,
  PINATA_SECRET_KEY: process.env.PINATA_SECRET_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
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