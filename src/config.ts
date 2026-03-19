import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/vpn_control',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  tokenExpiryDays: parseInt(process.env.TOKEN_EXPIRY_DAYS || '30', 10),
  dailyFreeMinutes: parseInt(process.env.DAILY_FREE_MINUTES || '30', 10),
  rewardMinutesPerAd: parseInt(process.env.REWARD_MINUTES_PER_AD || '20', 10),
  rewardBytesPerAd: (parseInt(process.env.REWARD_MB_PER_AD || '300', 10) || 300) * 1024 * 1024,
  dailyBandwidthBytes: (parseInt(process.env.DAILY_BANDWIDTH_MB || '1024', 10) || 1024) * 1024 * 1024,
  maxRewardsPerDay: parseInt(process.env.MAX_REWARDS_PER_DAY || '10', 10),
  corsOrigins: process.env.CORS_ORIGINS || '*',
  wireguard: {
    interface: process.env.WG_INTERFACE || 'wg0',
    configPath: process.env.WG_CONFIG_PATH || '/etc/wireguard/wg0.conf',
    serverPublicKey: process.env.WG_SERVER_PUBLIC_KEY || '',
    serverEndpoint: process.env.WG_SERVER_ENDPOINT || '',
    network: process.env.WG_NETWORK || '10.0.0.0/24',
    dns: process.env.WG_DNS || '1.1.1.1',
  },
};
