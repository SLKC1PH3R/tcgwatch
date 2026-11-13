import 'server-only';
import { prisma } from '@tcgwatch/db';
import { boosterCount, toNumber } from '@tcgwatch/shared';
import { periodStart } from './history';
import { getProductsByIds } from './products';

/** Extension TCGdex d'un produit (Product.extensionId, rempli par le worker à l'import). */
export async function getProductExtension(productId: string) {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      extension: { select: { id: true, nameFr: true, setCode: true, tcgdexId: true } },
    },
  });
  const e = p?.extension;
  return e ? { id: e.id, name: e.nameFr, setCode: e.setCode, code: e.tcgdexId! } : null;
}

/** Produits de la même extension. */
async function productsOfExtension(ext: { id: string }) {
  const ids = await prisma.product.findMany({
    where: { extensionId: ext.id },
    select: { id: true },
  });
  return getProductsByIds(ids.map((p) => p.id));
}

export interface FormatOffer {
  productId: string;
  name: string;
  type: string;
  boosters: number;
  /** Prix de l'offre retenue (livré si le port est connu, sinon prix de l'article). */
  price: number;
  delivered: boolean;
  perBooster: number;
  retailerName: string;
  url: string;
}

/**
 * Comparateur de l'extension : prix par booster de chaque format achetable aujourd'hui
 * (display, ETB, tripack, booster…), du moins cher au plus cher.
 */
export async function getFormatComparison(ext: {
  id: string;
  name: string;
}): Promise<FormatOffer[]> {
  const products = await productsOfExtension(ext);
  const offers: FormatOffer[] = [];
  for (const p of products) {
    const boosters = boosterCount(p.name, p.type);
    if (!boosters || !p.best) continue;
    const price = p.best.delivered ?? p.best.price;
    offers.push({
      productId: p.id,
      name: p.name,
      type: p.type,
      boosters,
      price,
      delivered: p.best.delivered !== null,
      perBooster: price / boosters,
      retailerName: p.best.retailerName,
      url: p.best.url,
    });
  }
  return offers.sort((a, b) => a.perBooster - b.perBooster);
}

/**
 * Indicateur « cartes phares » de l'extension : somme des tendances Cardmarket des cartes
 * phares suivies, jour par jour. Ce n'est pas une valeur attendue à l'ouverture (pas de taux
 * de tirage fiables) : seulement un repère de l'intérêt des cartes de l'extension.
 */
export async function getChaseIndicator(releaseId: string, days: number | null) {
  const cards = await prisma.chaseCard.findMany({
    where: { releaseId },
    select: {
      id: true,
      name: true,
      tcgdexId: true,
      prices: { select: { date: true, trend: true, price: true }, orderBy: { date: 'asc' } },
    },
  });
  if (cards.length === 0) return null;
  const since = periodStart(days);
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const c of cards) {
    for (const p of c.prices) {
      const day = p.date.toISOString().slice(0, 10);
      if (day < since) continue;
      const v = toNumber(p.trend) ?? toNumber(p.price);
      if (v === null) continue;
      const cur = byDay.get(day) ?? { sum: 0, count: 0 };
      cur.sum += v;
      cur.count++;
      byDay.set(day, cur);
    }
  }
  const series = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, { sum, count }]) => ({ day, sum: Math.round(sum * 100) / 100, count }));
  const top = cards
    .map((c) => {
      const last = c.prices.at(-1);
      return {
        name: c.name,
        tcgdexId: c.tcgdexId,
        trend: last ? (toNumber(last.trend) ?? toNumber(last.price)) : null,
      };
    })
    .filter((c): c is typeof c & { trend: number } => c.trend !== null)
    .sort((a, b) => b.trend - a.trend);
  return { cards: cards.length, current: series.at(-1) ?? null, series, top: top.slice(0, 5) };
}
