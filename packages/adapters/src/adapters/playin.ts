import { load } from 'cheerio';
import { mergeResults, parseJsonLdFrom, parseOpenGraph } from '../jsonld';
import { findReleaseDate, findStockAlertUrl, visibleText } from '../heuristics';
import type { ListingResult, RetailerAdapter } from '../types';

/**
 * Play-In (play-in.com) — Next.js rendu côté serveur.
 *
 * - Le JSON-LD Product/Offer est fiable pour le prix et la disponibilité ;
 *   un prix à 0 signifie que le produit n'est pas encore en vente.
 * - La date « Sortie prévue le JJ/MM/AAAA » n'est présente que dans le HTML.
 * - Les carrousels « produits similaires » contiennent d'autres prix et boutons :
 *   on ne lit donc jamais la disponibilité depuis le texte de la page.
 */
export function parsePlayIn(html: string, url: string): ListingResult {
  const $ = load(html);
  const jsonLd = parseJsonLdFrom($, url);
  const body = $('body');

  const extra: Partial<ListingResult> = {};
  // Première occurrence = fiche du produit principal (avant les carrousels).
  // « Sortie prévue le JJ/MM/AAAA » (à venir) ou « Sortie le JJ/MM/AAAA » (déjà sorti).
  const dateNode = $('p, span, div')
    .filter(
      (_, el) =>
        /sortie (?:pr[ée]vue )?le \d/i.test($(el).text()) && $(el).children('p, div').length === 0,
    )
    .first();
  const releaseDate = findReleaseDate(dateNode.length ? dateNode.text() : visibleText($, body));
  if (releaseDate) extra.releaseDate = releaseDate;

  const stockAlertUrl = findStockAlertUrl($, body, url);
  if (stockAlertUrl) extra.stockAlertUrl = stockAlertUrl;

  return mergeResults(jsonLd, extra, parseOpenGraph($, url));
}

export const playInAdapter: RetailerAdapter = {
  key: 'playin',
  name: 'Play-In',
  domains: ['play-in.com'],
  parse: parsePlayIn,
  async fetchListing(url, ctx) {
    return parsePlayIn(await ctx.fetchHtml(url), url);
  },
};
