import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import Redis from 'ioredis';
import { config } from '../config';

let redis: Redis | null = null;
try {
  redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });
  redis.on('error', () => {});
} catch {
  redis = null;
}

const createStore = () =>
  redis
    ? new RedisStore({
        sendCommand: (...args: string[]) =>
          redis!.call(args[0], ...args.slice(1)) as Promise<RedisReply>,
      })
    : undefined;

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});

/** Reward: 5 per hour per IP — prevents reward spam from decompiled apps */
export const rewardRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});

/** Config: 30 per 15 min — limits config scraping */
export const configRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});

/** Servers: 30 per 15 min — limits server list scraping */
export const serversRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});
