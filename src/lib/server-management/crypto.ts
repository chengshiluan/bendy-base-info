import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';
import { env } from '@/lib/env';

const CIPHER_PREFIX = 'enc:v1';

function toBase64Url(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, 'base64');
}

function getKey() {
  return createHash('sha256').update(env.auth.secret).digest();
}

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  return [
    CIPHER_PREFIX,
    toBase64Url(iv),
    toBase64Url(authTag),
    toBase64Url(encrypted)
  ].join(':');
}

export function decryptSecret(ciphertext?: string | null): string | null {
  if (!ciphertext || !ciphertext.startsWith(`${CIPHER_PREFIX}:`)) {
    return null;
  }
  const [, encIv, encTag, encPayload] = ciphertext.split(':');
  if (!encIv || !encTag || !encPayload) {
    return null;
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', getKey(), fromBase64Url(encIv));
    decipher.setAuthTag(fromBase64Url(encTag));
    const decrypted = Buffer.concat([
      decipher.update(fromBase64Url(encPayload)),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (_error) {
    return null;
  }
}
