import 'server-only';
import { prisma, type Prisma } from '@tcgwatch/db';
import { isBuyable, toNumber, type Availability } from '@tcgwatch/shared';

const productInclude = {
  release: { select: { id: true, nameFr: true, setCode: true, releaseDate: true } },
  listings: {
    include: { retailer: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export interface ListingDTO {
  id: string;
  url: string;
  stockAlertUrl: string | null;
  retailerName: string;
  retailerSlug: string;
  availability: Availability;
  price: number | null;
  targetPrice: number | null;
  checkIntervalMin: number;
  state: string;
  lastCheckedAt: Date | null;
  lastInStockAt: Date | null;
  lastError: string | null;
  consecutiveErrors: number;
  title: string | null;
}

export interface ProductDTO {
  id: string;
  name: string;
  slug: string;
  type: string;
  ean: string | null;
  imageUrl: string | null;
  msrp: number | null;
  targetPrice: number | null;
  releaseDate: Date | null;
  notes: string | null;
  release: { id: string; nameFr: string; setCode: string | null; releaseDate: Date | null } | null;
  listings: ListingDTO[];
  /** Meilleur prix parmi les offres achetables (en stock / précommande). */
  best: {
    price: number;
    listingId: string;
    retailerName: string;
    url: string;
    availability: Availability;
  } | null;
}

function toListingDTO(l: ProductRow['listings'][number]): ListingDTO {
  return {
    id: l.id,
    url: l.url,
    stockAlertUrl: l.stockAlertUrl,
    retailerName: l.retailer.name,
    retailerSlug: l.retailer.slug,
    availability: l.lastAvailability,
    price: toNumber(l.lastPrice),
    targetPrice: toNumber(l.targetPrice),
    checkIntervalMin: l.checkIntervalMin,
    state: l.state,
    lastCheckedAt: l.lastCheckedAt,
    lastInStockAt: l.lastInStockAt,
    lastError: l.lastError,
    consecutiveErrors: l.consecutiveErrors,
    title: l.lastTitle,
  };
}

export function bestOffer(listings: ListingDTO[]): ProductDTO['best'] {
  let best: ProductDTO['best'] = null;
  for (const l of listings) {
    if (l.price === null || !isBuyable(l.availability) || l.state === 'PAUSED') continue;
    if (!best || l.price < best.price) {
      best = {
        price: l.price,
        listingId: l.id,
        retailerName: l.retailerName,
        url: l.url,
        availability: l.availability,
      };
    }
  }
  return best;
}

function toProductDTO(p: ProductRow): ProductDTO {
  const listings = p.listings.map(toListingDTO);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    type: p.type,
    ean: p.ean,
    imageUrl: p.imageUrl,
    msrp: toNumber(p.msrp),
    targetPrice: toNumber(p.targetPrice),
    releaseDate: p.releaseDate,
    notes: p.notes,
    release: p.release,
    listings,
    best: bestOffer(listings),
  };
}

export async function getProducts(): Promise<ProductDTO[]> {
  const rows = await prisma.product.findMany({
    include: productInclude,
    orderBy: [{ release: { releaseDate: 'desc' } }, { name: 'asc' }],
  });
  return rows.map(toProductDTO);
}

export async function getProduct(id: string): Promise<ProductDTO | null> {
  const row = await prisma.product.findUnique({ where: { id }, include: productInclude });
  return row ? toProductDTO(row) : null;
}

export async function getProductOptions() {
  return prisma.product.findMany({
    select: { id: true, name: true, type: true },
    orderBy: { name: 'asc' },
  });
}

export async function getReleaseOptions() {
  return prisma.release.findMany({
    select: { id: true, nameFr: true, setCode: true, productType: true },
    orderBy: [{ releaseDate: { sort: 'desc', nulls: 'first' } }],
  });
}

/** Historique pour graphique : prix par revendeur + prix marché, une valeur par jour. */
export async function getPriceHistory(productId: string, days = 90) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [snapshots, market, purchases] = await Promise.all([
    prisma.snapshot.findMany({
      where: { listing: { productId }, createdAt: { gte: since }, price: { not: null } },
      select: {
        createdAt: true,
        price: true,
        availability: true,
        listing: { select: { retailer: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.marketPrice.findMany({
      where: { productId, date: { gte: since } },
      select: { date: true, price: true, source: true },
      orderBy: { date: 'asc' },
    }),
    prisma.collectionItem.findMany({
      where: { productId },
      select: { quantity: true, purchasePrice: true },
    }),
  ]);

  // Agrège par jour : dernier prix connu de chaque revendeur ce jour-là.
  const byDay = new Map<string, Record<string, number | string>>();
  const series = new Set<string>();
  for (const s of snapshots) {
    const day = s.createdAt.toISOString().slice(0, 10);
    const key = s.listing.retailer.name;
    series.add(key);
    const row = byDay.get(day) ?? { day };
    row[key] = toNumber(s.price)!;
    byDay.set(day, row);
  }
  for (const m of market) {
    const day = m.date.toISOString().slice(0, 10);
    const key = 'Marché';
    series.add(key);
    const row = byDay.get(day) ?? { day };
    row[key] = toNumber(m.price)!;
    byDay.set(day, row);
  }

  const qty = purchases.reduce((s, p) => s + p.quantity, 0);
  const avgPurchase = qty
    ? purchases.reduce((s, p) => s + p.quantity * toNumber(p.purchasePrice)!, 0) / qty
    : null;
  const lastMarket = market.length ? toNumber(market[market.length - 1]!.price) : null;

  return {
    data: [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day))),
    series: [...series],
    avgPurchase,
    lastMarket,
    ratio: avgPurchase && lastMarket ? lastMarket / avgPurchase : null,
  };
}
