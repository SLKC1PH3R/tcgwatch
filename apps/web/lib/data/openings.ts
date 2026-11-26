import 'server-only';
import { prisma } from '@tcgwatch/db';
import { tcgdexAsset } from '@tcgwatch/market';
import { toNumber } from '@tcgwatch/shared';

/** Produits qu'on peut ouvrir (scellés liés à une extension). */
export async function getOpenableProducts() {
  return prisma.product.findMany({
    where: {
      OR: [{ extensionId: { not: null } }, { releaseId: { not: null } }],
      type: { notIn: ['DECK', 'AUTRE'] },
    },
    select: {
      id: true,
      name: true,
      type: true,
      extension: { select: { nameFr: true, releaseDate: true } },
    },
    orderBy: [{ extension: { releaseDate: { sort: 'desc', nulls: 'last' } } }, { name: 'asc' }],
  });
}

type CardPrices = { quantity: number; card: { priceTrend: unknown; frPrice: unknown } };

/** Valeur des cartes tirées, au prix Cardmarket et au prix eBay FR (cartes cotées seulement). */
function valueOf(cards: CardPrices[]) {
  let cm = 0;
  let fr = 0;
  let frMissing = 0;
  for (const c of cards) {
    cm += (toNumber(c.card.priceTrend as never) ?? 0) * c.quantity;
    const f = toNumber(c.card.frPrice as never);
    if (f === null) frMissing += c.quantity;
    else fr += f * c.quantity;
  }
  return { cm: round(cm), fr: round(fr), frMissing };
}

const round = (n: number) => Math.round(n * 100) / 100;

const openingInclude = {
  product: {
    select: {
      id: true,
      name: true,
      type: true,
      imageUrl: true,
      release: { select: { tcgdexId: true, nameFr: true } },
    },
  },
  cards: {
    select: {
      cardId: true,
      variant: true,
      quantity: true,
      card: {
        select: {
          name: true,
          localId: true,
          imageUrl: true,
          rarity: true,
          priceTrend: true,
          frPrice: true,
        },
      },
    },
  },
} as const;

export async function getOpenings(userId: string) {
  const rows = await prisma.productOpening.findMany({
    where: { userId },
    include: openingInclude,
    orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map((o) => {
    const value = valueOf(o.cards);
    const hits = [...o.cards]
      .sort((a, b) => (toNumber(b.card.priceTrend) ?? 0) - (toNumber(a.card.priceTrend) ?? 0))
      .slice(0, 4)
      .map((c) => ({
        id: c.cardId,
        name: c.card.name,
        variant: c.variant,
        image: tcgdexAsset(c.card.imageUrl ?? undefined, '/low.webp') ?? null,
        price: toNumber(c.card.priceTrend),
      }));
    return {
      id: o.id,
      product: o.product,
      price: toNumber(o.price)!,
      openedAt: o.openedAt,
      notes: o.notes,
      cards: o.cards.reduce((n, c) => n + c.quantity, 0),
      value,
      hits,
    };
  });
}

export async function getOpening(userId: string, id: string) {
  const o = await prisma.productOpening.findFirst({
    where: { id, userId },
    include: openingInclude,
  });
  if (!o) return null;
  return {
    id: o.id,
    product: o.product,
    price: toNumber(o.price)!,
    openedAt: o.openedAt,
    notes: o.notes,
    value: valueOf(o.cards),
    counts: o.cards.map((c) => ({ cardId: c.cardId, variant: c.variant, quantity: c.quantity })),
  };
}

/**
 * Moyennes par produit, toutes ouvertures confondues (anonymes) : ce qu'un display ou un ETB
 * d'une extension rapporte en moyenne, au prix Cardmarket du jour.
 */
export async function getOpeningStats() {
  const rows = await prisma.productOpening.findMany({
    select: {
      price: true,
      product: { select: { id: true, name: true, type: true } },
      cards: { select: { quantity: true, card: { select: { priceTrend: true, frPrice: true } } } },
    },
  });
  const byProduct = new Map<
    string,
    { name: string; type: string; count: number; price: number; cm: number; fr: number }
  >();
  for (const o of rows) {
    const v = valueOf(o.cards);
    const s = byProduct.get(o.product.id) ?? {
      name: o.product.name,
      type: o.product.type,
      count: 0,
      price: 0,
      cm: 0,
      fr: 0,
    };
    s.count++;
    s.price += toNumber(o.price)!;
    s.cm += v.cm;
    s.fr += v.fr;
    byProduct.set(o.product.id, s);
  }
  return [...byProduct.entries()]
    .map(([id, s]) => ({
      id,
      name: s.name,
      type: s.type,
      count: s.count,
      avgPrice: round(s.price / s.count),
      avgCm: round(s.cm / s.count),
      avgFr: round(s.fr / s.count),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
}
