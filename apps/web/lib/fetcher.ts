import 'server-only';
import { PoliteFetcher } from '@tcgwatch/adapters';
import { getEnv } from '@tcgwatch/shared/env';

let fetcher: PoliteFetcher | undefined;

/**
 * Client HTTP poli utilisé pour le test immédiat d'une URL (sans Chromium côté web :
 * les sites qui l'exigent seront relevés par le worker).
 */
export function getWebFetcher(): PoliteFetcher {
  if (!fetcher) {
    const env = getEnv();
    fetcher = new PoliteFetcher({
      userAgent: env.SCRAPER_USER_AGENT,
      timeoutMs: env.SCRAPER_TIMEOUT_MS,
      minDelayMs: env.SCRAPER_MIN_DELAY_MS,
      maxDelayMs: env.SCRAPER_MAX_DELAY_MS,
    });
  }
  return fetcher;
}
