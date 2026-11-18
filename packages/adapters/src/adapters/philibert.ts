import { load } from 'cheerio';
import { parsePrice } from '@tcgwatch/shared';
import { mergeResults, parseJsonLdFrom, parseOpenGraph } from '../jsonld';
import {
  availabilityFromText,
  findReleaseDate,
  findStockAlertUrl,
  visibleText,
} from '../heuristics';
import {
  AdapterError,
  type FetchContext,
  type ListingResult,
  type RetailerAdapter,
} from '../types';

/**
 * Philibert (philibertnet.com) — PrestaShop.
 *
 * Le JSON-LD donne nom, prix et EAN mais PAS la disponibilité : elle est lue dans
 * le bloc `.product-actions` (bouton « Ajouter au panier » / « Précommander »,
 * badge « À venir : … » sans bouton = pas encore commandable).
 *
 * La page est servie depuis un cache : le bouton « Ajouter au panier » peut y rester alors que
 * le produit est épuisé. Le site vérifie ensuite le stock réel par un appel JSON
 * (`/fr/ajax/product/{id}/{déclinaison}/expedition_date`, `status: "out_of_stock"`).
 * TCGWatch confirme donc un produit « commandable » par le rayon filtré « en stock » (une
 * requête par passage pour toutes les fiches), puis, s'il n'y figure pas, par cet appel.
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

/** Rayon Pokémon filtré « français » et « en stock » (commandable, précommandes comprises). */
export const PHILIBERT_STOCK_URL =
  'https://www.philibertnet.com/fr/212-pokemon/s-3/langues-francais/en_stock-oui';
const STOCK_LIST_TTL_MS = 5 * 60_000;
const STOCK_LIST_MAX_PAGES = 10;

/** Identifiants des produits listés sur une page du rayon, et lien vers la page suivante. */
export function parsePhilibertStockList(
  html: string,
  page: number,
): { ids: string[]; hasNext: boolean } {
  const $ = load(html);
  const list = $('#product-list');
  if (!list.length) throw new AdapterError('Philibert : liste « en stock » introuvable', 'PARSE');
  const ids = new Set<string>();
  list.find('a[href]').each((_, a) => {
    const id = /\/(\d+)-[^/]+\.html(?:$|[?#])/.exec($(a).attr('href') ?? '')?.[1];
    if (id) ids.add(id);
  });
  const hasNext = $(`a[href*="?p=${page + 1}"]`).length > 0;
  return { ids: [...ids], hasNext };
}

let stockList: { at: number; ids: Set<string> } | null = null;

/** Produits en stock du rayon (mis en cache quelques minutes : une lecture par passage). */
async function inStockIds(ctx: FetchContext): Promise<Set<string> | null> {
  if (stockList && Date.now() - stockList.at < STOCK_LIST_TTL_MS) return stockList.ids;
  try {
    const ids = new Set<string>();
    for (let page = 1; page <= STOCK_LIST_MAX_PAGES; page++) {
      const html = await ctx.fetchHtml(
        page === 1 ? PHILIBERT_STOCK_URL : `${PHILIBERT_STOCK_URL}?p=${page}`,
      );
      const parsed = parsePhilibertStockList(html, page);
      parsed.ids.forEach((id) => ids.add(id));
      if (!parsed.hasNext) break;
    }
    stockList = { at: Date.now(), ids };
    return ids;
  } catch {
    return null;
  }
}

/** Pour les tests : oublie la liste en cache. */
export function resetPhilibertStockList() {
  stockList = null;
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
    // 1. Rayon « en stock » : une requête pour toutes les fiches Philibert du passage.
    const listed = await inStockIds(ctx);
    if (listed?.has(ids.pid)) return result;
    // 2. Absent du rayon (ou rayon illisible) : stock réel de la fiche, comme le fait le site.
    const locale = new URL(url).pathname.split('/')[1] || 'fr';
    const stockUrl = new URL(
      `/${locale}/ajax/product/${ids.pid}/${ids.paid}/expedition_date`,
      url,
    ).toString();
    try {
      return applyPhilibertStock(result, await ctx.fetchHtml(stockUrl));
    } catch (err) {
      // Le rayon dit « pas en stock » : on le croit plutôt que le bouton d'une page en cache.
      if (listed) return { ...result, availability: 'OUT_OF_STOCK' };
      throw err;
    }
  },
};
