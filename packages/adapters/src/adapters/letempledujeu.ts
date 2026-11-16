import { load } from 'cheerio';
import { parsePrice } from '@tcgwatch/shared';
import { parseGeneric } from './generic';
import { mergeResults } from '../jsonld';
import { availabilityFromText, findReleaseDate, visibleText } from '../heuristics';
import type { Availability, ListingResult, RetailerAdapter } from '../types';

/** Article vendu seulement en magasin : non achetable en ligne. */
const STORE_ONLY = /ne peut pas [êe]tre exp[ée]di[ée]|uniquement en boutique/i;

/**
 * Le Temple du Jeu (letempledujeu.fr) — site SPIP sans données structurées de prix : prix
 * dans `.jeu_prix` du bloc panier `.anto_blocpanier`, mention « cet article est en stock »
 * (`.enstock-big`) ou « ne peut pas être expédié par correspondance » (vente en boutique
 * seulement, comptée comme indisponible en ligne).
 */
export function parseLeTempleDuJeu(html: string, url: string): ListingResult {
  const $ = load(html);
  const block = $('.anto_blocpanier').first();
  const text = visibleText($, block);

  let availability: Availability = 'UNKNOWN';
  if (STORE_ONLY.test(text)) availability = 'OUT_OF_STOCK';
  else {
    const fromText = availabilityFromText(text);
    if (fromText !== 'UNKNOWN') availability = fromText;
    else if (block.find('.enstock-big').length) availability = 'IN_STOCK';
  }

  const extra: Partial<ListingResult> = {};
  if (availability !== 'UNKNOWN') extra.availability = availability;
  const title = $('h1.jeu_titre').first().text().replace(/\s+/g, ' ').trim();
  if (title) extra.title = title;
  const price = parsePrice(block.find('.jeu_prix').first().text());
  if (price) {
    extra.price = price;
    extra.currency = 'EUR';
  }
  const releaseDate = findReleaseDate(visibleText($, $('.designation').first()));
  if (releaseDate) extra.releaseDate = releaseDate;

  return mergeResults(extra, parseGeneric(html, url));
}

export const leTempleDuJeuAdapter: RetailerAdapter = {
  key: 'letempledujeu',
  name: 'Le Temple du Jeu',
  domains: ['letempledujeu.fr'],
  parse: parseLeTempleDuJeu,
  async fetchListing(url, ctx) {
    return parseLeTempleDuJeu(await ctx.fetchHtml(url), url);
  },
};
