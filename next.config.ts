import type { NextConfig } from 'next';

const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = [
  {
    protocol: 'https',
    hostname: 'api.slingacademy.com',
    pathname: '/**'
  },
  {
    protocol: 'https',
    hostname: 'avatars.githubusercontent.com',
    pathname: '/**'
  }
];

if (process.env.S3_PUBLIC_BASE_URL) {
  try {
    const url = new URL(process.env.S3_PUBLIC_BASE_URL);
    remotePatterns.push({
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
      hostname: url.hostname,
      port: url.port,
      pathname: `${url.pathname.replace(/\/$/, '') || ''}/**`
    });
  } catch {
    console.warn(
      'Ignoring invalid S3_PUBLIC_BASE_URL while building image config.'
    );
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns
  }
};

export default nextConfig;
