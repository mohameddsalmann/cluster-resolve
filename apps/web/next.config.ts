import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cluster/core', '@cluster/schemas', '@cluster/design-tokens'],
  typedRoutes: true,
};

export default nextConfig;
