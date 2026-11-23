import { z } from 'zod';
import { pokemonTcgLargeImage } from './pokemontcg';

/** Client minimal de l'API TCGdex (gratuite, sans clé) — https://tcgdex.dev */
export const TCGDEX_BASE_URL = 'https://api.tcgdex.net/v2/fr';
/** API GraphQL : fiches détaillées de toutes les cartes d'une extension par pages de 100. */
export const TCGDEX_GRAPHQL_URL = 'https://api.tcgdex.net/v2/graphql';
const GRAPHQL_PAGE = 100;

const serieBrief = z.object({ id: z.string(), name: z.string(), logo: z.string().optional() });

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
  /** Absent des petites extensions spéciales : la série vient alors de /series/{id}. */
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

/** Carte détaillée de la liste d'une extension (GraphQL, sans cotes). */
const setCardSchema = z.object({
  id: z.string(),
  localId: z.string(),
  name: z.string(),
  image: z.string().nullable().optional(),
  rarity: z.string().nullable().optional(),
  illustrator: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  types: z.array(z.string()).nullable().optional(),
  dexId: z.array(z.number()).nullable().optional(),
  set: z.object({ id: z.string() }),
  variants: z.record(z.string(), z.boolean().nullable()).nullable().optional(),
  /** Variantes détaillées (nouveau format TCGdex : une entrée par version imprimée). */
  variants_detailed: z
    .array(
      z.object({
        type: z.string().nullable().optional(),
        stamp: z.array(z.string().nullable()).nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
});
export type TcgdexSetCard = z.infer<typeof setCardSchema>;
const graphqlCards = z.object({
  data: z
    .object({ cards: z.array(setCardSchema) })
    .nullable()
    .optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export type TcgdexSerieBrief = z.infer<typeof serieBrief>;
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

  /** Toutes les séries, de la plus ancienne à la plus récente. */
  listSeries() {
    return this.get('/series', z.array(serieBrief));
  }

  getSerie(id: string) {
    return this.get(`/series/${encodeURIComponent(id)}`, serieSchema);
  }

  getSet(id: string) {
    return this.get(`/sets/${encodeURIComponent(id)}`, setSchema);
  }

  /**
   * Logo et symbole publiés sur le CDN de TCGdex mais pas (encore) déclarés par l'API :
   * fréquent pour les extensions récentes. Logo français d'abord, puis anglais.
   */
  async unlistedAssets(
    serieId: string,
    setId: string,
  ): Promise<{ logo?: string; symbol?: string }> {
    const base = `https://assets.tcgdex.net`;
    const path = `${encodeURIComponent(serieId)}/${encodeURIComponent(setId)}`;
    const exists = async (url: string) => {
      try {
        const res = await this.fetchImpl(url, {
          method: 'HEAD',
          headers: { 'user-agent': 'TCGWatch (self-hosted)' },
          signal: AbortSignal.timeout(10_000),
        });
        return res.ok;
      } catch {
        return false;
      }
    };
    let logo: string | undefined;
    for (const lang of ['fr', 'en']) {
      if (await exists(`${base}/${lang}/${path}/logo.png`)) {
        logo = `${base}/${lang}/${path}/logo`;
        break;
      }
    }
    const symbol = (await exists(`${base}/univ/${path}/symbol.png`))
      ? `${base}/univ/${path}/symbol`
      : undefined;
    return { logo, symbol };
  }

  getCard(id: string) {
    return this.get(`/cards/${encodeURIComponent(id)}`, cardSchema);
  }

  /**
   * Cartes dont la rareté contient `rarity` (filtre souple de TCGdex : « Illustration »
   * couvre « Illustration rare » et « Illustration spéciale rare »).
   */
  searchCardsByRarity(rarity: string, limit = 250) {
    const q = new URLSearchParams({ rarity, 'pagination:itemsPerPage': String(limit) });
    return this.get(`/cards?${q}`, z.array(cardBrief));
  }

  /**
   * Toutes les cartes d'une extension avec rareté, illustrateur, types et variantes, dans la
   * langue demandée (GraphQL, pages de 100). Une carte absente dans cette langue n'y est pas.
   */
  async setCards(setId: string, lang: 'fr' | 'en' = 'fr'): Promise<TcgdexSetCard[]> {
    const query = `query($id: ID, $page: Int!) { cards(filters: {id: $id}, pagination: {page: $page, count: ${GRAPHQL_PAGE}}) @locale(lang: "${lang}") { id localId name image rarity illustrator category types dexId set { id } variants { normal reverse holo firstEdition } variants_detailed { type stamp } } }`;
    const out: TcgdexSetCard[] = [];
    for (let page = 1; page < 50; page++) {
      const res = await this.graphql(query, { id: `${setId}-`, page });
      if (!res.ok) throw new Error(`TCGdex GraphQL ${setId} : HTTP ${res.status}`);
      const body = graphqlCards.parse(await res.json());
      const cards = body.data?.cards ?? [];
      if (!body.data && body.errors?.length) {
        throw new Error(`TCGdex GraphQL ${setId} : ${body.errors[0]!.message}`);
      }
      // Le filtre `id` cherche une sous-chaîne : seules les cartes de cette extension restent.
      out.push(...cards.filter((c) => c.set.id === setId));
      if (cards.length < GRAPHQL_PAGE) break;
    }
    return out;
  }

  /** Requête GraphQL, retentée (2 s, 6 s, 18 s) si TCGdex est saturé (429 / 503). */
  private async graphql(query: string, variables: Record<string, unknown>, retries = 3) {
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(TCGDEX_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': 'TCGWatch (self-hosted)',
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(30_000),
      });
      if ((res.status !== 429 && res.status !== 503) || attempt >= retries) return res;
      await new Promise((r) => setTimeout(r, 2_000 * 3 ** attempt));
    }
  }

  /** Cartes dont le nom contient `name` (fiches courtes : id, numéro, nom, image). */
  searchCards(name: string, limit = 40) {
    const q = new URLSearchParams({ name, 'pagination:itemsPerPage': String(limit) });
    return this.get(`/cards?${q}`, z.array(cardBrief));
  }
}

/** URL d'image TCGdex : les assets s'utilisent avec une extension (ex. /logo.png, /high.webp). */
/**
 * Images de cartes fournies avec le site (`apps/web/public/cards`) pour les cartes sans image
 * TCGdex dont l'image de repli ne s'affiche pas (Mew B/G/R du 30e Anniversaire).
 */
export const LOCAL_CARD_IMAGES: Record<string, string> = {
  '30th-B': '/cards/30e-anniversaire-b.webp',
  '30th-G': '/cards/30e-anniversaire-g.webp',
  '30th-R': '/cards/30e-anniversaire-r.webp',
};

export function tcgdexAsset(
  base: string | undefined,
  suffix: '.png' | '.webp' | '/high.webp' | '/low.webp',
) {
  if (!base) return undefined;
  // Image servie par le site lui-même (public/cards) : chemin tel quel, quelle que soit la taille.
  if (base.startsWith('/')) return base;
  // Image d'une autre source (pokemontcg.io, quand TCGdex n'en a pas) : URL complète.
  if (!base.startsWith('https://assets.tcgdex.net/')) {
    return suffix === '/low.webp' ? base : pokemonTcgLargeImage(base);
  }
  return `${base}${suffix}`;
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

/** Produit Cardmarket d'une carte (le même quelle que soit la variante), s'il est connu. */
export function cardmarketProductId(card: TcgdexCard): number | null {
  for (const p of [
    card.pricing?.cardmarket,
    ...(card.variants_detailed ?? []).map((v) => v.pricing?.cardmarket),
  ]) {
    const id = (p as Record<string, unknown> | null | undefined)?.idProduct;
    if (typeof id === 'number' && id > 0) return id;
  }
  return null;
}

/** Prix Cardmarket d'une carte : tendance, sinon moyenne 30 j, sinon moyenne. */
export function cardmarketPrice(card: TcgdexCard): number | null {
  return cardmarketQuote(card)?.price ?? null;
}

/** Partie numérique d'un numéro de carte, pour le tri ("130" → 130, "TG05" → 5). */
export function cardNumber(localId: string): number | null {
  const m = localId.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * Fusion des listes française et anglaise d'une extension : nom et image français quand ils
 * existent, sinon anglais (`nameMissing` signale un nom français absent).
 */
export function mergeSetCards(fr: TcgdexSetCard[], en: TcgdexSetCard[]) {
  const english = new Map(en.map((c) => [c.id, c]));
  const ids = [...new Set([...fr.map((c) => c.id), ...en.map((c) => c.id)])];
  const french = new Map(fr.map((c) => [c.id, c]));
  return ids.map((id) => {
    const f = french.get(id);
    const e = english.get(id);
    const c = (f ?? e)!;
    return {
      id,
      localId: c.localId,
      number: cardNumber(c.localId),
      name: f?.name ?? e!.name,
      nameMissing: !f,
      imageUrl: f?.image ?? e?.image ?? null,
      rarity: f?.rarity ?? e?.rarity ?? null,
      illustrator: c.illustrator ?? e?.illustrator ?? null,
      category: f?.category ?? e?.category ?? null,
      types: f?.types ?? e?.types ?? [],
      dexIds: c.dexId ?? e?.dexId ?? [],
      variants: cardVariants(f, e),
    };
  });
}

const VARIANT_ORDER = ['normal', 'reverse', 'holo', 'firstEdition'] as const;

/**
 * Variantes d'une carte : réunion des versions française et anglaise, de l'ancien format
 * (booléens) et du nouveau (`variants_detailed`), TCGdex ne renseignant pas toujours les deux
 * (reverses absentes des extensions récentes sinon).
 */
export function cardVariants(...cards: (TcgdexSetCard | undefined)[]): string[] {
  const found = new Set<string>();
  for (const c of cards) {
    if (!c) continue;
    for (const [k, v] of Object.entries(c.variants ?? {})) if (v) found.add(k);
    for (const d of c.variants_detailed ?? []) {
      if (d.type && (VARIANT_ORDER as readonly string[]).includes(d.type)) found.add(d.type);
      if (d.stamp?.includes('1st-edition')) found.add('firstEdition');
    }
  }
  return [
    ...VARIANT_ORDER.filter((v) => found.has(v)),
    ...[...found].filter((v) => !(VARIANT_ORDER as readonly string[]).includes(v)).sort(),
  ];
}
export type MergedCard = ReturnType<typeof mergeSetCards>[number];
