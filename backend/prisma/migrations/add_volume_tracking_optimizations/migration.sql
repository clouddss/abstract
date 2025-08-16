-- Migration: Add Volume Tracking Optimizations
-- This migration adds indexes and optimizations for production-ready volume tracking

-- Add indexes for efficient volume calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_trades_token_timestamp_volume" 
ON "trades" ("tokenAddress", "timestamp" DESC, "amountIn", "amountOut", "type");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_trades_volume_calc" 
ON "trades" ("tokenAddress", "timestamp", "type") 
INCLUDE ("amountIn", "amountOut");

-- Add indexes for holder management
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_holders_active_balance" 
ON "holders" ("tokenAddress", "balance") 
WHERE "balance" > '0';

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_holders_activity" 
ON "holders" ("tokenAddress", "lastActivity" DESC);

-- Add indexes for token metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_tokens_market_metrics" 
ON "tokens" ("marketCap" DESC, "volume24h" DESC, "volumeTotal" DESC);

-- Add indexes for price data (if exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_price_data_chart_optimized" 
ON "price_data" ("tokenAddress", "interval", "timestamp" DESC) 
INCLUDE ("open", "high", "low", "close", "volume");

-- Create materialized view for token statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS "token_stats_mv" AS
SELECT 
    t."address" as "tokenAddress",
    t."name",
    t."symbol",
    t."marketCap",
    t."holderCount",
    COALESCE(vol_24h."volume24h", '0') as "volume24h",
    COALESCE(vol_7d."volume7d", '0') as "volume7d",
    t."volumeTotal",
    t."txCount",
    t."createdAt",
    t."updatedAt"
FROM "tokens" t
LEFT JOIN (
    SELECT 
        "tokenAddress",
        SUM(CASE WHEN "type" = 'BUY' THEN "amountIn"::numeric ELSE "amountOut"::numeric END) as "volume24h"
    FROM "trades" 
    WHERE "timestamp" >= NOW() - INTERVAL '24 hours'
    GROUP BY "tokenAddress"
) vol_24h ON t."address" = vol_24h."tokenAddress"
LEFT JOIN (
    SELECT 
        "tokenAddress",
        SUM(CASE WHEN "type" = 'BUY' THEN "amountIn"::numeric ELSE "amountOut"::numeric END) as "volume7d"
    FROM "trades" 
    WHERE "timestamp" >= NOW() - INTERVAL '7 days'
    GROUP BY "tokenAddress"
) vol_7d ON t."address" = vol_7d."tokenAddress";

-- Add indexes on materialized view
CREATE INDEX IF NOT EXISTS "idx_token_stats_mv_volume" 
ON "token_stats_mv" ("volume24h" DESC, "volume7d" DESC);

CREATE INDEX IF NOT EXISTS "idx_token_stats_mv_market_cap" 
ON "token_stats_mv" ("marketCap" DESC);

-- Optimize auto-vacuum settings for high-write tables
ALTER TABLE "trades" SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE "holders" SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_token_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY "token_stats_mv";
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments for maintenance
COMMENT ON INDEX "idx_trades_token_timestamp_volume" IS 'Optimizes volume calculations by token and time range';
COMMENT ON INDEX "idx_holders_active_balance" IS 'Optimizes holder count queries for active balances';
COMMENT ON MATERIALIZED VIEW "token_stats_mv" IS 'Pre-calculated token statistics for better performance';
COMMENT ON FUNCTION refresh_token_stats() IS 'Refreshes token statistics materialized view';