-- Database Optimization for Volume Tracking and Trading Platform
-- This file contains SQL optimizations for production-ready performance

-- ====================
-- TRADES TABLE INDEXES
-- ====================

-- Index for volume calculations by token and time range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_token_timestamp_volume 
ON trades (token_address, timestamp DESC, amount_in, amount_out, type);

-- Index for trader activity lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_trader_timestamp 
ON trades (trader, timestamp DESC);

-- Composite index for efficient volume aggregations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_volume_calc 
ON trades (token_address, timestamp, type) 
INCLUDE (amount_in, amount_out);

-- Index for transaction hash lookups (already exists as unique)
-- Ensuring it's properly utilized
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_tx_hash 
ON trades (tx_hash);

-- CRITICAL: Optimized index for 24h/7d volume calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_volume_time_optimized 
ON trades (token_address, timestamp DESC) 
WHERE timestamp >= (NOW() - INTERVAL '7 days')
INCLUDE (type, amount_in, amount_out);

-- Index for trending tokens queries (most active in timeframe)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_trending_calc 
ON trades (timestamp DESC, token_address) 
WHERE timestamp >= (NOW() - INTERVAL '24 hours')
INCLUDE (amount_in, type);

-- Index for trader leaderboards and statistics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_trader_volume_stats 
ON trades (trader, timestamp DESC) 
INCLUDE (amount_in, fee_amount);

-- ====================
-- HOLDERS TABLE INDEXES
-- ====================

-- Index for active holder count calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_holders_active_balance 
ON holders (token_address, balance) 
WHERE balance > '0';

-- Index for holder activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_holders_activity 
ON holders (token_address, last_activity DESC);

-- Index for wallet-specific lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_holders_wallet_tokens 
ON holders (wallet, token_address);

-- ====================
-- TOKENS TABLE INDEXES
-- ====================

-- Index for market cap and volume sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_market_metrics 
ON tokens (market_cap DESC, volume_24h DESC, volume_total DESC);

-- Index for creator lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_creator 
ON tokens (creator, created_at DESC);

-- Index for migration status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_migration_status 
ON tokens (migrated, migrated_at);

-- ====================
-- PRICE DATA INDEXES
-- ====================

-- Optimized index for chart data queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_data_chart_optimized 
ON price_data (token_address, interval, timestamp DESC) 
INCLUDE (open, high, low, close, volume);

-- ====================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ====================

-- Materialized view for token statistics (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS token_stats_mv AS
SELECT 
    t.address as token_address,
    t.name,
    t.symbol,
    t.market_cap,
    t.holder_count,
    COALESCE(vol_24h.volume_24h, '0') as volume_24h,
    COALESCE(vol_7d.volume_7d, '0') as volume_7d,
    t.volume_total,
    t.tx_count,
    t.created_at,
    t.updated_at
FROM tokens t
LEFT JOIN (
    SELECT 
        token_address,
        SUM(CASE WHEN type = 'BUY' THEN amount_in::numeric ELSE amount_out::numeric END) as volume_24h
    FROM trades 
    WHERE timestamp >= NOW() - INTERVAL '24 hours'
    GROUP BY token_address
) vol_24h ON t.address = vol_24h.token_address
LEFT JOIN (
    SELECT 
        token_address,
        SUM(CASE WHEN type = 'BUY' THEN amount_in::numeric ELSE amount_out::numeric END) as volume_7d
    FROM trades 
    WHERE timestamp >= NOW() - INTERVAL '7 days'
    GROUP BY token_address
) vol_7d ON t.address = vol_7d.token_address;

-- PERFORMANCE CRITICAL: Materialized view for trending tokens (last 24h)
CREATE MATERIALIZED VIEW IF NOT EXISTS trending_tokens_24h_mv AS
SELECT 
    t.address,
    t.name,
    t.symbol,
    t.image_url,
    t.market_cap,
    t.holder_count,
    COALESCE(stats.volume_24h, 0) as volume_24h,
    COALESCE(stats.trade_count_24h, 0) as trade_count_24h,
    COALESCE(stats.unique_traders_24h, 0) as unique_traders_24h,
    ((t.sold_supply::numeric / NULLIF(t.curve_supply::numeric, 0)) * 100) as progress_percent
FROM tokens t
LEFT JOIN (
    SELECT 
        token_address,
        SUM(CASE WHEN type = 'BUY' THEN amount_in::numeric ELSE amount_out::numeric END) as volume_24h,
        COUNT(*) as trade_count_24h,
        COUNT(DISTINCT trader) as unique_traders_24h
    FROM trades 
    WHERE timestamp >= NOW() - INTERVAL '24 hours'
    GROUP BY token_address
) stats ON t.address = stats.token_address
ORDER BY COALESCE(stats.volume_24h, 0) DESC;

-- Materialized view for holder leaderboards
CREATE MATERIALIZED VIEW IF NOT EXISTS holder_stats_mv AS
SELECT 
    h.wallet,
    COUNT(DISTINCT h.token_address) as token_count,
    SUM(
        CASE 
            WHEN h.balance::numeric > 0 AND t.market_cap::numeric > 0 AND t.sold_supply::numeric > 0
            THEN (h.balance::numeric * t.market_cap::numeric / t.sold_supply::numeric)
            ELSE 0
        END
    ) as total_portfolio_value,
    SUM(h.total_bought::numeric) as total_tokens_bought,
    SUM(h.total_sold::numeric) as total_tokens_sold,
    MAX(h.last_activity) as last_activity
FROM holders h
JOIN tokens t ON h.token_address = t.address
WHERE h.balance::numeric > 0
GROUP BY h.wallet
ORDER BY total_portfolio_value DESC;

-- Index on the materialized views
CREATE INDEX IF NOT EXISTS idx_token_stats_mv_volume 
ON token_stats_mv (volume_24h DESC, volume_7d DESC);

CREATE INDEX IF NOT EXISTS idx_token_stats_mv_market_cap 
ON token_stats_mv (market_cap DESC);

-- Indexes for trending tokens materialized view
CREATE INDEX IF NOT EXISTS idx_trending_tokens_24h_volume 
ON trending_tokens_24h_mv (volume_24h DESC);

CREATE INDEX IF NOT EXISTS idx_trending_tokens_24h_trades 
ON trending_tokens_24h_mv (trade_count_24h DESC);

-- Indexes for holder stats materialized view
CREATE INDEX IF NOT EXISTS idx_holder_stats_mv_value 
ON holder_stats_mv (total_portfolio_value DESC);

CREATE INDEX IF NOT EXISTS idx_holder_stats_mv_tokens 
ON holder_stats_mv (token_count DESC);

-- ====================
-- PARTITIONING STRATEGY
-- ====================

-- For high-volume production systems, consider partitioning trades table by date
-- This example shows monthly partitioning (implement if needed)

/*
-- Create partitioned trades table (for new installations)
CREATE TABLE trades_partitioned (
    id text NOT NULL,
    token_address text NOT NULL,
    trader text NOT NULL,
    user_id text,
    type trade_type NOT NULL,
    amount_in text NOT NULL,
    amount_out text NOT NULL,
    price text NOT NULL,
    fee_amount text NOT NULL,
    tx_hash text NOT NULL,
    block_number integer NOT NULL,
    block_hash text NOT NULL,
    log_index integer NOT NULL,
    timestamp timestamp(3) NOT NULL,
    created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions (example for 2024-2025)
CREATE TABLE trades_2024_01 PARTITION OF trades_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
    
CREATE TABLE trades_2024_02 PARTITION OF trades_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
    
-- Continue for other months...
*/

-- ====================
-- VACUUM AND ANALYZE STRATEGIES
-- ====================

-- Auto-vacuum settings for high-write tables
ALTER TABLE trades SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE holders SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- ====================
-- REFRESH MATERIALIZED VIEWS
-- ====================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_token_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY token_stats_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY trending_tokens_24h_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY holder_stats_mv;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh only trending data (called more frequently)
CREATE OR REPLACE FUNCTION refresh_trending_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY trending_tokens_24h_mv;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- PERFORMANCE MONITORING QUERIES
-- ====================

-- Query to check index usage
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
*/

-- Query to find slow queries
/*
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query LIKE '%trades%' OR query LIKE '%holders%'
ORDER BY mean_time DESC
LIMIT 10;
*/

-- Query to check table sizes
/*
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
*/