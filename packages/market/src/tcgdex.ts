import { z } from 'zod';

/** Client minimal de l'API TCGdex (gratuite, sans clé) — https://tcgdex.dev */
export const TCGDEX_BASE_URL = 'https://api.tcgdex.net/v2/fr';

const setBrief = z.object({ id: z.string(), name: z.string(), logo: z.string().optional() });

const serieSchema = z.object({
  id: z.string(),
  name: z.string(),
  sets: z.array(setBrief),
});

const setSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string().optional(),
  symbol: z.string().optional(),
  releaseDate: z.string().optional(),
  serie: z.object({ id: z.string(), name: z.string() }).optional(),
  abbreviation: z.object({ official: z.string().optional() }).optional(),
  cardCount: z.object({ total: z.number().optional(), official: z.number().optional() }).optional(),
  cards: z
    .array(
      z.object({
        id: z.string(),
        localId: z.string(),
        name: z.string(),
        image: z.string().optional(),
      }),
    )
    .optional(),
});

const cardBrief = z.object({
  id: z.string(),
  localId: z.string(),
  name: z.string(),
  image: z.string().optional(),
});
export type TcgdexCardBrief = z.infer<typeof cardBrief>;

const cardmarketPricing = z
  .object({
    unit: z.string().optional(),
    avg: z.number().nullable().optional(),
    low: z.number().nullable().optional(),
    trend: z.number().nullable().optional(),
    avg7: z.number().nullable().optional(),
    avg30: z.number().nullable().optional(),
    'trend-holo': z.number().nullable().optional(),
    'avg30-holo': z.number().nullable().optional(),
  })
  .passthrough();

const cardSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: z.string().optional(),
  image: z.string().optional(),
  set: z.object({ id: z.string(), name: z.string() }).optional(),
  pricing: z.object({ cardmarket: cardmarketPricing.nullable().optional() }).partial().optional(),
  variants_detailed: z
    .array(
      z.object({
        type: z.string().optional(),
        pricing: z
          .object({ cardmarket: cardmarketPricing.nullable().optional() })
          .partial()
          .optional(),
      }),
    )
    .optional(),
});

export type TcgdexSerie = z.infer<typeof serieSchema>;
export type TcgdexSet = z.infer<typeof setSchema>;
export type TcgdexCard = z.infer<typeof cardSchema>;

export class TcgdexClient {
  constructor(
    private readonly baseUrl = TCGDEX_BASE_URL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: { accept: 'application/json', 'user-agent': 'TCGWatch (self-hosted)' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`TCGdex ${path} : HTTP ${res.status}`);
    return schema.parse(await res.json());
  }

  getSerie(id: string) {
    return this.get(`/series/${encodeURIComponent(id)}`, serieSchema);
  }

  getSet(id: string) {
    return this.get(`/sets/${encodeURIComponent(id)}`, setSchema);
  }

  getCard(id: string) {
    return this.get(`/cards/${encodeURIComponent(id)}`, cardSchema);
  }

  /** Cartes dont le nom contient `name` (fiches courtes : id, numéro, nom, image). */
  searchCards(name: string, limit = 40) {
    const q = new URLSearchParams({ name, 'pagination:itemsPerPage': String(limit) });
    return this.get(`/cards?${q}`, z.array(cardBrief));
  }
}

/** URL d'image TCGdex : les assets s'utilisent avec une extension (ex. /logo.png, /high.webp). */
export function tcgdexAsset(
  base: string | undefined,
  suffix: '.png' | '.webp' | '/high.webp' | '/low.webp',
) {
  return base ? `${base}${suffix}` : undefined;
}

/** "me06" → "ME06", "sv03.5" → "SV03.5" */
export function setCodeFromId(id: string): string {
  return id.toUpperCase();
}

/** Cotes Cardmarket d'une carte, gardées séparément pour des courbes cohérentes. */
export interface CardmarketQuote {
  /** Valeur affichée : tendance, sinon moyenne 30 j, sinon moyenne. */
  price: number;
  trend: number | null;
  low: number | null;
  avg7: number | null;
  avg30: number | null;
}

const positive = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? v : null);

/**
 * Cotes Cardmarket d'une carte : premier jeu de prix renseigné, dans `variants_detailed`
 * (nouvelle API) puis `pricing` (ancienne forme). Les cotes « holo » servent de repli.
 */
export function cardmarketQuote(card: TcgdexCard): CardmarketQuote | null {
  const candidates = [
    ...(card.variants_detailed ?? []).map((v) => v.pricing?.cardmarket),
    card.pricing?.cardmarket,
  ];
  for (const p of candidates) {
    if (!p) continue;
    const extra = p as Record<string, unknown>;
    const trend = positive(p.trend) ?? positive(p['trend-holo']);
    const avg30 = positive(p.avg30) ?? positive(p['avg30-holo']);
    const price = trend ?? avg30 ?? positive(p.avg);
    if (price === null) continue;
    return {
      price,
      trend,
      low: positive(p.low) ?? positive(extra['low-holo']),
      avg7: positive(p.avg7) ?? positive(extra['avg7-holo']),
      avg30,
    };
  }
  return null;
}

/** Prix Cardmarket d'une carte : tendance, sinon moyenne 30 j, sinon moyenne. */
export function cardmarketPrice(card: TcgdexCard): number | null {
  return cardmarketQuote(card)?.price ?? null;
}
