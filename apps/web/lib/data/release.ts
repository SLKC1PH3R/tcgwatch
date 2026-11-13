import 'server-only';
import { prisma } from '@tcgwatch/db';
import { boosterCount, extensionOf, toNumber } from '@tcgwatch/shared';
import { periodStart } from './history';
import { getProductsByIds } from './products';

/**
 * Extension (fiche TCGdex du calendrier, celle qui porte les cartes phares) d'un produit.
 * Le catalogue Pokécardex crée une entrée de calendrier par produit : le lien se fait donc
 * par le nom de l'extension cité dans le nom du produit.
 */
export async function getExtension(productName: string) {
  const sets = await prisma.release.findMany({
    where: { tcgdexId: { not: null } },
    select: { id: true, nameFr: true, setCode: true },
  });
  return extensionOf(
    productName,
    sets.map((s) => ({ ...s, name: s.nameFr })),
  );
}

/** Produits de la même extension (même extension résolue par le nom). */
async function productsOfExtension(ext: { id: string; name: string }) {
  // Noms seulement (quelques centaines de lignes) : le rapprochement se fait sans accents.
  const [candidates, sets] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true } }),
    prisma.release.findMany({
      where: { tcgdexId: { not: null } },
      select: { id: true, nameFr: true },
    }),
  ]);
  const named = sets.map((s) => ({ id: s.id, name: s.nameFr }));
  const ids = candidates.filter((p) => extensionOf(p.name, named)?.id === ext.id).map((p) => p.id);
  return getProductsByIds(ids);
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
