import { defineConfig } from '@playwright/test';

/**
 * Tests de bout en bout : parcours de pages sur l'app construite (`next build` au préalable),
 * avec une base PostgreSQL migrée (DATABASE_URL). Le jeu de données de test est posé par
 * e2e/global-setup.ts.
 */
const port = Number(process.env.E2E_PORT ?? 3200);

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    // Chromium déjà installé ailleurs (poste de dev) : chemin explicite.
    launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH || undefined },
  },
  webServer: {
    command: `pnpm start -p ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
