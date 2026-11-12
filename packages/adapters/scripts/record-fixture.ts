/**
 * Enregistre une fiche produit comme fixture de test.
 *
 *   pnpm fixtures:record <url> <nom>          # HTTP simple
 *   pnpm fixtures:record <url> <nom> --browser # via Chromium (Playwright)
 *
 * Écrit test/fixtures/<nom>.html (élaguée, versionnée) et test/fixtures/raw/<nom>.html (ignorée par git).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PoliteFetcher } from '../src/fetcher';
import { getAdapterForUrl } from '../src/registry';
import { trimHtml } from './trim';

const [url, name] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const useBrowser = process.argv.includes('--browser');
// Classes CSS hachées (styled-components) inutiles pour les parseurs : --strip-classes pour alléger.
const stripClasses = process.argv.includes('--strip-classes');

if (!url || !name) {
  console.error('Usage : pnpm fixtures:record <url> <nom> [--browser] [--strip-classes]');
  process.exit(1);
}

const fixturesDir = path.resolve(import.meta.dirname, '../test/fixtures');
const userAgent =
  process.env.SCRAPER_USER_AGENT ??
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const browser = useBrowser ? new (await import('../src/browser')).PlaywrightRenderer() : undefined;
const fetcher = new PoliteFetcher({
  userAgent,
  timeoutMs: 30_000,
  minDelayMs: 0,
  maxDelayMs: 0,
  browser,
});

try {
  const html = await fetcher.fetchHtml(url, { browser: useBrowser });
  await mkdir(path.join(fixturesDir, 'raw'), { recursive: true });
  await writeFile(path.join(fixturesDir, 'raw', `${name}.html`), html);
  const trimmed = trimHtml(html, { stripClasses });
  await writeFile(path.join(fixturesDir, `${name}.html`), trimmed);

  const adapter = getAdapterForUrl(url);
  console.log(
    `Fixture enregistrée (${(trimmed.length / 1024).toFixed(0)} Ko) — adaptateur « ${adapter.key} » :`,
  );
  console.log(adapter.parse(trimmed, url));
} finally {
  await browser?.close();
}
