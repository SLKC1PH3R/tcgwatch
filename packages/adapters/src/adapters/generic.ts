import { load } from 'cheerio';
import { mergeResults, parseJsonLdFrom, parseOpenGraph } from '../jsonld';
import { parsePrestaShop } from '../prestashop';
import {
  availabilityFromText,
  findReleaseDate,
  findStockAlertUrl,
  visibleText,
} from '../heuristics';
import type { ListingResult, RetailerAdapter } from '../types';

/**
 * Adaptateur générique : JSON-LD schema.org Product/Offer, puis structure PrestaShop
 * (très courante chez les boutiques de jeux), puis OpenGraph, puis heuristiques textuelles.
 */
export function parseGeneric(html: string, url: string): ListingResult {
  const $ = load(html);
  const jsonLd = parseJsonLdFrom($, url);
  const prestashop = parsePrestaShop($);
  const og = parseOpenGraph($, url);
  const main = $('main').first().length ? $('main').first() : $('body');
  const text = visibleText($, main);

  const fallback: Partial<ListingResult> = {};
  if (!jsonLd.availability && !prestashop.availability)
    fallback.availability = availabilityFromText(text);
  const releaseDate = findReleaseDate(text);
  if (releaseDate) fallback.releaseDate = releaseDate;
  const stockAlertUrl = findStockAlertUrl($, main, url);
  if (stockAlertUrl) fallback.stockAlertUrl = stockAlertUrl;

  return mergeResults(jsonLd, prestashop, og, fallback);
}

export const genericAdapter: RetailerAdapter = {
  key: 'jsonld',
  name: 'Générique (JSON-LD)',
  domains: [],
  parse: parseGeneric,
  async fetchListing(url, ctx) {
    return parseGeneric(await ctx.fetchHtml(url), url);
  },
};
