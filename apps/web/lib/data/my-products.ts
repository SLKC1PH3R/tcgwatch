import 'server-only';
import { prisma } from '@tcgwatch/db';
import {
  marketplaceLinks,
  marketSearchQuery,
  toNumber,
  type MarketplaceLink,
} from '@tcgwatch/shared';
import { getSealedPrices, type SealedPrice } from './prices';

export type Verdict = 'shop' | 'cardmarket' | 'close' | 'above' | 'unknown';

export interface MyProduct extends SealedPrice {
  target: number;
  /** Bon prix rapporté au prix public (2,36 = 2,36 fois le prix public). */
  targetVsMsrp: number | null;
  query: string;
  customQuery: string | null;
  /** « À partir de » Cardmarket du dernier relevé (toutes langues). */
  cardmarketLow: number | null;
  links: MarketplaceLink[];
  /** Meilleure source sous le bon prix, sinon proche (≤ +10 %), au-dessus ou inconnu. */
  verdict: Verdict;
  listings: number;
}

export interface MyListing {
  id: string;
  productId: string;
  productName: string;
  target: number;
  title: string;
  price: number;
  shipping: number | null;
  total: number;
  url: string;
  imageUrl: string | null;
  location: string | null;
  localPickup: boolean;
  auction: boolean;
  listedAt: Date | null;
  firstSeenAt: Date;
}

/** Produits avec un bon prix (« Mes produits ») : où en est chaque source par rapport à lui. */
export async function getMyProducts(
  userId: string,
): Promise<{ products: MyProduct[]; listings: MyListing[] }> {
  const watched = await prisma.product.findMany({
    where: { follows: { some: { userId, targetPrice: { not: null } } } },
    select: {
      id: true,
      name: true,
      type: true,
      follows: { where: { userId }, select: { targetPrice: true } },
      marketQuery: true,
      cardmarketName: true,
      cardmarketCategory: true,
      extension: { select: { nameFr: true, setCode: true } },
      marketPrices: {
        where: { source: 'cardmarket' },
        orderBy: { date: 'desc' },
        take: 1,
        select: { low: true },
      },
      marketListings: {
        orderBy: { firstSeenAt: 'desc' },
        take: 30,
        select: {
          id: true,
          title: true,
          price: true,
          shipping: true,
          url: true,
          imageUrl: true,
          location: true,
          localPickup: true,
          auction: true,
          listedAt: true,
          firstSeenAt: true,
        },
      },
    },
  });
  if (watched.length === 0) return { products: [], listings: [] };
  const prices = new Map((await getSealedPrices(watched.map((w) => w.id))).map((p) => [p.id, p]));

  const products: MyProduct[] = [];
  const listings: MyListing[] = [];
  for (const w of watched) {
    const base = prices.get(w.id);
    if (!base) continue;
    const target = toNumber(w.follows[0]!.targetPrice)!;
    const cardmarketLow = toNumber(w.marketPrices[0]?.low);
    const query = marketSearchQuery(w);
    const verdict: Verdict =
      base.bestOffer !== null && base.bestOffer <= target
        ? 'shop'
        : cardmarketLow !== null && cardmarketLow <= target
          ? 'cardmarket'
          : [base.bestOffer, cardmarketLow].some((v) => v !== null && v <= target * 1.1)
            ? 'close'
            : base.bestOffer === null && cardmarketLow === null
              ? 'unknown'
              : 'above';
    products.push({
      ...base,
      target,
      targetVsMsrp: base.msrp ? target / base.msrp : null,
      query,
      customQuery: w.marketQuery,
      cardmarketLow,
      links: marketplaceLinks(query, target, {
        name: w.cardmarketName,
        category: w.cardmarketCategory,
      }),
      verdict,
      listings: w.marketListings.length,
    });
    for (const l of w.marketListings) {
      const price = toNumber(l.price)!;
      const shipping = toNumber(l.shipping);
      listings.push({
        ...l,
        productId: w.id,
        productName: w.name,
        target,
        price,
        shipping,
        total: price + (l.localPickup ? 0 : (shipping ?? 0)),
      });
    }
  }
  const order: Record<Verdict, number> = { shop: 0, cardmarket: 1, close: 2, above: 3, unknown: 4 };
  products.sort((a, b) => order[a.verdict] - order[b.verdict] || a.name.localeCompare(b.name));
  listings.sort((a, b) => b.firstSeenAt.getTime() - a.firstSeenAt.getTime());
  return { products, listings: listings.slice(0, 60) };
}
