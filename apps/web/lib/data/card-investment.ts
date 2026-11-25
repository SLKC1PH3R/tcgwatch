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
