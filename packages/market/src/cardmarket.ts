import { todayUtc } from '@tcgwatch/shared';
import { z } from 'zod';
import type { MarketPriceProvider, MarketQuote, ProductRef } from './providers';

/**
 * Guide des prix Cardmarket, publié chaque jour par Cardmarket sous forme de fichier JSON
 * (tous les produits Pokémon, scellés compris) : aucune page du site n'est lue.
 * Valeurs de la page produit : « À partir de » (low), tendance, moyennes 1, 7 et 30 jours.
 * Le nombre d'articles en vente n'y figure pas, et les prix couvrent toutes les langues.
 * Le produit Cardmarket d'un produit local vient de CardNexus (`externalIds`).
 */
export const CARDMARKET_PRICE_GUIDE_URL =
  'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json';

/** Liste officielle des produits scellés Pokémon de Cardmarket (noms anglais, catégories). */
export const CARDMARKET_PRODUCTS_URL =
  'https://downloads.s3.cardmarket.com/productCatalog/productList/products_nonsingles_6.json';

const productSchema = z
  .object({
    idProduct: z.number(),
    name: z.string(),
    categoryName: z.string().nullish(),
    dateAdded: z.string().nullish(),
  })
  .passthrough();
const productsSchema = z.object({ products: z.array(productSchema) });
export type CardmarketProduct = z.infer<typeof productSchema>;

/** Écart maximal entre la sortie d'un produit et son ajout sur Cardmarket. */
const MAX_DATE_GAP_MS = 400 * 86_400_000;
const years = (s: string) => new Set(s.match(/\b20\d\d\b/g) ?? []);
const isBundle = (s: string) => /\bbundle\b|lot de (?:6 )?boosters|lot de 6/i.test(s);
const isHalf = (s: string) => /\bdemi\b|demi-|half|\(18 boosters?\)/i.test(s);

/**
 * Le produit Cardmarket donné par CardNexus est-il plausible pour ce produit local ? Contrôles
 * prudents (un doute = pas de prix) : même format (lot de boosters, demi-display, booster seul,
 * display, ETB, tripack, deck), même année citée, date d'ajout sur Cardmarket proche de la
 * sortie du produit.
 */
export function plausibleCardmarketMatch(
  local: { name: string; type?: string; releaseDate?: Date | null },
  cm: CardmarketProduct,
): boolean {
  const name = cm.name;
  const category = cm.categoryName ?? '';

  const added = cm.dateAdded ? Date.parse(cm.dateAdded.replace(' ', 'T') + 'Z') : NaN;
  if (local.releaseDate && Number.isFinite(added) && new Date(added).getUTCFullYear() >= 2010) {
    if (Math.abs(local.releaseDate.getTime() - added) > MAX_DATE_GAP_MS) return false;
  }
  const ours = years(local.name);
  const theirs = years(name);
  if (ours.size > 0 && ![...ours].some((y) => theirs.has(y))) return false;
  if (ours.size === 0 && theirs.size > 0 && local.releaseDate) {
    if (!theirs.has(String(local.releaseDate.getUTCFullYear()))) return false;
  }

  if (isBundle(local.name) !== isBundle(name)) return false;
  // « Booster Bundle Display » : carton de plusieurs lots, pas un lot de boosters.
  if (isBundle(name) && /display|case/i.test(name)) return false;
  switch (local.type) {
    case 'DISPLAY':
      if (!/booster box|display/i.test(name)) return false;
      if (isHalf(local.name) !== isHalf(name)) return false;
      break;
    case 'ETB':
      if (!/elite trainer box/i.test(name)) return false;
      break;
    case 'TRIPACK':
      if (!/3-pack/i.test(name)) return false;
      break;
    case 'BOOSTER':
      if (!isBundle(local.name)) {
        if (!/booster$/i.test(category) || /fun pack|box|bundle|display/i.test(name)) return false;
      }
      break;
    case 'DECK':
      if (!/deck/i.test(name)) return false;
      break;
  }
  return true;
}

const num = z.number().nullish();
const guideEntry = z
  .object({
    idProduct: z.number(),
    avg: num,
    low: num,
    trend: num,
    avg1: num,
    avg7: num,
    avg30: num,
  })
  .passthrough();
const guideSchema = z.object({
  createdAt: z.string().optional(),
  priceGuides: z.array(guideEntry),
});
export type CardmarketGuideEntry = z.infer<typeof guideEntry>;

const positive = (v: number | null | undefined) =>
  typeof v === 'number' && v > 0 ? Math.round(v * 100) / 100 : null;

/**
 * Cotation d'un produit du guide : prix affiché = tendance, sinon moyenne, sinon prix le plus
 * bas. Un « à partir de » démesuré (annonce à 100 000 € posée pour bloquer un produit) est
 * écarté quand il dépasse trois fois la tendance.
 */
export function quoteFromGuide(e: CardmarketGuideEntry) {
  const trend = positive(e.trend);
  const avg = positive(e.avg);
  let low = positive(e.low);
  const ref = trend ?? avg;
  if (low !== null && ref !== null && low > ref * 3) low = null;
  const price = trend ?? avg ?? low;
  if (price === null) return null;
  return {
    price,
    low,
    trend,
    avg1: positive(e.avg1),
    avg7: positive(e.avg7),
    avg30: positive(e.avg30),
  };
}

export class CardmarketGuideProvider implements MarketPriceProvider {
  readonly key = 'cardmarket';
  readonly label = 'Cardmarket (guide des prix officiel)';

  constructor(
    private readonly enabled = true,
    private readonly url = CARDMARKET_PRICE_GUIDE_URL,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly productsUrl = CARDMARKET_PRODUCTS_URL,
  ) {}

  /** Produits écartés au dernier relevé (lien CardNexus jugé faux). */
  rejected = 0;

  async productList(): Promise<Map<number, CardmarketProduct>> {
    const res = await this.fetchImpl(this.productsUrl, {
      headers: { accept: 'application/json', 'user-agent': 'TCGWatch (self-hosted)' },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`Produits Cardmarket : HTTP ${res.status}`);
    const body = productsSchema.parse(await res.json());
    return new Map(body.products.map((p) => [p.idProduct, p]));
  }

  isEnabled() {
    return this.enabled;
  }

  async priceGuide(): Promise<Map<number, CardmarketGuideEntry>> {
    const res = await this.fetchImpl(this.url, {
      headers: { accept: 'application/json', 'user-agent': 'TCGWatch (self-hosted)' },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`Guide des prix Cardmarket : HTTP ${res.status}`);
    const body = guideSchema.parse(await res.json());
    return new Map(body.priceGuides.map((e) => [e.idProduct, e]));
  }

  async fetchQuotes(products: ProductRef[]): Promise<MarketQuote[]> {
    const linked = products.filter((p) => p.cardmarketId);
    if (!this.isEnabled() || linked.length === 0) return [];
    const [guide, list] = await Promise.all([this.priceGuide(), this.productList()]);
    const date = todayUtc();
    this.rejected = 0;
    return linked.flatMap((p): MarketQuote[] => {
      const cm = list.get(p.cardmarketId!);
      if (!cm || !plausibleCardmarketMatch(p, cm)) {
        this.rejected++;
        return [];
      }
      const entry = guide.get(p.cardmarketId!);
      const q = entry ? quoteFromGuide(entry) : null;
      return q ? [{ productId: p.id, source: this.key, currency: 'EUR', date, ...q }] : [];
    });
  }
}
