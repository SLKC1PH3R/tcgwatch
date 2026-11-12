import { load } from 'cheerio';
import { parsePrice } from '@tcgwatch/shared';
import { mergeResults, parseJsonLdFrom, parseOpenGraph } from '../jsonld';
import {
  availabilityFromText,
  findReleaseDate,
  findStockAlertUrl,
  pickScope,
  visibleText,
} from '../heuristics';
import type { ListingResult, RetailerAdapter } from '../types';

/**
 * Cultura (cultura.com).
 *
 * ⚠️ Le site est protégé par un anti-bot : les requêtes HTTP simples reçoivent un 403.
 * L'adaptateur passe donc par Chromium (Playwright), sans garantie de succès.
 * Les sélecteurs ci-dessous sont à valider sur une page réelle (`pnpm fixtures:record`).
 */
export function parseCultura(html: string, url: string): ListingResult {
  const $ = load(html);
  const jsonLd = parseJsonLdFrom($, url);
  const scope = pickScope($, [
    '[data-testid="product-buybox"]',
    '.product-buybox',
    '.product-main',
    'main',
  ]);

  const extra: Partial<ListingResult> = {};
  if (!jsonLd.availability) {
    const availability = availabilityFromText(
      visibleText($, scope.find('button, .availability, [class*="stock"]')),
    );
    if (availability !== 'UNKNOWN') extra.availability = availability;
  }
  if (jsonLd.price === undefined) {
    const p = parsePrice(scope.find('[itemprop="price"], [class*="price"]').first().text());
    if (p) extra.price = p;
  }
  const releaseDate = findReleaseDate(visibleText($, scope));
  if (releaseDate) extra.releaseDate = releaseDate;
  const stockAlertUrl = findStockAlertUrl($, scope, url);
  if (stockAlertUrl) extra.stockAlertUrl = stockAlertUrl;

  return mergeResults(jsonLd, extra, parseOpenGraph($, url));
}

export const culturaAdapter: RetailerAdapter = {
  key: 'cultura',
  name: 'Cultura',
  domains: ['cultura.com'],
  needsBrowser: true,
  parse: parseCultura,
  async fetchListing(url, ctx) {
    return parseCultura(await ctx.fetchHtml(url, { browser: true }), url);
  },
};
