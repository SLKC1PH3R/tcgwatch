import path from 'node:path';
import type { NextConfig } from 'next';

const monorepoRoot = path.join(import.meta.dirname, '../..');

const nextConfig: NextConfig = {
  // Image Docker minimale : .next/standalone contient un serveur Node autonome.
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  // Packages du monorepo publiés en TypeScript source.
  transpilePackages: ['@tcgwatch/adapters', '@tcgwatch/db', '@tcgwatch/market', '@tcgwatch/shared'],
  serverExternalPackages: ['pino', 'pg', '@prisma/client', '@prisma/adapter-pg', 'playwright'],
  poweredByHeader: false,
  experimental: {
    // Upload des photos de collection via Server Actions.
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    // Images distantes (revendeurs, TCGdex) affichées telles quelles, sans optimisation serveur.
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
