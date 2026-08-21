import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: [
    '@shoutout/ui',
    '@shoutout/shout-types',
    '@shoutout/match',
    '@shoutout/money',
    '@shoutout/intent',
    '@shoutout/db',
  ],
};

export default nextConfig;
