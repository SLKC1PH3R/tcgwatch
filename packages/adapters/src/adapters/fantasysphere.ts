import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { parsePrice } from '@tcgwatch/shared';
import { parseGeneric } from './generic';
import { mergeResults } from '../jsonld';
import { availabilityFromText, findReleaseDate, visibleText } from '../heuristics';
import type { Availability, ListingResult, RetailerAdapter } from '../types';

/** Bloc affiché (Bootstrap : `d-none` masque l'élément). */
const shown = ($: CheerioAPI, scope: Cheerio<AnyNode>) =>
  scope.filter((_, el) => !$(el).hasClass('d-none'));

/**
 * Fantasy Sphere (fantasysphere.net) — pas de JSON-LD Product : prix dans la balise
 * `product:price:amount`, disponibilité dans le bloc « Livraison à domicile » où les deux
 * états (`.in-stock` « En stock », `.out-stock` « Indisponible ») sont présents, celui qui ne
 * s'applique pas étant masqué par `d-none`. Une précommande se lit dans le texte visible.
 */
export function parseFantasySphere(html: string, url: string): ListingResult {
  const $ = load(html);
  const infos = $('.infos-product').first();
  const visible = infos.clone();
  visible.find('.d-none').remove();
  const text = visibleText($, visible);

  let availability: Availability = 'UNKNOWN';
  if (shown($, infos.find('.in-stock')).length) availability = 'IN_STOCK';
  else if (shown($, infos.find('.out-stock')).length) availability = 'OUT_OF_STOCK';
  if (availability !== 'OUT_OF_STOCK' && availabilityFromText(text) === 'PREORDER') {
    availability = 'PREORDER';
  }

  const extra: Partial<ListingResult> = {};
  if (availability !== 'UNKNOWN') extra.availability = availability;
  const title = infos.find('h1.product-title').first().text().replace(/\s+/g, ' ').trim();
  if (title) extra.title = title;
  const price = parsePrice($('meta[property="product:price:amount"]').attr('content') ?? '');
  if (price) extra.price = price;
  const releaseDate = findReleaseDate(text);
  if (releaseDate) extra.releaseDate = releaseDate;

  return mergeResults(extra, parseGeneric(html, url));
}

export const fantasySphereAdapter: RetailerAdapter = {
  key: 'fantasysphere',
  name: 'Fantasy Sphere',
  domains: ['fantasysphere.net'],
  parse: parseFantasySphere,
  async fetchListing(url, ctx) {
    return parseFantasySphere(await ctx.fetchHtml(url), url);
  },
};
