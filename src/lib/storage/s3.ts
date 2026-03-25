import { S3Client } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';

let client: S3Client | null = null;

export function getS3Client() {
  if (
    !env.storage.enabled ||
    !env.storage.region ||
    !env.storage.bucket ||
    !env.storage.accessKeyId ||
    !env.storage.secretAccessKey
  ) {
    return null;
  }

  if (!client) {
    client = new S3Client({
      region: env.storage.region,
      endpoint: env.storage.endpoint,
      credentials: {
        accessKeyId: env.storage.accessKeyId,
        secretAccessKey: env.storage.secretAccessKey
      },
      forcePathStyle: Boolean(env.storage.endpoint)
    });
  }

  return client;
}

export function getS3PublicUrl(path: string): string | null {
  if (!env.storage.publicBaseUrl) {
    return null;
  }

  return `${env.storage.publicBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
