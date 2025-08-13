import { PrismaClient } from '@prisma/client';
import { appConfig } from '../config';

declare global {
  // Prevent multiple instances of Prisma Client in development
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  return new PrismaClient({
    log: appConfig.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: appConfig.DATABASE_URL,
      },
    },
  });
};

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (appConfig.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});