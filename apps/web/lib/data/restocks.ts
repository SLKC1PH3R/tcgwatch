import 'server-only';
import { prisma, type Prisma } from '@tcgwatch/db';
import { isBuyable, toNumber, type Availability } from '@tcgwatch/shared';
import { bestOffer, getProductsByIds, type ListingDTO } from './products';

/** Événements listés : retour en stock, et ouverture des précommandes si demandé. */
export type RestockKind = 'stock' | 'precommandes' | 'tout';

export interface RestockFilters {
  days: number;
  kind: RestockKind;
  /** Seulement les fiches encore achetables aujourd'hui. */
  available: boolean;
}

export interface RestockOther {
  listingId: string;
  retailerName: string;
  url: string;
  availability: Availability;
  price: number | null;
  delivered: number | null;
}

export interface RestockRow {
  id: string;
  type: 'BACK_IN_STOCK' | 'PREORDER_OPEN';
  at: Date;
  /** Prix relevé au moment du retour en stock. */
  price: number | null;
  product: { id: string; name: string; type: string; image: string | null; msrp: number | null };
  /** Fiche revendeur concernée, dans son état actuel. */
  listing: ListingDTO | null;
  /** Disponibilité actuelle du produit sur les autres sites suivis (achetables d'abord). */
  others: RestockOther[];
  /** Meilleure offre achetable actuelle, tous sites confondus. */
  best: { retailerName: string; price: number; delivered: number | null; url: string } | null;
}

/**
 * Retours en stock (et ouvertures de précommande) relevés par le worker, du plus récent au
 * plus ancien, avec l'état actuel de la fiche concernée et des autres sites qui vendent le
 * même produit.
 */
export async function getRestocks(filters: RestockFilters, limit = 300) {
  const since = new Date(Date.now() - filters.days * 86_400_000);
  const types: RestockRow['type'][] =
    filters.kind === 'stock'
      ? ['BACK_IN_STOCK']
      : filters.kind === 'precommandes'
        ? ['PREORDER_OPEN']
        : ['BACK_IN_STOCK', 'PREORDER_OPEN'];
  const where: Prisma.AlertEventWhereInput = {
    type: { in: types },
    productId: { not: null },
    createdAt: { gte: since },
  };
  const events = await prisma.alertEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      createdAt: true,
      price: true,
      productId: true,
      listingId: true,
    },
  });
  const products = new Map(
    (await getProductsByIds([...new Set(events.map((e) => e.productId!))])).map((p) => [p.id, p]),
  );

  const rows: RestockRow[] = [];
  for (const e of events) {
    const p = products.get(e.productId!);
    if (!p) continue;
    const listing = p.listings.find((l) => l.id === e.listingId) ?? null;
    if (filters.available && !(listing && isBuyable(listing.availability))) continue;
    const others = p.listings
      .filter((l) => l.id !== e.listingId && l.state !== 'PAUSED')
      .map((l) => ({
        listingId: l.id,
        retailerName: l.retailerName,
        url: l.url,
        availability: l.availability,
        price: l.price,
        delivered: l.delivered,
      }))
      .sort(
        (a, b) =>
          Number(isBuyable(b.availability)) - Number(isBuyable(a.availability)) ||
          (a.delivered ?? a.price ?? Infinity) - (b.delivered ?? b.price ?? Infinity),
      );
    const best = bestOffer(p.listings);
    rows.push({
      id: e.id,
      type: e.type as RestockRow['type'],
      at: e.createdAt,
      price: toNumber(e.price),
      product: { id: p.id, name: p.name, type: p.type, image: p.displayImage, msrp: p.msrp },
      listing,
      others,
      best: best
        ? {
            retailerName: best.retailerName,
            price: best.price,
            delivered: best.delivered,
            url: best.url,
          }
        : null,
    });
  }
  return rows;
}
