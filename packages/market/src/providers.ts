import { todayUtc } from '@tcgwatch/shared';
import { z } from 'zod';
import { CardNexusProvider } from './cardnexus';
import { cardmarketQuote, TcgdexClient, type CardmarketQuote } from './tcgdex';

/**
 * Module 3 — prix du marché secondaire.
 *
 * Un provider renvoie des cotations datées ; le worker les enregistre dans `MarketPrice`
 * (un relevé par jour/produit/source, unicité en base) : l'historique se construit seul.
 *
 * ⚠️ Cardmarket n'est jamais scrapé (CGU + Cloudflare) : uniquement saisie manuelle ou API tierces.
 */
export interface ProductRef {
  id: string;
  name: string;
  ean?: string | null;
  /** Type de produit (ETB, DISPLAY…), pour rapprocher les catalogues tiers. */
  type?: string;
}

/** Extension connue (TCGdex) : nom FR, pour retrouver l'extension d'un produit. */
export interface SetRef {
  tcgdexId: string;
  nameFr: string;
}

export interface QuoteContext {
  sets?: SetRef[];
}

export interface MarketQuote {
  productId: string;
  source: string;
  price: number;
  currency: string;
  date: Date;
  /** Médiane des annonces, si la source la fournit. */
  median?: number | null;
  /** Nombre d'annonces prises en compte, si la source le fournit. */
  listingCount?: number | null;
}

export interface MarketPriceProvider {
  /** Valeur stockée dans MarketPrice.source. */
  key: string;
  label: string;
  /** false = provider non configuré (ex. clé API absente) ; ignoré par le worker. */
  isEnabled(): boolean;
  /** Relevé automatique ; les providers manuels renvoient une liste vide. */
  fetchQuotes(products: ProductRef[], context?: QuoteContext): Promise<MarketQuote[]>;
}

// ─── Provider manuel (V1) ────────────────────────────────

export const manualQuoteSchema = z.object({
  productId: z.string().min(1),
  price: z.coerce.number().positive('Le prix doit être positif').max(100_000),
  currency: z.string().length(3).default('EUR'),
  date: z.coerce.date(),
});

/** Saisie manuelle du prix constaté sur Cardmarket : les données viennent de l'UI. */
export const manualProvider: MarketPriceProvider & {
  normalize(input: unknown): MarketQuote;
} = {
  key: 'manual',
  label: 'Saisie manuelle (Cardmarket constaté)',
  isEnabled: () => true,
  fetchQuotes: async () => [],
  normalize(input) {
    const q = manualQuoteSchema.parse(input);
    const d = q.date;
    return {
      productId: q.productId,
      source: 'manual',
      price: Math.round(q.price * 100) / 100,
      currency: q.currency,
      // Les dates de formulaire ("2026-11-12") sont parsées en UTC : on reste en UTC.
      date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
    };
  },
};

// ─── Provider PokeTrace (prix de revente Cardmarket, API) ─

/**
 * PokeTrace (https://poketrace.com/docs) : prix de vente constatés sur Cardmarket, servis par
 * une API (clé gratuite : 100 requêtes/jour). Aucun scraping de Cardmarket.
 *
 * Pour chaque extension du catalogue, un seul appel liste ses produits scellés européens avec
 * leurs prix. Un produit n'est rattaché que s'il est sans ambiguïté (un seul display, un seul
 * ETB, un seul bundle par extension) et seul le prix des ventes en FRANÇAIS est retenu :
 * sans ventes FR connues, aucun prix plutôt que celui de la version anglaise.
 */
export class PokeTraceProvider implements MarketPriceProvider {
  readonly key = 'poketrace';
  readonly label = 'PokeTrace (Cardmarket, ventes FR)';
  /** Marge sur le quota quotidien gratuit (100 requêtes). */
  static readonly MAX_REQUESTS = 90;
  private requests = 0;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly tcgdexEn = new TcgdexClient('https://api.tcgdex.net/v2/en'),
    /** L'offre gratuite n'accepte qu'une requête à la fois (burst limit 1). */
    private readonly pauseMs = 1_100,
  ) {}

  isEnabled() {
    return Boolean(this.apiKey);
  }

  private async get(path: string): Promise<unknown> {
    if (this.requests >= PokeTraceProvider.MAX_REQUESTS) throw new QuotaError();
    if (this.requests > 0) await new Promise((r) => setTimeout(r, this.pauseMs));
    this.requests++;
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/v2${path}`, {
      headers: { 'X-API-Key': this.apiKey!, accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429) throw new QuotaError();
    // Offre sans accès au marché européen (« EU market data requires a Pro plan ») :
    // inutile d'insister sur les autres extensions.
    if (res.status === 403) throw new QuotaError('Marché EU PokeTrace réservé à l’offre Pro');
    if (!res.ok) throw new Error(`PokeTrace ${path} : HTTP ${res.status}`);
    return res.json();
  }

  async fetchQuotes(products: ProductRef[], context: QuoteContext = {}): Promise<MarketQuote[]> {
    if (!this.isEnabled()) return [];
    this.requests = 0;
    const date = todayUtc();
    const quotes: MarketQuote[] = [];
    for (const [set, items] of groupBySet(products, context.sets ?? [])) {
      try {
        const en = await this.tcgdexEn.getSet(set.tcgdexId);
        const sets = pokeTraceSetsSchema.parse(
          await this.get(`/sets?game=pokemon&search=${encodeURIComponent(en.name)}&limit=5`),
        ).data;
        const slug = sets.find((s) => fold(s.name) === fold(en.name))?.slug;
        if (!slug) continue;
        const sealed = pokeTraceCardsSchema.parse(
          await this.get(
            `/cards?set=${encodeURIComponent(slug)}&product_type=sealed&market=EU&limit=100`,
          ),
        ).data;
        for (const product of items) {
          const candidates = sealed.filter((c) => c.productFamily === FAMILY_BY_KIND[product.kind]);
          if (candidates.length !== 1) continue; // ambigu ou absent : pas de prix inventé
          const price = frenchSealedPrice(candidates[0]!.prices);
          if (price !== null) {
            quotes.push({ productId: product.id, source: this.key, price, currency: 'EUR', date });
          }
        }
      } catch (err) {
        if (err instanceof QuotaError) break;
        // Extension illisible chez PokeTrace : on passe à la suivante.
      }
    }
    return quotes;
  }
}

class QuotaError extends Error {
  constructor(message = 'Quota PokeTrace atteint') {
    super(message);
  }
}

type SealedKind = 'DISPLAY' | 'ETB' | 'BUNDLE';

/** Familles PokeTrace des types rapprochables sans ambiguïté. */
const FAMILY_BY_KIND: Record<SealedKind, string> = {
  DISPLAY: 'booster_box',
  ETB: 'elite_trainer_box',
  BUNDLE: 'booster_bundle',
};

const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Mots d'un nom d'extension qui ne la distinguent pas (série, articles). */
const SET_NOISE = new Set(
  'de du des la le les l et a en ecarlate violet epee bouclier soleil lune mega evolution noir blanc'.split(
    ' ',
  ),
);

/**
 * Regroupe display, ETB et bundle par extension : le nom FR de l'extension (hors mots de
 * série) doit figurer dans le nom du produit ; la correspondance la plus précise l'emporte.
 */
export function groupBySet(
  products: ProductRef[],
  sets: SetRef[],
): Map<SetRef, (ProductRef & { kind: SealedKind })[]> {
  const words = sets
    .map((s) => ({
      s,
      w: fold(s.nameFr)
        .split(' ')
        .filter((x) => x && !SET_NOISE.has(x)),
    }))
    .filter((x) => x.w.length > 0);
  const out = new Map<SetRef, (ProductRef & { kind: SealedKind })[]>();
  for (const p of products) {
    const name = fold(p.name);
    const tokens = new Set(name.split(' '));
    let kind: SealedKind | null = null;
    if (p.type === 'ETB') kind = 'ETB';
    else if (p.type === 'DISPLAY' && !tokens.has('demi')) kind = 'DISPLAY';
    else if (p.type === 'BOOSTER' && (tokens.has('lot') || tokens.has('bundle'))) kind = 'BUNDLE';
    if (!kind) continue;
    const best = words
      .filter((x) => x.w.every((w) => tokens.has(w)))
      .sort((a, b) => b.w.length - a.w.length)[0];
    if (!best) continue;
    out.set(best.s, [...(out.get(best.s) ?? []), { ...p, kind }]);
  }
  return out;
}

const languageBucket = z.record(z.string(), z.object({ avg: z.number().optional() }).passthrough());
const tierPrice = z
  .object({
    avg: z.number().nullable().optional(),
    language: languageBucket.optional(),
    country: z
      .record(z.string(), z.object({ language: languageBucket.optional() }).passthrough())
      .optional(),
  })
  .passthrough();
const pricesByGrade = z.record(z.string(), z.record(z.string(), z.record(z.string(), tierPrice)));
const pokeTraceCardsSchema = z.object({
  data: z.array(
    z
      .object({
        name: z.string(),
        productFamily: z.string().optional(),
        prices: pricesByGrade.optional(),
      })
      .passthrough(),
  ),
});
const pokeTraceSetsSchema = z.object({
  data: z.array(z.object({ slug: z.string(), name: z.string() }).passthrough()),
});

export type PokeTracePrices = z.infer<typeof pricesByGrade>;

/** Prix moyen des ventes en français sur Cardmarket (marché EU), null si inconnu. */
export function frenchSealedPrice(prices: PokeTracePrices | undefined): number | null {
  for (const byMarket of Object.values(prices ?? {})) {
    const tier = byMarket.EU?.cardmarket;
    if (!tier) continue;
    const fr = tier.language?.FR?.avg ?? tier.country?.FR?.language?.FR?.avg;
    if (typeof fr === 'number' && fr > 0) return Math.round(fr * 100) / 100;
  }
  return null;
}

// ─── Provider TCGdex (cartes phares) ─────────────────────

export interface CardRef {
  id: string;
  tcgdexId: string;
}

export interface CardQuote extends CardmarketQuote {
  chaseCardId: string;
  source: 'tcgdex-cardmarket';
  currency: 'EUR';
  date: Date;
}

/**
 * Prix des cartes phares (chase cards) d'une extension, via les cotations Cardmarket
 * agrégées par TCGdex. Sert d'indicateur de « désirabilité » d'une extension scellée.
 */
export class TcgdexChaseCardProvider {
  readonly key = 'tcgdex-cardmarket';

  constructor(private readonly client = new TcgdexClient()) {}

  async fetchCardQuotes(cards: CardRef[], date: Date): Promise<CardQuote[]> {
    const quotes: CardQuote[] = [];
    for (const card of cards) {
      const data = await this.client.getCard(card.tcgdexId);
      const quote = cardmarketQuote(data);
      if (quote) {
        quotes.push({
          ...quote,
          chaseCardId: card.id,
          source: 'tcgdex-cardmarket',
          currency: 'EUR',
          date,
        });
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return quotes;
  }
}

export function createMarketProviders(env: {
  POKETRACE_API_KEY?: string;
  POKETRACE_API_URL: string;
  CARDNEXUS_API_KEY?: string;
  CARDNEXUS_API_URL?: string;
}): MarketPriceProvider[] {
  return [
    manualProvider,
    new CardNexusProvider(env.CARDNEXUS_API_KEY, env.CARDNEXUS_API_URL),
    new PokeTraceProvider(env.POKETRACE_API_KEY, env.POKETRACE_API_URL),
  ];
}
