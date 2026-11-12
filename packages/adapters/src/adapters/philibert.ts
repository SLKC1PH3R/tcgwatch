import { load } from 'cheerio';
import { parsePrice } from '@tcgwatch/shared';
import { mergeResults, parseJsonLdFrom, parseOpenGraph } from '../jsonld';
import {
  availabilityFromText,
  findReleaseDate,
  findStockAlertUrl,
  visibleText,
} from '../heuristics';
import type { ListingResult, RetailerAdapter } from '../types';

/**
 * Philibert (philibertnet.com) — PrestaShop.
 *
 * Le JSON-LD donne nom, prix et EAN mais PAS la disponibilité : elle est lue dans
 * le bloc `.product-actions` (bouton « Ajouter au panier » / « Précommander »,
 * badge « À venir : … » sans bouton = pas encore commandable).
 */
export function parsePhilibert(html: string, url: string): ListingResult {
  const $ = load(html);
  const jsonLd = parseJsonLdFrom($, url);
  const actions = $('.product-actions__container').first();

  const extra: Partial<ListingResult> = {};
  if (actions.length) {
    const buttons = visibleText($, actions.find('.product-actions__add-to-cart, button'));
    const labels = visibleText($, actions.find('.product-actions__labels'));
    let availability = availabilityFromText(buttons);
    if (availability === 'UNKNOWN') availability = availabilityFromText(labels);
    if (availability !== 'UNKNOWN') extra.availability = availability;

    const shownPrice = parsePrice(actions.find('#price-container .price').first().text());
    if (availability === 'OUT_OF_STOCK' && !shownPrice) {
      // « À venir » : le prix du JSON-LD n'est pas encore pratiqué.
      extra.price = null;
    } else if (shownPrice) {
      extra.price = shownPrice;
    }

    const releaseDate = findReleaseDate(visibleText($, actions));
    if (releaseDate) extra.releaseDate = releaseDate;
    const stockAlertUrl = findStockAlertUrl($, actions, url);
    if (stockAlertUrl) extra.stockAlertUrl = stockAlertUrl;
  }

  return mergeResults(extra, jsonLd, parseOpenGraph($, url));
}

export const philibertAdapter: RetailerAdapter = {
  key: 'philibert',
  name: 'Philibert',
  domains: ['philibertnet.com'],
  parse: parsePhilibert,
  async fetchListing(url, ctx) {
    return parsePhilibert(await ctx.fetchHtml(url), url);
  },
};
