import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';

let redis: Redis | null = null;

export function getRedis() {
  if (!env.redis.enabled || !env.redis.url || !env.redis.token) {
    return null;
  }

  if (!redis) {
    redis = new Redis({
      url: env.redis.url,
      token: env.redis.token
    });
  }

  return redis;
}
