import 'server-only';
import { prisma } from '@tcgwatch/db';
import { cardmarketQuote, tcgdexAsset, TcgdexClient, type CardmarketQuote } from '@tcgwatch/market';
import { toNumber } from '@tcgwatch/shared';
import { getLocalCard } from './encyclopedia';

export interface CardPoint {
  day: string;
  trend: number | null;
  low: number | null;
  avg7: number | null;
  avg30: number | null;
}

/**
 * Page d'une carte : fiche suivie (historique des cotes en base) et, si possible, la fiche
 * TCGdex du jour (image haute définition, extension, cotes actuelles).
 */
export async function getCardPage(tcgdexId: string) {
  const [tracked, live, local] = await Promise.all([
    prisma.chaseCard.findUnique({
      where: { tcgdexId },
      include: {
        release: { select: { id: true, nameFr: true, setCode: true } },
        prices: { orderBy: { date: 'asc' } },
      },
    }),
    new TcgdexClient().getCard(tcgdexId).catch(() => null),
    getLocalCard(tcgdexId),
  ]);
  if (!tracked && !live && !local) return null;
  // La cote du jour lue sur TCGdex sert aussi de cache à la grille de l'extension.
  const liveQuote = live ? cardmarketQuote(live) : null;
  if (local && live) {
    await prisma.card.update({
      where: { id: local.id },
      data: {
        priceTrend: liveQuote?.trend ?? liveQuote?.price ?? null,
        priceLow: liveQuote?.low ?? null,
        priceAvg30: liveQuote?.avg30 ?? null,
        priceAt: new Date(),
      },
    });
  }

  const history: CardPoint[] = (tracked?.prices ?? []).map((p) => ({
    day: p.date.toISOString().slice(0, 10),
    // Anciens relevés : seule la valeur affichée (tendance) était gardée.
    trend: toNumber(p.trend) ?? toNumber(p.price),
    low: toNumber(p.low),
    avg7: toNumber(p.avg7),
    avg30: toNumber(p.avg30),
  }));
  const last = history.at(-1);
  const current: CardmarketQuote | null = live
    ? liveQuote
    : last && last.trend !== null
      ? { price: last.trend, trend: last.trend, low: last.low, avg7: last.avg7, avg30: last.avg30 }
      : null;

  return {
    tcgdexId,
    name: live?.name ?? local?.name ?? tracked!.name,
    rarity: live?.rarity ?? local?.rarity ?? tracked?.rarity ?? null,
    image:
      tcgdexAsset(live?.image ?? local?.imageUrl ?? undefined, '/high.webp') ??
      tracked?.imageUrl ??
      null,
    setId: live?.set?.id ?? local?.release.tcgdexId ?? null,
    setName: live?.set?.name ?? local?.release.nameFr ?? tracked?.release.nameFr ?? null,
    local,
    tracked: tracked
      ? {
          id: tracked.id,
          manual: tracked.manual,
          alertBelow: toNumber(tracked.alertBelow),
          alertAbove: toNumber(tracked.alertAbove),
        }
      : null,
    current,
    history,
  };
}
