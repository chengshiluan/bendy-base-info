import { createHash, randomInt } from 'crypto';
import { getRedis } from '@/lib/redis';

const CODE_TTL_SECONDS = 60 * 10;

function getEmailKey(email: string): string {
  return `auth:email-code:${email.toLowerCase()}`;
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function generateLoginCode(): string {
  return `${randomInt(100000, 999999)}`;
}

export async function saveLoginCode(
  email: string,
  code: string
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    throw new Error('Redis is not configured.');
  }

  await redis.set(
    getEmailKey(email),
    {
      hash: hashCode(code),
      attempts: 0
    },
    { ex: CODE_TTL_SECONDS }
  );
}

export async function consumeLoginCode(
  email: string,
  code: string
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    return false;
  }

  const key = getEmailKey(email);
  const payload = await redis.get<{ hash: string; attempts: number }>(key);
  if (!payload) {
    return false;
  }

  const matches = payload.hash === hashCode(code);
  if (!matches) {
    await redis.set(
      key,
      {
        hash: payload.hash,
        attempts: (payload.attempts ?? 0) + 1
      },
      { ex: CODE_TTL_SECONDS }
    );
    return false;
  }

  await redis.del(key);
  return true;
}
