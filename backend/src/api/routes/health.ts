import { Router } from 'express';
import { checkDatabaseHealth, getDatabaseMetrics } from '../../database/client';
import { cache } from '../../cache/redis';
import { appConfig } from '../../config';
import { appLogger, performanceLogger } from '../../utils/logger';
import { validateAdminKey } from '../middleware/security';
import { ethers } from 'ethers';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    blockchain: ServiceHealth;
  };
  metrics?: {
    memory: NodeJS.MemoryUsage;
    cpu: any;
    database?: any;
    cache?: any;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
  lastChecked: string;
}

// Basic health check - public endpoint
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: appConfig.NODE_ENV,
      services: {
        database: await checkDatabaseService(),
        redis: await checkRedisService(),
        blockchain: await checkBlockchainService()
      }
    };

    // Determine overall status
    const serviceStatuses = Object.values(healthStatus.services);
    if (serviceStatuses.some(s => s.status === 'unhealthy')) {
      healthStatus.status = 'unhealthy';
    } else if (serviceStatuses.some(s => s.status === 'unhealthy')) {
      healthStatus.status = 'degraded';
    }

    const responseTime = Date.now() - startTime;
    performanceLogger.info({
      endpoint: '/health',
      responseTime,
      status: healthStatus.status
    }, 'Health check completed');

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      success: healthStatus.status === 'healthy',
      data: healthStatus
    });

  } catch (error) {
    appLogger.error({ error }, 'Health check failed');
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed health check with metrics - admin only
router.get('/detailed', validateAdminKey, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: appConfig.NODE_ENV,
      services: {
        database: await checkDatabaseService(),
        redis: await checkRedisService(),
        blockchain: await checkBlockchainService()
      },
      metrics: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        database: await getDatabaseMetrics(),
        cache: await cache.getStats()
      }
    };

    // Determine overall status
    const serviceStatuses = Object.values(healthStatus.services);
    if (serviceStatuses.some(s => s.status === 'unhealthy')) {
      healthStatus.status = 'unhealthy';
    }

    const responseTime = Date.now() - startTime;
    performanceLogger.info({
      endpoint: '/health/detailed',
      responseTime,
      status: healthStatus.status
    }, 'Detailed health check completed');

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      success: healthStatus.status === 'healthy',
      data: healthStatus
    });

  } catch (error) {
    appLogger.error({ error }, 'Detailed health check failed');
    res.status(503).json({
      success: false,
      error: 'Detailed health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness probe - simple check that service is running
router.get('/live', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

// Readiness probe - check if service is ready to accept traffic
router.get('/ready', async (req, res) => {
  try {
    // Check critical dependencies
    const [dbHealthy, redisHealthy] = await Promise.all([
      checkDatabaseHealth(),
      cache.healthCheck()
    ]);

    const isReady = dbHealthy && redisHealthy;

    res.status(isReady ? 200 : 503).json({
      success: isReady,
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy,
        redis: redisHealthy
      }
    });

  } catch (error) {
    appLogger.error({ error }, 'Readiness check failed');
    res.status(503).json({
      success: false,
      status: 'not_ready',
      error: 'Readiness check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint - Prometheus compatible
router.get('/metrics', validateAdminKey, async (req, res) => {
  try {
    const metrics = await generateMetrics();
    
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    appLogger.error({ error }, 'Metrics generation failed');
    res.status(500).json({
      success: false,
      error: 'Metrics generation failed'
    });
  }
});

// Helper functions
async function checkDatabaseService(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    const isHealthy = await checkDatabaseHealth();
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString()
    };
  }
}

async function checkRedisService(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    const isHealthy = await cache.healthCheck();
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString()
    };
  }
}

async function checkBlockchainService(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    // Create provider and check connection
    const provider = new ethers.JsonRpcProvider(appConfig.ABSTRACT_RPC_URL);
    await provider.getBlockNumber();
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString()
    };
  }
}

async function generateMetrics(): Promise<string> {
  const memory = process.memoryUsage();
  const uptime = process.uptime();
  
  let metrics = '';
  
  // Process metrics
  metrics += `# HELP nodejs_memory_usage_bytes Node.js memory usage in bytes\n`;
  metrics += `# TYPE nodejs_memory_usage_bytes gauge\n`;
  metrics += `nodejs_memory_usage_bytes{type="rss"} ${memory.rss}\n`;
  metrics += `nodejs_memory_usage_bytes{type="heapTotal"} ${memory.heapTotal}\n`;
  metrics += `nodejs_memory_usage_bytes{type="heapUsed"} ${memory.heapUsed}\n`;
  metrics += `nodejs_memory_usage_bytes{type="external"} ${memory.external}\n`;
  
  metrics += `# HELP nodejs_uptime_seconds Process uptime in seconds\n`;
  metrics += `# TYPE nodejs_uptime_seconds gauge\n`;
  metrics += `nodejs_uptime_seconds ${uptime}\n`;
  
  // Service health metrics
  const dbHealth = await checkDatabaseService();
  const redisHealth = await checkRedisService();
  const blockchainHealth = await checkBlockchainService();
  
  metrics += `# HELP service_health Service health status (1 = healthy, 0 = unhealthy)\n`;
  metrics += `# TYPE service_health gauge\n`;
  metrics += `service_health{service="database"} ${dbHealth.status === 'healthy' ? 1 : 0}\n`;
  metrics += `service_health{service="redis"} ${redisHealth.status === 'healthy' ? 1 : 0}\n`;
  metrics += `service_health{service="blockchain"} ${blockchainHealth.status === 'healthy' ? 1 : 0}\n`;
  
  // Response time metrics
  metrics += `# HELP service_response_time_ms Service response time in milliseconds\n`;
  metrics += `# TYPE service_response_time_ms gauge\n`;
  metrics += `service_response_time_ms{service="database"} ${dbHealth.responseTime || 0}\n`;
  metrics += `service_response_time_ms{service="redis"} ${redisHealth.responseTime || 0}\n`;
  metrics += `service_response_time_ms{service="blockchain"} ${blockchainHealth.responseTime || 0}\n`;
  
  return metrics;
}

export default router;