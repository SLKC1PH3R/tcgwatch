import 'server-only';
import { prisma } from '@tcgwatch/db';
import { cardmarketQuote, tcgdexAsset, TcgdexClient, type CardmarketQuote } from '@tcgwatch/market';
import { toNumber } from '@tcgwatch/shared';

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
  const [tracked, live] = await Promise.all([
    prisma.chaseCard.findUnique({
      where: { tcgdexId },
      include: {
        release: { select: { id: true, nameFr: true, setCode: true } },
        prices: { orderBy: { date: 'asc' } },
      },
    }),
    new TcgdexClient().getCard(tcgdexId).catch(() => null),
  ]);
  if (!tracked && !live) return null;

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
    ? cardmarketQuote(live)
    : last && last.trend !== null
      ? { price: last.trend, trend: last.trend, low: last.low, avg7: last.avg7, avg30: last.avg30 }
      : null;

  return {
    tcgdexId,
    name: live?.name ?? tracked!.name,
    rarity: live?.rarity ?? tracked?.rarity ?? null,
    image: tcgdexAsset(live?.image, '/high.webp') ?? tracked?.imageUrl ?? null,
    setId: live?.set?.id ?? null,
    setName: live?.set?.name ?? tracked?.release.nameFr ?? null,
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
