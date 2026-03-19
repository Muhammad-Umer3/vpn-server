-- VPN Control API - PostgreSQL Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Devices (anonymous, identified by hashed device_id from Android)
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id_hash VARCHAR(64) NOT NULL UNIQUE,
  device_token VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_device_token ON devices(device_token);
CREATE INDEX idx_devices_device_id_hash ON devices(device_id_hash);

-- Usage records (daily tracking per device)
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  minutes_used INTEGER DEFAULT 0,
  data_bytes BIGINT DEFAULT 0,
  last_session_start TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, date)
);

CREATE INDEX idx_usage_records_device_date ON usage_records(device_id, date);

-- Rewards (audit log for ad rewards - AdMob, etc.)
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  reward_type VARCHAR(50) NOT NULL,
  minutes_added INTEGER NOT NULL,
  bytes_added BIGINT DEFAULT 0,
  ad_network VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rewards_device_created ON rewards(device_id, created_at);

-- WireGuard peers (per-user configs)
CREATE TABLE IF NOT EXISTS wireguard_peers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE UNIQUE,
  public_key VARCHAR(64) NOT NULL UNIQUE,
  private_key_encrypted TEXT,
  vpn_address VARCHAR(32) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wireguard_peers_device ON wireguard_peers(device_id);

-- VPN servers (WireGuard endpoints)
-- Insert your server after running wireguard-setup.sh:
-- INSERT INTO servers (name, region, host, port, public_key, endpoint) 
-- VALUES ('US East', 'us-east', 'your-droplet-ip', 51820, 'your-wg-public-key', 'your-droplet-ip:51820');
CREATE TABLE IF NOT EXISTS servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  region VARCHAR(50) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INTEGER DEFAULT 51820,
  public_key VARCHAR(64) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
