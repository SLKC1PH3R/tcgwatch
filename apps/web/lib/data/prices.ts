import 'server-only';
import { Prisma, prisma } from '@tcgwatch/db';
import {
  deliveredPrice,
  priceCategoryOf,
  toNumber,
  type Availability,
  type PriceCategory,
} from '@tcgwatch/shared';

/** Ligne d'un tableau de prix du scellé. */
export interface SealedPrice {
  id: string;
  name: string;
  type: string;
  category: PriceCategory | null;
  image: string | null;
  releaseDate: Date | null;
  msrp: number | null;
  serie: { id: string; name: string; order: number } | null;
  extension: { name: string; code: string | null } | null;
  /** Cote du marché du jour (Cardmarket en priorité). */
  market: number | null;
  marketSource: string | null;
  /** Variation de la cote sur environ 30 jours (0,1 = +10 %). */
  change30: number | null;
  /** Meilleure offre achetable chez les revendeurs suivis (prix livré si le port est connu). */
  bestOffer: number | null;
  bestRetailer: string | null;
  bestUrl: string | null;
  bestAvailability: Availability | null;
  offers: number;
}

const SOURCE_RANK = Prisma.sql`CASE source WHEN 'cardmarket' THEN 0 WHEN 'cardnexus' THEN 1 WHEN 'poketrace' THEN 2 ELSE 3 END`;

/** Cote du jour de chaque produit et cote d'il y a ~30 jours (même source). */
async function marketQuotes() {
  const rows = await prisma.$queryRaw<
    { productId: string; price: Prisma.Decimal; source: string; past: Prisma.Decimal | null }[]
  >`
    WITH cur AS (
      SELECT DISTINCT ON ("productId") "productId", source, price, date
      FROM "MarketPrice" WHERE date > CURRENT_DATE - 14
      ORDER BY "productId", date DESC, ${SOURCE_RANK}
    ), past AS (
      SELECT DISTINCT ON (m."productId") m."productId", m.price
      FROM "MarketPrice" m JOIN cur ON cur."productId" = m."productId" AND cur.source = m.source
      WHERE m.date BETWEEN cur.date - 37 AND cur.date - 23
      ORDER BY m."productId", abs(m.date - (cur.date - 30))
    )
    SELECT cur."productId", cur.price, cur.source, past.price AS past
    FROM cur LEFT JOIN past USING ("productId")`;
  return new Map(
    rows.map((r) => {
      const price = toNumber(r.price)!;
      const past = toNumber(r.past);
      return [
        r.productId,
        { price, source: r.source, change30: past ? price / past - 1 : null },
      ] as const;
    }),
  );
}

const BUYABLE: Availability[] = ['IN_STOCK', 'PREORDER'];

/** Tous les produits scellés avec leur cote et leur meilleure offre en boutique. */
export async function getSealedPrices(): Promise<SealedPrice[]> {
  const serieSelect = { select: { id: true, name: true, order: true } } as const;
  const releaseSelect = {
    select: { nameFr: true, setCode: true, releaseDate: true, serie: true, serieRef: serieSelect },
  } as const;
  const [products, quotes] = await Promise.all([
    prisma.product.findMany({
      where: { type: { not: 'AUTRE' } },
      select: {
        id: true,
        name: true,
        type: true,
        imageUrl: true,
        images: true,
        msrp: true,
        releaseDate: true,
        extension: releaseSelect,
        release: releaseSelect,
        listings: {
          where: { lastPrice: { not: null }, state: { not: 'PAUSED' } },
          select: {
            url: true,
            lastPrice: true,
            lastAvailability: true,
            lastImageUrl: true,
            retailer: { select: { name: true, shippingCost: true, freeShippingFrom: true } },
          },
        },
      },
    }),
    marketQuotes(),
  ]);

  return products.map((p) => {
    const rel = p.extension ?? p.release;
    let best: { cost: number; retailer: string; url: string; availability: Availability } | null =
      null;
    let offers = 0;
    for (const l of p.listings) {
      if (!BUYABLE.includes(l.lastAvailability)) continue;
      const price = toNumber(l.lastPrice)!;
      const cost =
        deliveredPrice(price, {
          cost: toNumber(l.retailer.shippingCost),
          freeFrom: toNumber(l.retailer.freeShippingFrom),
        }) ?? price;
      offers++;
      if (!best || cost < best.cost)
        best = { cost, retailer: l.retailer.name, url: l.url, availability: l.lastAvailability };
    }
    const q = quotes.get(p.id);
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      category: priceCategoryOf(p.name, p.type),
      image:
        p.imageUrl ?? p.images[0] ?? p.listings.find((l) => l.lastImageUrl)?.lastImageUrl ?? null,
      releaseDate: p.releaseDate ?? rel?.releaseDate ?? null,
      msrp: toNumber(p.msrp),
      serie: rel?.serieRef ?? (rel?.serie ? { id: rel.serie, name: rel.serie, order: -1 } : null),
      extension: rel ? { name: rel.nameFr, code: rel.setCode } : null,
      market: q?.price ?? null,
      marketSource: q?.source ?? null,
      change30: q?.change30 ?? null,
      bestOffer: best?.cost ?? null,
      bestRetailer: best?.retailer ?? null,
      bestUrl: best?.url ?? null,
      bestAvailability: best?.availability ?? null,
      offers,
    };
  });
}

/** Regroupe des lignes par série (génération), de la plus récente à la plus ancienne. */
export function groupBySerie<
  T extends { serie: { id: string; name: string; order: number } | null },
>(rows: T[]): { id: string; name: string; rows: T[] }[] {
  const groups = new Map<string, { id: string; name: string; order: number; rows: T[] }>();
  for (const r of rows) {
    const s = r.serie ?? { id: 'autres', name: 'Autres produits', order: -2 };
    const g = groups.get(s.id) ?? { ...s, rows: [] };
    g.rows.push(r);
    groups.set(s.id, g);
  }
  return [...groups.values()].sort((a, b) => b.order - a.order);
}

export interface PricedCard {
  id: string;
  localId: string;
  name: string;
  rarity: string | null;
  image: string | null;
  price: number;
  avg7: number | null;
  avg30: number | null;
  setName: string;
  setCode: string | null;
  setId: string | null;
  serieId: string | null;
  serieName: string | null;
  releaseDate: Date | null;
  cardCount: number | null;
}

/** Cartes cotées, de la plus chère à la moins chère (filtre facultatif par série). */
export async function getTopCards(
  opts: { limit?: number; serieId?: string; releaseId?: string; minPrice?: number } = {},
): Promise<PricedCard[]> {
  const rows = await prisma.card.findMany({
    where: {
      priceTrend: { gt: opts.minPrice ?? 0 },
      ...(opts.releaseId ? { releaseId: opts.releaseId } : {}),
      ...(opts.serieId ? { release: { serieId: opts.serieId } } : {}),
    },
    orderBy: { priceTrend: 'desc' },
    take: opts.limit ?? 100,
    select: {
      id: true,
      localId: true,
      name: true,
      rarity: true,
      imageUrl: true,
      priceTrend: true,
      priceAvg7: true,
      priceAvg30: true,
      release: {
        select: {
          nameFr: true,
          setCode: true,
          tcgdexId: true,
          serieId: true,
          releaseDate: true,
          cardCountOfficial: true,
          serieRef: { select: { name: true } },
        },
      },
    },
  });
  return rows.map(toPricedCard);
}

export function toPricedCard(c: {
  id: string;
  localId: string;
  name: string;
  rarity: string | null;
  imageUrl: string | null;
  priceTrend: Prisma.Decimal | null;
  priceAvg7: Prisma.Decimal | null;
  priceAvg30: Prisma.Decimal | null;
  release: {
    nameFr: string;
    setCode: string | null;
    tcgdexId: string | null;
    serieId: string | null;
    releaseDate: Date | null;
    cardCountOfficial: number | null;
    serieRef: { name: string } | null;
  };
}): PricedCard {
  return {
    id: c.id,
    localId: c.localId,
    name: c.name,
    rarity: c.rarity,
    image: c.imageUrl ? `${c.imageUrl}/low.webp` : null,
    price: toNumber(c.priceTrend) ?? 0,
    avg7: toNumber(c.priceAvg7),
    avg30: toNumber(c.priceAvg30),
    setName: c.release.nameFr,
    setCode: c.release.setCode,
    setId: c.release.tcgdexId,
    serieId: c.release.serieId,
    serieName: c.release.serieRef?.name ?? null,
    releaseDate: c.release.releaseDate,
    cardCount: c.release.cardCountOfficial,
  };
}

/** Variation d'une cote par rapport à une moyenne (null si la moyenne manque). */
export const changeVs = (price: number, ref: number | null) =>
  ref && ref > 0 ? price / ref - 1 : null;
