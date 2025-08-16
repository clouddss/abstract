import { PrismaClient } from '@prisma/client';
import { appConfig, isProduction } from '../config';
import { databaseLogger } from '../utils/logger';

declare global {
  // Prevent multiple instances of Prisma Client in development
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  return new PrismaClient({
    log: appConfig.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
    datasources: {
      db: {
        url: appConfig.DATABASE_URL,
      },
    },
    // Enhanced configuration for production
    ...(isProduction && {
      // Connection pool configuration
      transactionOptions: {
        timeout: 10000, // 10 seconds
        maxWait: 5000,  // 5 seconds
        isolationLevel: 'ReadCommitted'
      }
    })
  });
};

export const prisma = globalThis.__prisma ?? createPrismaClient();

// Prisma will log directly to stdout/stderr based on the log configuration above

if (appConfig.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    databaseLogger.error({ error }, 'Database health check failed');
    return false;
  }
}

// Connection metrics
export async function getDatabaseMetrics() {
  try {
    // Note: $metrics is available in newer Prisma versions with preview features
    // For now, return basic connection info
    return {
      connected: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    databaseLogger.error({ error }, 'Failed to get database metrics');
    return null;
  }
}

// Graceful shutdown with timeout
const gracefulShutdown = async (signal: string) => {
  databaseLogger.info({ signal }, 'Received shutdown signal, closing database connection');
  
  try {
    await Promise.race([
      prisma.$disconnect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database disconnect timeout')), 5000)
      )
    ]);
    databaseLogger.info('Database connection closed successfully');
  } catch (error) {
    databaseLogger.error({ error }, 'Error during database disconnect');
  } finally {
    process.exit(0);
  }
};

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Connection retry logic
export async function connectWithRetry(retries = 5): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      databaseLogger.info('Successfully connected to database');
      return;
    } catch (error) {
      databaseLogger.error({ 
        error, 
        attempt: i + 1, 
        maxRetries: retries 
      }, 'Failed to connect to database');
      
      if (i === retries - 1) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, i), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}