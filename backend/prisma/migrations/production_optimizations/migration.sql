-- Production Database Optimizations
-- This migration adds indexes, constraints, and optimizations for production deployment

-- Add performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tokens_created_at_idx" ON "tokens"("created_at" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tokens_volume_total_idx" ON "tokens"("volume_total" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tokens_market_cap_idx" ON "tokens"("market_cap" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tokens_holder_count_idx" ON "tokens"("holder_count" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tokens_migrated_idx" ON "tokens"("migrated");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tokens_creator_idx" ON "tokens"("creator");

-- Trades table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "trades_timestamp_desc_idx" ON "trades"("timestamp" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "trades_token_timestamp_idx" ON "trades"("token_address", "timestamp" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "trades_trader_timestamp_idx" ON "trades"("trader", "timestamp" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "trades_type_idx" ON "trades"("type");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "trades_block_number_idx" ON "trades"("block_number");

-- Holders table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "holders_token_balance_idx" ON "holders"("token_address", "balance" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "holders_wallet_idx" ON "holders"("wallet");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "holders_last_activity_idx" ON "holders"("last_activity" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "holders_first_bought_idx" ON "holders"("first_bought_at");

-- Price data optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "price_data_token_interval_timestamp_idx" ON "price_data"("token_address", "interval", "timestamp" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "price_data_timestamp_idx" ON "price_data"("timestamp" DESC);

-- Reward distributions optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "reward_distributions_epoch_wallet_idx" ON "reward_distributions"("epoch_number", "wallet");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "reward_distributions_wallet_claimed_idx" ON "reward_distributions"("wallet", "claimed");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "reward_distributions_token_epoch_idx" ON "reward_distributions"("token_address", "epoch_number");

-- Platform stats optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "platform_stats_date_desc_idx" ON "platform_stats"("date" DESC);

-- Users table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_last_active_idx" ON "users"("last_active_at" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_created_at_idx" ON "users"("created_at" DESC);

-- Indexer state optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "indexer_state_contract_name_idx" ON "indexer_state"("contract_name");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "indexer_state_synced_idx" ON "indexer_state"("synced");

-- Add partial indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tokens_active_idx" ON "tokens"("created_at" DESC) WHERE "migrated" = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "trades_recent_idx" ON "trades"("timestamp" DESC) WHERE "timestamp" > NOW() - INTERVAL '7 days';
CREATE INDEX CONCURRENTLY IF NOT EXISTS "holders_active_idx" ON "holders"("token_address", "balance" DESC) WHERE "balance" > '0';

-- Add constraints for data integrity
ALTER TABLE "tokens" ADD CONSTRAINT IF NOT EXISTS "tokens_total_supply_positive" CHECK ("total_supply"::numeric > 0);
ALTER TABLE "tokens" ADD CONSTRAINT IF NOT EXISTS "tokens_curve_supply_positive" CHECK ("curve_supply"::numeric > 0);
ALTER TABLE "tokens" ADD CONSTRAINT IF NOT EXISTS "tokens_sold_supply_non_negative" CHECK ("sold_supply"::numeric >= 0);
ALTER TABLE "tokens" ADD CONSTRAINT IF NOT EXISTS "tokens_market_cap_non_negative" CHECK ("market_cap"::numeric >= 0);
ALTER TABLE "tokens" ADD CONSTRAINT IF NOT EXISTS "tokens_volume_non_negative" CHECK ("volume_total"::numeric >= 0);

ALTER TABLE "trades" ADD CONSTRAINT IF NOT EXISTS "trades_amount_in_positive" CHECK ("amount_in"::numeric > 0);
ALTER TABLE "trades" ADD CONSTRAINT IF NOT EXISTS "trades_amount_out_positive" CHECK ("amount_out"::numeric > 0);
ALTER TABLE "trades" ADD CONSTRAINT IF NOT EXISTS "trades_price_positive" CHECK ("price"::numeric > 0);
ALTER TABLE "trades" ADD CONSTRAINT IF NOT EXISTS "trades_fee_non_negative" CHECK ("fee_amount"::numeric >= 0);

ALTER TABLE "holders" ADD CONSTRAINT IF NOT EXISTS "holders_balance_non_negative" CHECK ("balance"::numeric >= 0);
ALTER TABLE "holders" ADD CONSTRAINT IF NOT EXISTS "holders_total_bought_non_negative" CHECK ("total_bought"::numeric >= 0);
ALTER TABLE "holders" ADD CONSTRAINT IF NOT EXISTS "holders_total_sold_non_negative" CHECK ("total_sold"::numeric >= 0);

-- Add foreign key constraints with proper cascading
ALTER TABLE "trades" DROP CONSTRAINT IF EXISTS "trades_token_address_fkey";
ALTER TABLE "trades" ADD CONSTRAINT "trades_token_address_fkey" 
  FOREIGN KEY ("token_address") REFERENCES "tokens"("address") 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "holders" DROP CONSTRAINT IF EXISTS "holders_token_address_fkey";
ALTER TABLE "holders" ADD CONSTRAINT "holders_token_address_fkey" 
  FOREIGN KEY ("token_address") REFERENCES "tokens"("address") 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_data" DROP CONSTRAINT IF EXISTS "price_data_token_address_fkey";
ALTER TABLE "price_data" ADD CONSTRAINT "price_data_token_address_fkey" 
  FOREIGN KEY ("token_address") REFERENCES "tokens"("address") 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reward_distributions" DROP CONSTRAINT IF EXISTS "reward_distributions_token_address_fkey";
ALTER TABLE "reward_distributions" ADD CONSTRAINT "reward_distributions_token_address_fkey" 
  FOREIGN KEY ("token_address") REFERENCES "tokens"("address") 
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Create materialized views for analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS "token_stats_24h" AS
SELECT 
  t.address,
  t.name,
  t.symbol,
  t.market_cap,
  t.volume_total,
  COUNT(DISTINCT tr.trader) as unique_traders_24h,
  COUNT(tr.id) as trades_24h,
  SUM(CASE WHEN tr.type = 'BUY' THEN tr.amount_in::numeric ELSE 0 END) as volume_buy_24h,
  SUM(CASE WHEN tr.type = 'SELL' THEN tr.amount_out::numeric ELSE 0 END) as volume_sell_24h,
  AVG(tr.price::numeric) as avg_price_24h,
  MAX(tr.price::numeric) as high_price_24h,
  MIN(tr.price::numeric) as low_price_24h
FROM tokens t
LEFT JOIN trades tr ON t.address = tr.token_address 
  AND tr.timestamp > NOW() - INTERVAL '24 hours'
GROUP BY t.address, t.name, t.symbol, t.market_cap, t.volume_total;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS "token_stats_24h_address_idx" ON "token_stats_24h"("address");

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY "token_stats_24h";
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for updating token stats
CREATE OR REPLACE FUNCTION update_token_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update token volume and trade count
  UPDATE tokens 
  SET 
    volume_total = volume_total::numeric + NEW.amount_in::numeric,
    tx_count = tx_count + 1,
    updated_at = NOW()
  WHERE address = NEW.token_address;
  
  -- Update holder stats
  IF NEW.type = 'BUY' THEN
    INSERT INTO holders (token_address, wallet, balance, first_bought_at, last_activity, total_bought)
    VALUES (NEW.token_address, NEW.trader, NEW.amount_out, NEW.timestamp, NEW.timestamp, NEW.amount_in)
    ON CONFLICT (token_address, wallet) 
    DO UPDATE SET 
      balance = holders.balance::numeric + NEW.amount_out::numeric,
      last_activity = NEW.timestamp,
      total_bought = holders.total_bought::numeric + NEW.amount_in::numeric;
  ELSE
    UPDATE holders 
    SET 
      balance = GREATEST(0, balance::numeric - NEW.amount_in::numeric),
      last_activity = NEW.timestamp,
      total_sold = total_sold::numeric + NEW.amount_out::numeric
    WHERE token_address = NEW.token_address AND wallet = NEW.trader;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for trade insertions
DROP TRIGGER IF EXISTS update_token_stats_trigger ON trades;
CREATE TRIGGER update_token_stats_trigger
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_token_stats();

-- Create function for database maintenance
CREATE OR REPLACE FUNCTION perform_maintenance()
RETURNS void AS $$
BEGIN
  -- Refresh analytics views
  PERFORM refresh_analytics_views();
  
  -- Update table statistics
  ANALYZE tokens;
  ANALYZE trades;
  ANALYZE holders;
  ANALYZE price_data;
  ANALYZE reward_distributions;
  
  -- Clean up old indexer logs (keep 30 days)
  DELETE FROM indexer_state 
  WHERE updated_at < NOW() - INTERVAL '30 days' 
  AND synced = true;
  
  -- Clean up old price data (keep 1 year for minute intervals)
  DELETE FROM price_data 
  WHERE interval = 'MINUTE_1' 
  AND timestamp < NOW() - INTERVAL '1 year';
  
  -- Clean up old platform stats (keep 2 years)
  DELETE FROM platform_stats 
  WHERE date < NOW() - INTERVAL '2 years';
  
END;
$$ LANGUAGE plpgsql;

-- Create connection pooling configuration
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Enable query plan optimization
ALTER SYSTEM SET constraint_exclusion = partition;
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log slow queries
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_lock_waits = on;