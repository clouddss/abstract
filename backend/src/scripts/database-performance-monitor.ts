import { prisma } from '../database/client';
import { VolumeAggregationService } from '../api/services/volumeAggregation';
import { queryCacheService } from '../api/services/queryCache';

/**
 * Database Performance Monitoring Script
 * 
 * Run this script to:
 * 1. Monitor slow queries
 * 2. Check index usage
 * 3. Track cache performance
 * 4. Refresh materialized views
 * 5. Generate performance reports
 */

interface SlowQuery {
  query: string;
  calls: number;
  total_time: number;
  mean_time: number;
  rows: number;
}

interface IndexUsage {
  schemaname: string;
  tablename: string;
  indexname: string;
  idx_scan: number;
  idx_tup_read: number;
  idx_tup_fetch: number;
}

interface TableSize {
  schemaname: string;
  tablename: string;
  size: string;
  size_bytes: number;
}

class DatabasePerformanceMonitor {
  
  /**
   * MONITORING: Check for slow queries
   */
  async getSlowQueries(limit: number = 20): Promise<SlowQuery[]> {
    try {
      const result = await prisma.$queryRaw<SlowQuery[]>`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        WHERE query NOT LIKE '%pg_stat_statements%'
          AND query NOT LIKE '%REFRESH MATERIALIZED VIEW%'
        ORDER BY mean_time DESC
        LIMIT ${limit}
      `;
      return result;
    } catch (error) {
      console.warn('pg_stat_statements extension not available:', error.message);
      return [];
    }
  }

  /**
   * MONITORING: Check index usage statistics
   */
  async getIndexUsage(): Promise<IndexUsage[]> {
    const result = await prisma.$queryRaw<IndexUsage[]>`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes 
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
    `;
    return result;
  }

  /**
   * MONITORING: Get table sizes
   */
  async getTableSizes(): Promise<TableSize[]> {
    const result = await prisma.$queryRaw<TableSize[]>`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;
    return result;
  }

  /**
   * OPTIMIZATION: Refresh all materialized views
   */
  async refreshMaterializedViews(): Promise<{
    success: boolean;
    results: Array<{ view: string; success: boolean; error?: string }>;
  }> {
    const views = ['token_stats_mv', 'trending_tokens_24h_mv', 'holder_stats_mv'];
    const results: Array<{ view: string; success: boolean; error?: string }> = [];

    for (const view of views) {
      try {
        console.log(`Refreshing materialized view: ${view}`);
        await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`;
        results.push({ view, success: true });
        console.log(`✅ Successfully refreshed ${view}`);
      } catch (error) {
        console.error(`❌ Failed to refresh ${view}:`, error.message);
        results.push({ view, success: false, error: error.message });
      }
    }

    const allSuccess = results.every(r => r.success);
    return { success: allSuccess, results };
  }

  /**
   * PERFORMANCE: Generate comprehensive performance report
   */
  async generatePerformanceReport(): Promise<{
    timestamp: Date;
    slowQueries: SlowQuery[];
    indexUsage: IndexUsage[];
    tableSizes: TableSize[];
    cacheStats: any;
    databaseStats: any;
    recommendations: string[];
  }> {
    console.log('🔍 Generating database performance report...');

    const [slowQueries, indexUsage, tableSizes] = await Promise.all([
      this.getSlowQueries(10),
      this.getIndexUsage(),
      this.getTableSizes()
    ]);

    // Get cache statistics
    const cacheStats = queryCacheService.getStats();

    // Get database connection stats
    const databaseStats = await this.getDatabaseStats();

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      slowQueries,
      indexUsage,
      tableSizes,
      cacheStats
    );

    const report = {
      timestamp: new Date(),
      slowQueries,
      indexUsage,
      tableSizes,
      cacheStats,
      databaseStats,
      recommendations
    };

    // Print formatted report
    this.printFormattedReport(report);

    return report;
  }

  /**
   * MONITORING: Get database connection and performance stats
   */
  private async getDatabaseStats() {
    try {
      const [connectionStats, activityStats] = await Promise.all([
        prisma.$queryRaw<Array<{ state: string; count: number }>>`
          SELECT state, count(*) as count
          FROM pg_stat_activity 
          WHERE datname = current_database()
          GROUP BY state
        `,
        prisma.$queryRaw<Array<{ 
          total_connections: number;
          active_connections: number;
          idle_connections: number;
        }>>`
          SELECT 
            count(*) as total_connections,
            count(*) FILTER (WHERE state = 'active') as active_connections,
            count(*) FILTER (WHERE state = 'idle') as idle_connections
          FROM pg_stat_activity 
          WHERE datname = current_database()
        `
      ]);

      return { connectionStats, activityStats: activityStats[0] };
    } catch (error) {
      console.warn('Could not get database stats:', error.message);
      return { connectionStats: [], activityStats: {} };
    }
  }

  /**
   * ANALYSIS: Generate performance recommendations
   */
  private generateRecommendations(
    slowQueries: SlowQuery[],
    indexUsage: IndexUsage[],
    tableSizes: TableSize[],
    cacheStats: any
  ): string[] {
    const recommendations: string[] = [];

    // Analyze slow queries
    if (slowQueries.length > 0) {
      const averageTime = slowQueries.reduce((sum, q) => sum + q.mean_time, 0) / slowQueries.length;
      if (averageTime > 1000) { // 1 second
        recommendations.push(
          `🐌 CRITICAL: Average query time is ${(averageTime / 1000).toFixed(2)}s. Consider optimizing slow queries.`
        );
      }

      const heavyQueries = slowQueries.filter(q => q.mean_time > 5000); // 5 seconds
      if (heavyQueries.length > 0) {
        recommendations.push(
          `⚠️  Found ${heavyQueries.length} queries with >5s average execution time. Immediate optimization needed.`
        );
      }
    }

    // Analyze index usage
    const unusedIndexes = indexUsage.filter(idx => idx.idx_scan < 10);
    if (unusedIndexes.length > 0) {
      recommendations.push(
        `📊 Found ${unusedIndexes.length} potentially unused indexes. Consider dropping them to save space.`
      );
    }

    const missingIndexes = indexUsage.filter(idx => 
      idx.tablename === 'trades' && idx.idx_scan > 1000 && idx.idx_tup_read / idx.idx_scan > 100
    );
    if (missingIndexes.length > 0) {
      recommendations.push(
        `🔍 High index scan ratios detected on trades table. Consider adding composite indexes.`
      );
    }

    // Analyze table sizes
    const largeTable = tableSizes.find(t => t.size_bytes > 1024 * 1024 * 1024); // 1GB
    if (largeTable) {
      recommendations.push(
        `💾 Table '${largeTable.tablename}' is ${largeTable.size}. Consider partitioning for better performance.`
      );
    }

    // Analyze cache performance
    if (cacheStats.cacheHitRate < 80) {
      recommendations.push(
        `🗄️  Cache hit rate is ${cacheStats.cacheHitRate.toFixed(1)}%. Consider increasing cache TTL or pre-warming cache.`
      );
    }

    if (cacheStats.expiredEntries > cacheStats.validEntries) {
      recommendations.push(
        `⏰ High number of expired cache entries. Consider adjusting TTL values or cache cleanup frequency.`
      );
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('✅ Database performance looks good! No immediate optimizations needed.');
    } else {
      recommendations.push('💡 Run ANALYZE on tables after implementing optimizations.');
      recommendations.push('🔄 Consider refreshing materialized views more frequently during high traffic.');
    }

    return recommendations;
  }

  /**
   * REPORTING: Print formatted performance report
   */
  private printFormattedReport(report: any): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DATABASE PERFORMANCE REPORT');
    console.log('='.repeat(60));
    console.log(`Generated: ${report.timestamp.toISOString()}`);
    
    console.log('\n🐌 SLOW QUERIES (Top 5):');
    console.log('-'.repeat(40));
    report.slowQueries.slice(0, 5).forEach((query, index) => {
      console.log(`${index + 1}. Avg: ${(query.mean_time / 1000).toFixed(2)}s | Calls: ${query.calls}`);
      console.log(`   Query: ${query.query.substring(0, 80)}...`);
    });

    console.log('\n📈 CACHE PERFORMANCE:');
    console.log('-'.repeat(40));
    console.log(`Cache Hit Rate: ${report.cacheStats.cacheHitRate.toFixed(1)}%`);
    console.log(`Total Entries: ${report.cacheStats.totalEntries}`);
    console.log(`Valid Entries: ${report.cacheStats.validEntries}`);
    console.log(`Memory Usage: ${(report.cacheStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n💾 LARGEST TABLES:');
    console.log('-'.repeat(40));
    report.tableSizes.slice(0, 5).forEach((table, index) => {
      console.log(`${index + 1}. ${table.tablename}: ${table.size}`);
    });

    console.log('\n💡 RECOMMENDATIONS:');
    console.log('-'.repeat(40));
    report.recommendations.forEach(rec => {
      console.log(rec);
    });

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * MAINTENANCE: Run routine maintenance tasks
   */
  async runMaintenance(): Promise<void> {
    console.log('🔧 Running database maintenance tasks...');

    // 1. Refresh materialized views
    console.log('\n1️⃣ Refreshing materialized views...');
    await this.refreshMaterializedViews();

    // 2. Update table statistics
    console.log('\n2️⃣ Updating table statistics...');
    await prisma.$executeRaw`ANALYZE`;

    // 3. Clear expired cache entries
    console.log('\n3️⃣ Clearing expired cache entries...');
    const initialCacheSize = queryCacheService.getStats().totalEntries;
    // Cache cleanup is automatic, but we can force it
    queryCacheService.clearAll();
    console.log(`Cleared ${initialCacheSize} cache entries`);

    // 4. Generate performance report
    console.log('\n4️⃣ Generating performance report...');
    await this.generatePerformanceReport();

    console.log('✅ Maintenance tasks completed!');
  }
}

// Export the monitor
export const performanceMonitor = new DatabasePerformanceMonitor();

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'report':
      performanceMonitor.generatePerformanceReport()
        .then(() => process.exit(0))
        .catch(err => {
          console.error('Error generating report:', err);
          process.exit(1);
        });
      break;
      
    case 'maintenance':
      performanceMonitor.runMaintenance()
        .then(() => process.exit(0))
        .catch(err => {
          console.error('Error running maintenance:', err);
          process.exit(1);
        });
      break;
      
    case 'refresh-views':
      performanceMonitor.refreshMaterializedViews()
        .then((result) => {
          console.log('Materialized views refresh result:', result);
          process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
          console.error('Error refreshing views:', err);
          process.exit(1);
        });
      break;
      
    default:
      console.log('Usage: ts-node database-performance-monitor.ts [command]');
      console.log('Commands:');
      console.log('  report        - Generate performance report');
      console.log('  maintenance   - Run full maintenance');
      console.log('  refresh-views - Refresh materialized views');
      process.exit(1);
  }
}