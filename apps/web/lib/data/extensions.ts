import 'server-only';
import { Prisma, prisma } from '@tcgwatch/db';
import { cardmarketQuote, tcgdexAsset, TcgdexClient } from '@tcgwatch/market';
import { boosterCount, toNumber } from '@tcgwatch/shared';
import { getProductsByIds, type ProductDTO } from './products';

/** Durée de validité d'une cote de carte lue sur TCGdex (Cardmarket). */
export const CARD_PRICE_TTL_MS = 24 * 3_600_000;
/** Cotes rafraîchies au plus par affichage de page (le reste au passage suivant). */
const PRICE_REFRESH_MAX = 250;
const PRICE_REFRESH_CONCURRENCY = 6;

/** Extension par son code (id TCGdex, ex. « me06 », insensible à la casse). */
export async function getExtension(code: string) {
  return prisma.release.findFirst({
    where: { tcgdexId: { equals: code, mode: 'insensitive' } },
    include: {
      serieRef: true,
      _count: { select: { cards: true, chaseCards: true, extensionProducts: true } },
    },
  });
}
export type Extension = NonNullable<Awaited<ReturnType<typeof getExtension>>>;

/** Produits scellés de l'extension, avec prix par booster. */
export async function getExtensionProducts(releaseId: string) {
  const ids = await prisma.product.findMany({
    where: { extensionId: releaseId },
    select: { id: true },
  });
  const products = await getProductsByIds(ids.map((p) => p.id));
  return products
    .map((p) => {
      const boosters = boosterCount(p.name, p.type);
      const price = p.best ? (p.best.delivered ?? p.best.price) : null;
      return { ...p, boosters, perBooster: boosters && price ? price / boosters : null };
    })
    .sort(
      (a, b) =>
        (a.releaseDate?.getTime() ?? Infinity) - (b.releaseDate?.getTime() ?? Infinity) ||
        a.name.localeCompare(b.name, 'fr'),
    );
}
export type ExtensionProduct = ProductDTO & { boosters: number | null; perBooster: number | null };

export interface CardFilters {
  rarity?: string;
  type?: string;
  secret?: boolean;
}

/** Cartes de l'extension (ordre du numéro), avec filtres et valeurs possibles des filtres. */
export async function getExtensionCards(ext: Extension, filters: CardFilters) {
  const cards = await prisma.card.findMany({
    where: { releaseId: ext.id },
    orderBy: [{ number: { sort: 'asc', nulls: 'last' } }, { localId: 'asc' }],
  });
  const tracked = new Set(
    (
      await prisma.chaseCard.findMany({
        where: { tcgdexId: { in: cards.map((c) => c.id) } },
        select: { tcgdexId: true },
      })
    ).map((c) => c.tcgdexId),
  );
  const official = ext.cardCountOfficial;
  const isSecret = (c: { number: number | null; localId: string }) =>
    official !== null && (c.number === null ? /\D/.test(c.localId) : c.number > official);
  const rarities = [...new Set(cards.map((c) => c.rarity).filter((r): r is string => !!r))];
  const types = [...new Set(cards.flatMap((c) => c.types))].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  );
  const shown = cards.filter(
    (c) =>
      (!filters.rarity || c.rarity === filters.rarity) &&
      (!filters.type || c.types.includes(filters.type)) &&
      (!filters.secret || isSecret(c)),
  );
  return {
    total: cards.length,
    rarities,
    types,
    cards: shown.map((c) => ({
      id: c.id,
      localId: c.localId,
      name: c.name,
      nameMissing: c.nameMissing,
      image: tcgdexAsset(c.imageUrl ?? undefined, '/low.webp') ?? null,
      rarity: c.rarity,
      secret: isSecret(c),
      tracked: tracked.has(c.id),
      price: toNumber(c.priceTrend) ?? toNumber(c.priceAvg30),
      priceAt: c.priceAt,
    })),
  };
}

/** Cartes dont la cote manque ou date de plus de 24 h. */
export function staleCardIds(cards: { id: string; priceAt: Date | null }[], now = Date.now()) {
  return cards
    .filter((c) => !c.priceAt || now - c.priceAt.getTime() > CARD_PRICE_TTL_MS)
    .map((c) => c.id);
}

/**
 * Relit les cotes Cardmarket (via TCGdex) de quelques cartes et les garde en cache sur la
 * carte. Appelé après l'affichage d'une page (pas d'attente pour l'utilisateur).
 */
export async function refreshCardPrices(ids: string[]): Promise<number> {
  const client = new TcgdexClient();
  const queue = ids.slice(0, PRICE_REFRESH_MAX);
  let done = 0;
  await Promise.all(
    Array.from({ length: PRICE_REFRESH_CONCURRENCY }, async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        const card = await client.getCard(id).catch(() => null);
        if (!card) continue;
        const q = cardmarketQuote(card);
        await prisma.card.update({
          where: { id },
          data: {
            priceTrend: q?.trend ?? q?.price ?? null,
            priceLow: q?.low ?? null,
            priceAvg30: q?.avg30 ?? null,
            priceAt: new Date(),
          },
        });
        done++;
      }
    }),
  );
  return done;
}

/** Cartes phares suivies de l'extension, avec l'historique de leurs cotes. */
export async function getExtensionChaseCards(releaseId: string) {
  const cards = await prisma.chaseCard.findMany({
    where: { releaseId },
    include: {
      prices: { orderBy: { date: 'asc' }, select: { date: true, price: true, trend: true } },
    },
  });
  return cards
    .map((c) => {
      const values = c.prices
        .map((p) => toNumber(p.trend) ?? toNumber(p.price))
        .filter((v): v is number => v !== null);
      return {
        tcgdexId: c.tcgdexId,
        name: c.name,
        rarity: c.rarity,
        imageUrl: c.imageUrl,
        manual: c.manual,
        values,
        last: values.at(-1) ?? null,
        first: values[0] ?? null,
      };
    })
    .sort((a, b) => (b.last ?? 0) - (a.last ?? 0));
}

/**
 * Évolution des displays et ETB depuis la sortie : meilleur prix achetable du jour (résumés
 * quotidiens retenus) en % du prix conseillé, une courbe par produit.
 */
export async function getExtensionPriceEvolution(products: ExtensionProduct[]) {
  const tracked = products.filter(
    (p) => (p.type === 'DISPLAY' || p.type === 'ETB') && p.msrp && p.msrp > 0,
  );
  if (tracked.length === 0) return { data: [], series: [] };
  const rows = await prisma.$queryRaw<{ productId: string; date: Date; best: number }[]>`
    SELECT l."productId", d."date", MIN(d."minBuyablePrice")::float8 AS best
    FROM "ListingDaily" d JOIN "Listing" l ON l."id" = d."listingId"
    WHERE l."productId" IN (${Prisma.join(tracked.map((p) => p.id))})
      AND d."minBuyablePrice" IS NOT NULL AND NOT COALESCE(d."excluded", d."suspect")
    GROUP BY l."productId", d."date"
    ORDER BY d."date"`;
  const byDay = new Map<string, Record<string, number | string>>();
  const msrp = new Map(tracked.map((p) => [p.id, p.msrp!]));
  for (const r of rows) {
    const day = r.date.toISOString().slice(0, 10);
    const row = byDay.get(day) ?? { day };
    row[r.productId] = Math.round((r.best / msrp.get(r.productId)! - 1) * 1000) / 10;
    byDay.set(day, row);
  }
  const present = new Set(rows.map((r) => r.productId));
  return {
    data: [...byDay.values()],
    series: tracked.filter((p) => present.has(p.id)).map((p) => ({ id: p.id, name: p.name })),
  };
}

/** Dates de l'extension : sortie, dates de ses produits et premières précommandes relevées. */
export async function getExtensionDates(ext: Extension, products: ExtensionProduct[]) {
  const ids = products.map((p) => p.id);
  const firstSeen = ids.length
    ? await prisma.$queryRaw<{ productId: string; preorder: Date | null; buyable: Date | null }[]>`
        SELECT l."productId",
          MIN(d."date") FILTER (WHERE d."lastAvailability" = 'PREORDER') AS preorder,
          MIN(d."date") FILTER (WHERE d."wasBuyable") AS buyable
        FROM "ListingDaily" d JOIN "Listing" l ON l."id" = d."listingId"
        WHERE l."productId" IN (${Prisma.join(ids)})
        GROUP BY l."productId"`
    : [];
  const seen = new Map(firstSeen.map((r) => [r.productId, r]));
  return {
    release: ext.releaseDate,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      releaseDate: p.releaseDate,
      preorderSeen: seen.get(p.id)?.preorder ?? null,
      buyableSeen: seen.get(p.id)?.buyable ?? null,
    })),
  };
}
