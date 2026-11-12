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
 * Smyths Toys (smythstoys.com/fr/fr-fr) — SAP Commerce.
 *
 * ⚠️ Protégé par Imperva/Incapsula : les requêtes HTTP simples reçoivent une page de défi.
 * L'adaptateur passe par Chromium (Playwright), sans garantie de succès.
 * La disponibilité « livraison à domicile » est prioritaire sur le retrait en magasin.
 */
export function parseSmyths(html: string, url: string): ListingResult {
  const $ = load(html);
  const jsonLd = parseJsonLdFrom($, url);
  const scope = pickScope($, ['.product-main-info', '.product-details', '#addToCartForm', 'main']);

  const extra: Partial<ListingResult> = {};
  if (!jsonLd.availability) {
    const delivery = scope.find(
      '[class*="delivery"], [class*="home-delivery"], #addToCartButton, button',
    );
    const availability = availabilityFromText(visibleText($, delivery));
    if (availability !== 'UNKNOWN') extra.availability = availability;
  }
  if (jsonLd.price === undefined) {
    const p = parsePrice(scope.find('[itemprop="price"], .price, [class*="price"]').first().text());
    if (p) extra.price = p;
  }
  const releaseDate = findReleaseDate(visibleText($, scope));
  if (releaseDate) extra.releaseDate = releaseDate;
  const stockAlertUrl = findStockAlertUrl($, scope, url);
  if (stockAlertUrl) extra.stockAlertUrl = stockAlertUrl;

  return mergeResults(jsonLd, extra, parseOpenGraph($, url));
}

export const smythsAdapter: RetailerAdapter = {
  key: 'smyths',
  name: 'Smyths Toys',
  domains: ['smythstoys.com'],
  needsBrowser: true,
  parse: parseSmyths,
  async fetchListing(url, ctx) {
    return parseSmyths(await ctx.fetchHtml(url, { browser: true }), url);
  },
};
