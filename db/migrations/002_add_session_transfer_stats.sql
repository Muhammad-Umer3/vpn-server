-- Store WireGuard transfer stats at session start for server-side usage tracking
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS session_start_rx BIGINT;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS session_start_tx BIGINT;
