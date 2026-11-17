import { load } from 'cheerio';
import { parsePrice } from '@tcgwatch/shared';
import { mergeResults, parseJsonLdFrom, parseOpenGraph } from '../jsonld';
import {
  availabilityFromText,
  findReleaseDate,
  findStockAlertUrl,
  visibleText,
} from '../heuristics';
import { AdapterError, type ListingResult, type RetailerAdapter } from '../types';

/**
 * Philibert (philibertnet.com) — PrestaShop.
 *
 * Le JSON-LD donne nom, prix et EAN mais PAS la disponibilité : elle est lue dans
 * le bloc `.product-actions` (bouton « Ajouter au panier » / « Précommander »,
 * badge « À venir : … » sans bouton = pas encore commandable).
 *
 * La page est servie depuis un cache : le bouton « Ajouter au panier » peut y rester alors que
 * le produit est épuisé. Le site vérifie ensuite le stock réel par un appel JSON
 * (`/fr/ajax/product/{id}/{déclinaison}/expedition_date`, `status: "out_of_stock"`), que
 * TCGWatch fait aussi : c'est lui qui fait foi.
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

/** Identifiants produit / déclinaison du bouton panier (`data-pid`, `data-paid`). */
export function philibertIds(html: string): { pid: string; paid: string } | null {
  const $ = load(html);
  const button = $('.product-actions__container [data-pid]').first();
  const pid = button.attr('data-pid') ?? $('#product-id').attr('value');
  if (!pid || !/^\d+$/.test(pid)) return null;
  const paid = button.attr('data-paid');
  return { pid, paid: paid && /^\d+$/.test(paid) ? paid : '0' };
}

/**
 * Applique la réponse de l'appel de stock (`expedition_date`) au relevé de la page.
 * Réponse illisible = erreur : mieux vaut un relevé en échec qu'un faux retour en stock.
 */
export function applyPhilibertStock(result: ListingResult, body: string): ListingResult {
  let data: { status?: unknown };
  try {
    const start = body.indexOf('{');
    data = JSON.parse(body.slice(start, body.lastIndexOf('}') + 1)) as { status?: unknown };
  } catch {
    throw new AdapterError('Philibert : réponse de stock illisible', 'PARSE');
  }
  if (data.status === 'out_of_stock') return { ...result, availability: 'OUT_OF_STOCK' };
  return result;
}

export const philibertAdapter: RetailerAdapter = {
  key: 'philibert',
  name: 'Philibert',
  domains: ['philibertnet.com'],
  parse: parsePhilibert,
  async fetchListing(url, ctx) {
    const html = await ctx.fetchHtml(url);
    const result = parsePhilibert(html, url);
    const ids = philibertIds(html);
    // Seul un produit annoncé commandable peut être un faux positif du cache.
    if (!ids || (result.availability !== 'IN_STOCK' && result.availability !== 'PREORDER')) {
      return result;
    }
    const locale = new URL(url).pathname.split('/')[1] || 'fr';
    const stockUrl = new URL(
      `/${locale}/ajax/product/${ids.pid}/${ids.paid}/expedition_date`,
      url,
    ).toString();
    return applyPhilibertStock(result, await ctx.fetchHtml(stockUrl));
  },
};
