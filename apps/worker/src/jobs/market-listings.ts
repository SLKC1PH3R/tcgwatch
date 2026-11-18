import { prisma } from '@tcgwatch/db';
import { EbayClient, type EbayListing } from '@tcgwatch/market';
import {
  cardmarketUrl,
  formatPrice,
  marketSearchQuery,
  plausibleMarketPrice,
  relevantMarketListing,
  toNumber,
} from '@tcgwatch/shared';
import type { WorkerContext } from '../context';
import { dispatchAlert } from './dispatch';

/** Annonces cherchées jusqu'à ce multiple du bon prix (pour voir aussi celles un peu au-dessus). */
const SEARCH_MARGIN = 1.25;
/** Seules les annonces publiées depuis moins longtemps déclenchent une alerte. */
const FRESH_MS = 6 * 3_600_000;
/** Annonce plus revue depuis ce délai : vendue ou retirée, effacée. */
const STALE_MS = 3 * 86_400_000;
const PAUSE_MS = 1500;

/**
 * Annonces eBay des produits de « Mes produits » (ceux qui ont un bon prix) : neuves, en
 * France, les plus récentes d'abord, et celles avec remise en main propre autour du code
 * postal choisi. Alerte pour toute nouvelle annonce en achat immédiat sous le bon prix
 * (port compris quand il est connu).
 */
export async function runMarketListings(ctx: WorkerContext): Promise<void> {
  const { env } = ctx;
  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) return;
  const client = new EbayClient(env.EBAY_CLIENT_ID, env.EBAY_CLIENT_SECRET);
  const products = await prisma.product.findMany({
    where: { targetPrice: { not: null } },
    select: {
      id: true,
      name: true,
      type: true,
      marketQuery: true,
      targetPrice: true,
      extension: { select: { nameFr: true, setCode: true } },
    },
  });

  const now = Date.now();
  let found = 0;
  let alerts = 0;
  for (const p of products) {
    const target = toNumber(p.targetPrice)!;
    const query = marketSearchQuery(p);
    const search = { query, maxPrice: target * SEARCH_MARGIN };
    try {
      const listings: EbayListing[] = await client.search(search);
      if (env.EBAY_PICKUP_POSTCODE) {
        await new Promise((r) => setTimeout(r, PAUSE_MS));
        const pickup = await client.search({
          ...search,
          pickup: { postalCode: env.EBAY_PICKUP_POSTCODE, radiusKm: env.EBAY_PICKUP_RADIUS_KM },
        });
        const ids = new Set(pickup.map((l) => l.externalId));
        for (const l of listings) if (ids.has(l.externalId)) l.localPickup = true;
        listings.push(
          ...pickup.filter((l) => !listings.some((x) => x.externalId === l.externalId)),
        );
      }

      const relevant = listings.filter(
        (x) =>
          relevantMarketListing(x.title, p) &&
          plausibleMarketPrice(x.price + (x.shipping ?? 0), target),
      );
      for (const l of relevant) {
        const key = { source: 'ebay', externalId: l.externalId, productId: p.id };
        const existing = await prisma.marketListing.findUnique({
          where: { source_externalId_productId: key },
          select: { id: true },
        });
        const data = {
          title: l.title,
          price: l.price,
          shipping: l.shipping,
          currency: l.currency,
          url: l.url,
          imageUrl: l.imageUrl,
          condition: l.condition,
          location: l.location,
          localPickup: l.localPickup,
          auction: l.auction,
          listedAt: l.listedAt,
          lastSeenAt: new Date(),
        };
        await prisma.marketListing.upsert({
          where: { source_externalId_productId: key },
          update: data,
          create: { ...key, ...data },
        });
        if (existing) continue;
        found++;

        const total = l.price + (l.localPickup ? 0 : (l.shipping ?? 0));
        const fresh = !l.listedAt || now - l.listedAt.getTime() < FRESH_MS;
        if (l.auction || total > target || !fresh) continue;
        const ok = await dispatchAlert(ctx, {
          type: 'MARKET_DEAL',
          dedupeKey: `MARKET_DEAL:ebay:${l.externalId}`,
          productId: p.id,
          price: total,
          title: `🛒 eBay sous ton bon prix : ${p.name}`,
          message: `${formatPrice(l.price)}${
            l.localPickup
              ? ' · remise en main propre possible'
              : l.shipping !== null
                ? ` + ${formatPrice(l.shipping)} de port`
                : ''
          }${l.location ? ` · ${l.location}` : ''} (bon prix ${formatPrice(target)}). ${l.title}`,
          url: l.url,
          priority: 'high',
          tags: ['shopping_cart'],
        });
        if (ok) alerts++;
      }
    } catch (err) {
      ctx.logger.warn({ err, product: p.name }, 'Recherche eBay impossible');
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }

  const { count: purged } = await prisma.marketListing.deleteMany({
    where: { lastSeenAt: { lt: new Date(now - STALE_MS) } },
  });
  ctx.logger.info(
    { products: products.length, found, alerts, purged },
    'Annonces eBay de « Mes produits »',
  );
}

/**
 * Cote Cardmarket (« à partir de », toutes langues) passée sous le bon prix d'un produit de
 * « Mes produits » aujourd'hui alors qu'elle était au-dessus au relevé précédent.
 */
export async function checkCardmarketDeals(ctx: WorkerContext, date: Date): Promise<number> {
  const products = await prisma.product.findMany({
    where: { targetPrice: { not: null }, cardmarketId: { not: null } },
    select: {
      id: true,
      name: true,
      targetPrice: true,
      cardmarketName: true,
      cardmarketCategory: true,
      marketPrices: {
        where: { source: 'cardmarket', date: { lte: date } },
        orderBy: { date: 'desc' },
        take: 2,
        select: { date: true, low: true, price: true },
      },
    },
  });
  let sent = 0;
  for (const p of products) {
    const [today, before] = p.marketPrices;
    if (!today || today.date.getTime() !== date.getTime()) continue;
    const target = toNumber(p.targetPrice)!;
    const low = toNumber(today.low);
    if (low === null || low > target) continue;
    const prevLow = before ? toNumber(before.low) : null;
    if (prevLow !== null && prevLow <= target) continue;
    const ok = await dispatchAlert(ctx, {
      type: 'MARKET_DEAL',
      dedupeKey: `MARKET_DEAL:cardmarket:${p.id}:${date.toISOString().slice(0, 10)}`,
      productId: p.id,
      price: low,
      title: `🛒 Cardmarket sous ton bon prix : ${p.name}`,
      message: `Offres à partir de ${formatPrice(low)} (toutes langues), tendance ${formatPrice(
        toNumber(today.price),
      )} · bon prix ${formatPrice(target)}.`,
      url: cardmarketUrl({ name: p.cardmarketName, category: p.cardmarketCategory }, p.name),
      priority: 'high',
      tags: ['shopping_cart'],
    });
    if (ok) sent++;
  }
  return sent;
}
