import { defineConfig } from 'tsup';

/**
 * Bundle du worker : les packages du monorepo (@tcgwatch/*, TypeScript source) et leurs
 * dépendances pures JS (cheerio, zod…) sont inclus ; seules les dépendances déclarées dans
 * `dependencies` (Playwright, Prisma, pg, pino, node-cron) restent externes.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    // Seed exécutable en production : `node dist/seed.js [--if-empty]`
    seed: '../../packages/db/prisma/seed.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@tcgwatch\//],
  // Certaines dépendances bundlées utilisent require() : on fournit un require ESM.
  banner: {
    js: "import { createRequire as __tcgCreateRequire } from 'node:module'; const require = __tcgCreateRequire(import.meta.url);",
  },
});
