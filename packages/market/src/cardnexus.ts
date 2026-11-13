import { guessProductType, todayUtc } from '@tcgwatch/shared';
import { z } from 'zod';
import { matchProduct, type CatalogProduct } from './matching';
import type { MarketPriceProvider, MarketQuote, ProductRef } from './providers';

/**
 * CardNexus (https://docs.cardnexus.com) : marketplace française de cartes, API publique
 * officielle et gratuite (clé créée dans Réglages → API de son compte CardNexus).
 * Aucun scraping : leurs CGU l'interdisent, l'API est la voie prévue.
 *
 * Sans permission particulière, l'API donne les annonces en ligne sur CardNexus par langue :
 * on retient la moins chère des annonces en FRANÇAIS, région Europe (prix de revente actuel
 * d'un produit FR). Les valeurs Cardmarket et l'historique demandent une permission accordée
 * par CardNexus sur demande ; elles ne distinguent pas la langue, donc on ne s'en sert pas.
 *
 * Le catalogue scellé Pokémon est lu en entier (noms en français, 200 produits par appel),
 * puis rapproché du catalogue local avec le même algorithme prudent que les revendeurs.
 */
export class CardNexusProvider implements MarketPriceProvider {
  readonly key = 'cardnexus';
  readonly label = 'CardNexus (annonces FR)';
  /** Limite globale CardNexus : 60 requêtes/minute ; on reste large. */
  static readonly MAX_PAGES = 40;
  /**
   * Médiane : une recherche d'annonces par produit (quota « listing-search » de 600/heure).
   * Seulement pour les produits avec assez d'annonces FR, dans la limite de ce plafond.
   */
  static readonly MEDIAN_MAX_PRODUCTS = 150;
  static readonly MEDIAN_MIN_LISTINGS = 3;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl = 'https://public-api.cardnexus.com',
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly pauseMs = 1_100,
    /** 600 recherches d'annonces par heure : une toutes les 6,1 s. */
    private readonly listingPauseMs = 6_100,
  ) {}

  isEnabled() {
    return Boolean(this.apiKey);
  }

  /** Tous les produits scellés Pokémon, noms en français quand une traduction existe. */
  async sealedCatalog(): Promise<CardNexusSealed[]> {
    const all: CardNexusSealed[] = [];
    for (let page = 0; page < CardNexusProvider.MAX_PAGES; page++) {
      if (page > 0) await new Promise((r) => setTimeout(r, this.pauseMs));
      const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/v1/products/search`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'accept-language': 'fr',
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          gameFilters: { game: 'pokemon' },
          productType: { op: 'or', values: ['sealed'] },
          limit: 200,
          offset: page * 200,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`CardNexus /products/search : HTTP ${res.status}`);
      const body = searchSchema.parse(await res.json());
      all.push(...body.data);
      if (!body.pagination.hasMore || body.data.length === 0) break;
    }
    return all;
  }

  async fetchQuotes(products: ProductRef[]): Promise<MarketQuote[]> {
    if (!this.isEnabled() || products.length === 0) return [];
    const catalog = products
      .filter((p) => p.type)
      .map((p) => ({ id: p.id, name: p.name, type: p.type! }));
    const date = todayUtc();
    const matched = quotesFromCatalog(await this.sealedCatalog(), catalog);

    // Médiane des annonces FR, pour les produits les plus fournis d'abord.
    const medians = new Map<number, number | null>();
    const eligible = matched
      .filter((q) => (q.listingCount ?? 0) >= CardNexusProvider.MEDIAN_MIN_LISTINGS)
      .sort((a, b) => (b.listingCount ?? 0) - (a.listingCount ?? 0))
      .slice(0, CardNexusProvider.MEDIAN_MAX_PRODUCTS);
    for (const [i, q] of eligible.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, this.listingPauseMs));
      try {
        medians.set(q.cardnexusId, medianPrice(await this.frenchListings(q.cardnexusId)));
      } catch {
        // Quota atteint ou recherche indisponible : la médiane reste vide pour la suite.
        break;
      }
    }

    return matched.map(({ cardnexusId, ...q }) => ({
      ...q,
      median: medians.get(cardnexusId) ?? null,
      source: this.key,
      currency: 'EUR',
      date,
    }));
  }

  /** Annonces scellées en français d'un produit, livrables en France (100 premières, par prix). */
  async frenchListings(cardnexusId: number): Promise<CardNexusListing[]> {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/v1/listings/search`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        productIds: [cardnexusId],
        language: ['fr'],
        graded: false,
        deliveryCountry: 'FR',
        sortBy: 'price',
        limit: 100,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`CardNexus /listings/search : HTTP ${res.status}`);
    return listingsSchema.parse(await res.json()).data;
  }
}

/**
 * Médiane des prix unitaires des annonces FR en euros (hors port), ou null s'il y en a
 * moins de MEDIAN_MIN_LISTINGS.
 */
export function medianPrice(listings: CardNexusListing[]): number | null {
  const prices = listings
    .filter(
      (l) => l.price.currency === 'EUR' && l.price.amount > 0 && (l.language ?? 'fr') === 'fr',
    )
    .map((l) => l.price.amount)
    .sort((a, b) => a - b);
  if (prices.length < CardNexusProvider.MEDIAN_MIN_LISTINGS) return null;
  const mid = Math.floor(prices.length / 2);
  const m = prices.length % 2 ? prices[mid]! : (prices[mid - 1]! + prices[mid]!) / 2;
  return Math.round(m * 100) / 100;
}

/** Catégorie CardNexus → libellé FR, quand le nom seul ne dit pas le type de produit. */
const CATEGORY_LABEL: Record<string, string> = {
  booster: 'Booster',
  booster_box: 'Display',
  elite_trainer_box: 'Coffret Dresseur d’élite',
  booster_bundle: 'Lot de boosters',
  bundle: 'Lot de boosters',
  premium_collection: 'Coffret',
  box_set: 'Coffret',
  ex_box: 'Coffret',
  gift_set: 'Coffret',
  tin: 'Pokébox',
  mini_tin: 'Mini Tin',
  blister: 'Blister',
  deck: 'Deck',
  starter_deck: 'Deck',
  theme_deck: 'Deck',
};

/** Caisses de plusieurs boîtes, kits d'avant-première… : jamais dans le catalogue FR. */
const SKIPPED = /_case$|^(?:deck_display|prerelease_kit|kit|redemption_box|promo_pack|other)$/;

/** Intitulé à rapprocher : nom FR, complété du type et de l'extension s'ils manquent. */
export function cardNexusTitle(p: CardNexusSealed): string | null {
  const category = p.productCategory ?? '';
  if (SKIPPED.test(category)) return null;
  let title = p.name;
  if (guessProductType(title) === 'AUTRE') {
    const label = CATEGORY_LABEL[category];
    if (!label) return null;
    title = `${label} ${title}`;
  }
  const set = p.expansion?.name;
  return set && !title.toLowerCase().includes(set.toLowerCase()) ? `${title} ${set}` : title;
}

/** Annonce FR la moins chère en Europe, tous états confondus (scellé), ou null. */
export function frenchListingPrice(p: CardNexusSealed): number | null {
  const conditions = p.prices?.cardnexus?.regions?.eu?.byCondition ?? {};
  const lows = Object.values(conditions)
    .map((c) => c.byLanguage?.fr)
    .filter((fr): fr is { low: number; listingCount?: number } => !!fr && fr.low > 0)
    .map((fr) => fr.low);
  return lows.length ? Math.round(Math.min(...lows) * 100) / 100 : null;
}

/** Nombre d'annonces FR en Europe, tous états confondus, si CardNexus le fournit. */
export function frenchListingCount(p: CardNexusSealed): number | null {
  const conditions = p.prices?.cardnexus?.regions?.eu?.byCondition ?? {};
  const counts = Object.values(conditions)
    .map((c) => c.byLanguage?.fr?.listingCount)
    .filter((n): n is number => typeof n === 'number');
  return counts.length ? counts.reduce((a, b) => a + b, 0) : null;
}

export interface CatalogQuote {
  productId: string;
  cardnexusId: number;
  price: number;
  listingCount: number | null;
}

/**
 * Rapproche le catalogue CardNexus du catalogue local. Un produit local visé par plusieurs
 * produits CardNexus est écarté (ambiguïté) : pas de prix plutôt qu'un mauvais prix.
 */
export function quotesFromCatalog(
  sealed: CardNexusSealed[],
  catalog: CatalogProduct[],
): CatalogQuote[] {
  const hits = new Map<string, Omit<CatalogQuote, 'productId'>[]>();
  for (const p of sealed) {
    if (p.languages && p.languages.length > 0 && !p.languages.includes('fr')) continue;
    const title = cardNexusTitle(p);
    if (!title) continue;
    const match = matchProduct(title, catalog);
    if (!match) continue;
    const price = frenchListingPrice(p);
    const list = hits.get(match.productId) ?? [];
    list.push({ cardnexusId: p.id, price: price ?? NaN, listingCount: frenchListingCount(p) });
    hits.set(match.productId, list);
  }
  const quotes: CatalogQuote[] = [];
  for (const [productId, found] of hits) {
    if (found.length === 1 && Number.isFinite(found[0]!.price))
      quotes.push({ productId, ...found[0]! });
  }
  return quotes;
}

const languagePrice = z.object({ low: z.number(), listingCount: z.number().optional() });
const sealedSchema = z.object({
  id: z.number(),
  name: z.string(),
  productCategory: z.string().nullish(),
  languages: z.array(z.string()).nullish(),
  expansion: z.object({ name: z.string() }).partial().nullish(),
  prices: z
    .object({
      cardnexus: z
        .object({
          regions: z
            .object({
              eu: z
                .object({
                  byCondition: z
                    .record(
                      z.string(),
                      z.object({ byLanguage: z.record(z.string(), languagePrice).optional() }),
                    )
                    .optional(),
                })
                .optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .nullish(),
});
export type CardNexusSealed = z.infer<typeof sealedSchema>;

const searchSchema = z.object({
  // Les produits non scellés (au cas où) sont ignorés plutôt que de faire échouer la page.
  data: z.array(z.unknown()).transform((items) =>
    items.flatMap((i) => {
      const r = sealedSchema.safeParse(i);
      return r.success ? [r.data] : [];
    }),
  ),
  pagination: z.object({ hasMore: z.boolean() }),
});

const listingSchema = z.object({
  listingId: z.string(),
  price: z.object({ amount: z.number(), currency: z.string() }),
  language: z.string().nullish(),
});
export type CardNexusListing = z.infer<typeof listingSchema>;

const listingsSchema = z.object({
  data: z.array(z.unknown()).transform((items) =>
    items.flatMap((i) => {
      const r = listingSchema.safeParse(i);
      return r.success ? [r.data] : [];
    }),
  ),
});
