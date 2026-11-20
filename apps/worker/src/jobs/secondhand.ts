import { prisma } from '@tcgwatch/db';
import { EbayClient, type EbayListing } from '@tcgwatch/market';
import {
  marketSearchQuery,
  plausibleMarketPrice,
  relevantMarketListing,
  todayUtc,
  toNumber,
} from '@tcgwatch/shared';
import type { WorkerContext } from '../context';

/** En dessous, la médiane ne veut rien dire : pas de point ce jour-là. */
export const MIN_LISTINGS = 3;
const PAUSE_MS = 1500;

export interface SecondhandStats {
  median: number;
  low: number;
  count: number;
}

/**
 * Résumé des prix d'occasion d'un produit : médiane et plus bas des annonces en achat
 * immédiat, port compris. Les annonces hors de [médiane / 2, médiane × 2] (lots, erreurs de
 * saisie, prix « d'appel ») sont écartées avant le calcul final.
 */
export function secondhandStats(totals: number[]): SecondhandStats | null {
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  };
  const valid = totals.filter((t) => Number.isFinite(t) && t > 0);
  if (valid.length < MIN_LISTINGS) return null;
  const rough = median(valid);
  const kept = valid.filter((t) => t >= rough / 2 && t <= rough * 2);
  if (kept.length < MIN_LISTINGS) return null;
  const round = (n: number) => Math.round(n * 100) / 100;
  return { median: round(median(kept)), low: round(Math.min(...kept)), count: kept.length };
}

/** Prix total d'une annonce en achat immédiat (port compris quand il est connu). */
export function listingTotal(l: Pick<EbayListing, 'price' | 'shipping'>): number {
  return l.price + (l.shipping ?? 0);
}

/**
 * Une fois par jour et par produit (Mes produits et produits de la collection) : recherche eBay
 * sans plafond de prix, puis médiane des annonces pertinentes. Alimente la courbe « Occasion ».
 */
export async function runSecondhandPrices(ctx: WorkerContext): Promise<void> {
  const { env } = ctx;
  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) return;
  const client = new EbayClient(env.EBAY_CLIENT_ID, env.EBAY_CLIENT_SECRET);
  const date = todayUtc();
  const products = await prisma.product.findMany({
    where: {
      OR: [{ targetPrice: { not: null } }, { collection: { some: {} } }],
      secondhandDaily: { none: { source: 'ebay', date } },
    },
    select: {
      id: true,
      name: true,
      type: true,
      marketQuery: true,
      msrp: true,
      targetPrice: true,
      extension: { select: { nameFr: true, setCode: true } },
    },
  });

  let saved = 0;
  for (const p of products) {
    const reference = toNumber(p.targetPrice) ?? toNumber(p.msrp);
    try {
      const listings = await client.search({ query: marketSearchQuery(p), limit: 100 });
      const totals = listings
        .filter(
          (l) =>
            !l.auction &&
            relevantMarketListing(l.title, p) &&
            (reference === null || plausibleMarketPrice(listingTotal(l), reference)),
        )
        .map(listingTotal);
      const stats = secondhandStats(totals);
      if (stats) {
        await prisma.secondhandDaily.upsert({
          where: { productId_source_date: { productId: p.id, source: 'ebay', date } },
          update: stats,
          create: { productId: p.id, source: 'ebay', date, ...stats },
        });
        saved++;
      }
    } catch (err) {
      ctx.logger.warn({ err, product: p.name }, 'Prix d’occasion eBay impossible');
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  ctx.logger.info({ products: products.length, saved }, 'Prix d’occasion eBay relevés');
}
