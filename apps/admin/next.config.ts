import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@shoutout/ui', '@shoutout/shout-types', '@shoutout/money', '@shoutout/db'],
};

export default nextConfig;
