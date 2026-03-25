-- Migration: 20260324151000_drop_metrics_telemetry.sql
-- Drop the get_metrics_stats RPC if it exists
DROP FUNCTION IF EXISTS get_metrics_stats(timestamp with time zone, timestamp with time zone, text);

-- Drop the circuit_breaker_metrics table and all its indices
DROP TABLE IF EXISTS circuit_breaker_metrics CASCADE;
