import 'server-only';
import { prisma } from '@tcgwatch/db';
import { cardmarketPrice, tcgdexAsset, TcgdexClient } from '@tcgwatch/market';
import {
  matchScore,
  PRODUCT_TYPE_LABELS,
  queryWords,
  toNumber,
  type ProductTypeKey,
} from '@tcgwatch/shared';
import { latestMarketPrices } from './collection';
import { searchCards as searchLocalCards } from './encyclopedia';
import { getProducts, type ProductDTO } from './products';

export interface ProductHit {
  product: ProductDTO;
  resale: { price: number; source: string; date: Date } | null;
}

export interface CardHit {
  id: string;
  name: string;
  setName: string | null;
  number: string | null;
  rarity: string | null;
  image: string | null;
  price: number | null;
  /** Suivie dans TCGWatch (carte phare) : historique de prix disponible. */
  tracked: boolean;
}

export interface ReleaseHit {
  id: string;
  /** Code TCGdex : la recherche mène à la page de l'extension. */
  tcgdexId: string | null;
  name: string;
  setCode: string | null;
  serie: string | null;
  releaseDate: Date | null;
  imageUrl: string | null;
  productCount: number;
}

const MAX_PRODUCTS = 60;
const MAX_CARDS = 16;

/** Recherche dans le catalogue local (produits, extensions) et les cartes TCGdex. */
export async function search(q: string, type?: ProductTypeKey) {
  const words = queryWords(q);
  if (words.length === 0) return { products: [], releases: [], cards: [], total: 0, cardTotal: 0 };

  const [products, market, releases, cards] = await Promise.all([
    getProducts(),
    latestMarketPrices(),
    prisma.release.findMany({
      where: { productType: null },
      select: {
        id: true,
        tcgdexId: true,
        nameFr: true,
        setCode: true,
        serie: true,
        releaseDate: true,
        imageUrl: true,
        _count: { select: { products: true, extensionProducts: true } },
      },
    }),
    searchCards(q, words),
  ]);
  const cardTotal = cards.total;

  const productHits = products
    .filter((p) => !type || p.type === type)
    .map((p) => {
      const label = PRODUCT_TYPE_LABELS[p.type as ProductTypeKey] ?? '';
      const text = [p.name, p.release?.nameFr, p.release?.setCode, label, p.ean].join(' ');
      return { p, score: matchScore(text, words) };
    })
    .filter((h) => h.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || (b.p.releaseDate?.getTime() ?? 0) - (a.p.releaseDate?.getTime() ?? 0),
    );

  const releaseHits = releases
    .map((r) => ({
      r,
      score: matchScore(`${r.nameFr} ${r.setCode ?? ''} ${r.serie ?? ''}`, words),
    }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ r }): ReleaseHit => ({
      id: r.id,
      tcgdexId: r.tcgdexId,
      name: r.nameFr,
      setCode: r.setCode,
      serie: r.serie,
      releaseDate: r.releaseDate,
      imageUrl: r.imageUrl,
      productCount: Math.max(r._count.products, r._count.extensionProducts),
    }));

  return {
    products: productHits
      .slice(0, MAX_PRODUCTS)
      .map(({ p }): ProductHit => ({ product: p, resale: market.get(p.id) ?? null })),
    total: productHits.length,
    releases: type ? [] : releaseHits,
    cards: type ? [] : cards.hits,
    /** Nombre total de cartes trouvées dans l'encyclopédie (lien « toutes les cartes »). */
    cardTotal: type ? 0 : cardTotal,
  };
}

/**
 * Cartes Pokémon : encyclopédie locale (toutes générations, cotes en cache) quand elle est
 * importée, sinon cartes suivies puis TCGdex en direct.
 */
async function searchCards(
  q: string,
  words: string[],
): Promise<{ hits: CardHit[]; total: number }> {
  const local = await searchLocalCards(q, MAX_CARDS);
  if (local.total > 0) {
    return {
      total: local.total,
      hits: local.cards.map((c) => ({
        id: c.id,
        name: c.name,
        setName: c.setName,
        number: c.localId,
        rarity: c.rarity,
        image: c.image,
        price: c.price,
        tracked: c.tracked,
      })),
    };
  }
  const hits = await searchRemoteCards(q, words);
  return { hits, total: hits.length };
}

/** Repli avant l'import de l'encyclopédie : cartes suivies, puis TCGdex en direct. */
async function searchRemoteCards(q: string, words: string[]): Promise<CardHit[]> {
  const tracked = await prisma.chaseCard.findMany({
    include: {
      release: { select: { nameFr: true } },
      prices: { orderBy: { date: 'desc' }, take: 1 },
    },
  });
  const local = tracked
    .filter((c) => matchScore(`${c.name} ${c.release.nameFr}`, words) > 0)
    .map((c): CardHit => ({
      id: c.tcgdexId,
      name: c.name,
      setName: c.release.nameFr,
      number: c.tcgdexId.split('-').pop() ?? null,
      rarity: c.rarity,
      image: c.imageUrl,
      price: toNumber(c.prices[0]?.price),
      tracked: true,
    }));

  // Le nom d'un Pokémon tient en un ou deux mots : inutile d'interroger TCGdex au-delà.
  const name = q.trim();
  if (name.length < 3 || words.length > 3) return local;
  try {
    const client = new TcgdexClient();
    const seen = new Set(local.map((c) => c.id));
    const briefs = (await client.searchCards(name, 60))
      .filter((b) => b.image && !seen.has(b.id))
      .slice(0, MAX_CARDS);
    const details = await Promise.allSettled(briefs.map((b) => client.getCard(b.id)));
    const remote = details.flatMap((d, i): CardHit[] => {
      if (d.status !== 'fulfilled') return [];
      const c = d.value;
      return [
        {
          id: c.id,
          name: c.name,
          setName: c.set?.name ?? null,
          number: briefs[i]!.localId,
          rarity: c.rarity ?? null,
          image: tcgdexAsset(c.image, '/low.webp') ?? null,
          price: cardmarketPrice(c),
          tracked: false,
        },
      ];
    });
    remote.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    return [...local, ...remote];
  } catch {
    return local;
  }
}
