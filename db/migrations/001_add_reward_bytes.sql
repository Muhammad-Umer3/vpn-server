-- Add bytes_added to rewards (for existing databases)
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS bytes_added BIGINT DEFAULT 0;
