import 'server-only';
import { dedupeImages } from '@tcgwatch/adapters';
import { prisma, type Prisma } from '@tcgwatch/db';
import { isBuyable, toNumber, type Availability } from '@tcgwatch/shared';

const productInclude = {
  release: { select: { id: true, nameFr: true, setCode: true, releaseDate: true } },
  listings: {
    include: { retailer: { select: { id: true, name: true, slug: true, websiteUrl: true } } },
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
  retailerId: string;
  imageUrl: string | null;
  sku: string | null;
  category: string | null;
  discovered: boolean;
}

export interface ProductDTO {
  id: string;
  name: string;
  slug: string;
  externalId: string | null;
  type: string;
  ean: string | null;
  imageUrl: string | null;
  /** Image affichée : saisie, sinon galerie, sinon image d'une fiche revendeur. */
  displayImage: string | null;
  images: string[];
  description: string | null;
  brand: string | null;
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
    retailerId: l.retailer.id,
    imageUrl: l.lastImageUrl,
    sku: l.sku,
    category: l.category,
    discovered: l.discovered,
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
    externalId: p.externalId,
    type: p.type,
    ean: p.ean,
    imageUrl: p.imageUrl,
    displayImage: p.imageUrl ?? p.images[0] ?? listings.find((l) => l.imageUrl)?.imageUrl ?? null,
    images: dedupeImages(
      [p.imageUrl, ...p.images, ...listings.map((l) => l.imageUrl)].filter((u): u is string => !!u),
    ),
    description: p.description,
    brand: p.brand,
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
