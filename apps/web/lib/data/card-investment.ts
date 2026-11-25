import 'server-only';
import { prisma } from '@tcgwatch/db';
import { tcgdexAsset } from '@tcgwatch/market';
import { toNumber } from '@tcgwatch/shared';

const round = (n: number) => Math.round(n * 100) / 100;

export interface Valued {
  /** Prix payé. */
  paid: number;
  /** Valeur actuelle à la cote Cardmarket (toutes langues). */
  cm: number;
  /** Valeur actuelle au prix eBay FR (cartes relevées seulement). */
  fr: number;
}

/**
 * Investissement en cartes : lots (achats groupés couvrant des extensions), cartes achetées à
 * l'unité (prix par exemplaire) et cartes sans prix d'achat connu. Une carte avec un prix à
 * l'unité compte à part, même si son extension est couverte par un lot.
 */
export async function getCardInvestment(userId: string) {
  const [owned, lots] = await Promise.all([
    prisma.ownedCard.findMany({
      where: { userId, quantity: { gt: 0 } },
      select: {
        id: true,
        variant: true,
        quantity: true,
        purchasePrice: true,
        purchasedAt: true,
        card: {
          select: {
            id: true,
            name: true,
            localId: true,
            imageUrl: true,
            priceTrend: true,
            frPrice: true,
            release: { select: { tcgdexId: true, nameFr: true } },
          },
        },
      },
    }),
    prisma.cardLot.findMany({ where: { userId }, orderBy: { purchasedAt: 'desc' } }),
  ]);

  const valueOf = (o: (typeof owned)[number]) => ({
    cm: (toNumber(o.card.priceTrend) ?? 0) * o.quantity,
    fr: (toNumber(o.card.frPrice) ?? 0) * o.quantity,
  });

  const singles = owned
    .filter((o) => o.purchasePrice !== null)
    .map((o) => {
      const v = valueOf(o);
      const unit = toNumber(o.purchasePrice)!;
      return {
        id: o.id,
        cardId: o.card.id,
        name: o.card.name,
        localId: o.card.localId,
        release: o.card.release.nameFr,
        image: tcgdexAsset(o.card.imageUrl ?? undefined, '/low.webp') ?? null,
        variant: o.variant,
        quantity: o.quantity,
        unitPrice: unit,
        purchasedAt: o.purchasedAt,
        paid: round(unit * o.quantity),
        cm: round(v.cm),
        fr: round(v.fr),
      };
    })
    .sort((a, b) => b.cm - b.paid - (a.cm - a.paid));

  // Cartes sans prix à l'unité : rattachées au premier lot qui couvre leur extension.
  const lotRows = lots.map((l) => ({
    id: l.id,
    name: l.name,
    notes: l.notes,
    purchasedAt: l.purchasedAt,
    releases: l.releases,
    paid: toNumber(l.price)!,
    cm: 0,
    fr: 0,
    copies: 0,
  }));
  const unpriced = { cm: 0, fr: 0, copies: 0 };
  for (const o of owned) {
    if (o.purchasePrice !== null) continue;
    const v = valueOf(o);
    const lot = lotRows.find(
      (l) => o.card.release.tcgdexId && l.releases.includes(o.card.release.tcgdexId),
    );
    const target = lot ?? unpriced;
    target.cm += v.cm;
    target.fr += v.fr;
    target.copies += o.quantity;
  }
  for (const l of lotRows) {
    l.cm = round(l.cm);
    l.fr = round(l.fr);
  }

  const sum = (rows: { paid: number; cm: number; fr: number }[]): Valued => ({
    paid: round(rows.reduce((n, r) => n + r.paid, 0)),
    cm: round(rows.reduce((n, r) => n + r.cm, 0)),
    fr: round(rows.reduce((n, r) => n + r.fr, 0)),
  });
  const covered = sum([...lotRows, ...singles]);
  return {
    lots: lotRows,
    singles,
    unpriced: { cm: round(unpriced.cm), fr: round(unpriced.fr), copies: unpriced.copies },
    /** Investi et valeur des cartes dont le prix d'achat est connu (lot ou unité). */
    covered,
    singlesTotal: sum(singles),
  };
}

export interface CardValuePoint {
  day: string;
  /** Valeur des cartes possédées ce jour-là, cote Cardmarket du jour (toutes langues). */
  cm: number;
  /** Valeur au prix eBay FR du jour (cartes déjà relevées). */
  fr: number;
  /** Total investi à cette date : lots et cartes achetées à l'unité. */
  invested: number;
}

/**
 * Valeur de la collection de cartes jour par jour, avec les cotes de chaque jour (historique
 * quotidien) : une carte compte à partir de son achat (ou de son ajout), au dernier prix connu
 * à cette date — à défaut le premier prix connu, pour ne pas créer de creux avant le premier
 * relevé. L'investi suit les dates des lots et des achats à l'unité.
 */
export async function getCardValueHistory(
  userId: string,
  days = 5 * 366,
): Promise<CardValuePoint[]> {
  const [owned, lots] = await Promise.all([
    prisma.ownedCard.findMany({
      where: { userId, quantity: { gt: 0 } },
      select: {
        cardId: true,
        quantity: true,
        createdAt: true,
        purchasePrice: true,
        purchasedAt: true,
        card: { select: { priceTrend: true, frPrice: true } },
      },
    }),
    prisma.cardLot.findMany({ where: { userId }, select: { price: true, purchasedAt: true } }),
  ]);
  if (owned.length === 0 && lots.length === 0) return [];
  const ids = [...new Set(owned.map((o) => o.cardId))];
  const daily = await prisma.cardPriceDaily.findMany({
    where: { cardId: { in: ids } },
    select: { cardId: true, date: true, trend: true, frPrice: true },
    orderBy: { date: 'asc' },
  });
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const trendBy = new Map<string, Map<string, number>>();
  const frBy = new Map<string, Map<string, number>>();
  for (const d of daily) {
    const t = toNumber(d.trend);
    const f = toNumber(d.frPrice);
    if (t !== null) trendBy.set(d.cardId, (trendBy.get(d.cardId) ?? new Map()).set(key(d.date), t));
    if (f !== null) frBy.set(d.cardId, (frBy.get(d.cardId) ?? new Map()).set(key(d.date), f));
  }
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const acquired = (o: (typeof owned)[number]) => (o.purchasedAt ?? o.createdAt).getTime();
  const first = Math.min(...owned.map(acquired), ...lots.map((l) => l.purchasedAt.getTime()));
  const start = Math.max(
    Date.UTC(
      new Date(first).getUTCFullYear(),
      new Date(first).getUTCMonth(),
      new Date(first).getUTCDate(),
    ),
    today.getTime() - days * 86_400_000,
  );

  // Prix de départ : dernier prix avant la fenêtre, sinon premier prix connu, sinon prix actuel.
  const startKey = key(new Date(start));
  const seed = (by: Map<string, Map<string, number>>, id: string, current: number | null) => {
    const series = [...(by.get(id) ?? new Map<string, number>())];
    const before = series.filter(([k]) => k < startKey).at(-1);
    return before?.[1] ?? series[0]?.[1] ?? current;
  };
  const lastCm = new Map<string, number | null>();
  const lastFr = new Map<string, number | null>();
  for (const o of owned) {
    lastCm.set(o.cardId, seed(trendBy, o.cardId, toNumber(o.card.priceTrend)));
    lastFr.set(o.cardId, seed(frBy, o.cardId, toNumber(o.card.frPrice)));
  }

  const points: CardValuePoint[] = [];
  for (let t = start; t <= today.getTime(); t += 86_400_000) {
    const k = key(new Date(t));
    for (const id of ids) {
      const c = trendBy.get(id)?.get(k);
      if (c !== undefined) lastCm.set(id, c);
      const f = frBy.get(id)?.get(k);
      if (f !== undefined) lastFr.set(id, f);
    }
    let cm = 0;
    let fr = 0;
    let invested = 0;
    for (const o of owned) {
      if (acquired(o) > t + 86_399_999) continue;
      cm += (lastCm.get(o.cardId) ?? 0) * o.quantity;
      fr += (lastFr.get(o.cardId) ?? 0) * o.quantity;
      if (o.purchasePrice !== null) invested += toNumber(o.purchasePrice)! * o.quantity;
    }
    for (const l of lots) if (l.purchasedAt.getTime() <= t) invested += toNumber(l.price)!;
    points.push({ day: k, cm: round(cm), fr: round(fr), invested: round(invested) });
  }
  return points;
}
