import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';
import { env } from '@/lib/env';
import type { ManagedWealthEntry } from '@/lib/platform/types';

const PASSWORD_STORAGE_KEY = '__account_password_ciphertext__';
const PASSWORD_CIPHER_PREFIX = 'enc:v1';

type AccountStoragePayload = {
  wealthEntries: ManagedWealthEntry[];
  passwordCiphertext: string | null;
};

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

function getPasswordEncryptionKey() {
  return createHash('sha256').update(env.auth.secret).digest();
}

export function encryptManagedAccountPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getPasswordEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(password, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return [
    PASSWORD_CIPHER_PREFIX,
    toBase64Url(iv),
    toBase64Url(authTag),
    toBase64Url(encrypted)
  ].join(':');
}

export function decryptManagedAccountPassword(
  ciphertext?: string | null
): string | null {
  if (!ciphertext || !ciphertext.startsWith(`${PASSWORD_CIPHER_PREFIX}:`)) {
    return null;
  }

  const [, encodedIv, encodedAuthTag, encodedPayload] = ciphertext.split(':');

  if (!encodedIv || !encodedAuthTag || !encodedPayload) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      getPasswordEncryptionKey(),
      fromBase64Url(encodedIv)
    );
    decipher.setAuthTag(fromBase64Url(encodedAuthTag));

    const decrypted = Buffer.concat([
      decipher.update(fromBase64Url(encodedPayload)),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (_error) {
    return null;
  }
}

export function parseManagedAccountStorage(
  value: string | null | undefined
): AccountStoragePayload {
  if (!value) {
    return {
      wealthEntries: [],
      passwordCiphertext: null
    };
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        wealthEntries: [],
        passwordCiphertext: null
      };
    }

    const passwordCiphertext =
      typeof parsed[PASSWORD_STORAGE_KEY] === 'string'
        ? parsed[PASSWORD_STORAGE_KEY]
        : null;

    const wealthEntries = Object.entries(parsed)
      .filter(
        ([key, entryValue]) =>
          key !== PASSWORD_STORAGE_KEY &&
          key.trim() &&
          typeof entryValue === 'string' &&
          entryValue.trim()
      )
      .map(([key, entryValue]) => ({
        key,
        value: String(entryValue)
      }));

    return {
      wealthEntries,
      passwordCiphertext
    };
  } catch (_error) {
    return {
      wealthEntries: [],
      passwordCiphertext: null
    };
  }
}

export function buildManagedAccountStorage(
  entries: ManagedWealthEntry[],
  options?: {
    passwordCiphertext?: string | null;
  }
) {
  const valueMap: Record<string, string> = {};

  entries.forEach((entry) => {
    const key = entry.key.trim();
    const value = entry.value.trim();

    if (!key || !value) {
      return;
    }

    if (key in valueMap) {
      throw new Error(`财富字段标题“${key}”重复，请调整后再保存。`);
    }

    valueMap[key] = value;
  });

  if (options?.passwordCiphertext) {
    valueMap[PASSWORD_STORAGE_KEY] = options.passwordCiphertext;
  }

  return Object.keys(valueMap).length ? JSON.stringify(valueMap) : null;
}
