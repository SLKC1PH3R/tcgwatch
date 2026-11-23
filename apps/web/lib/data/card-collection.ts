import 'server-only';
import { Prisma, prisma } from '@tcgwatch/db';
import { tcgdexAsset } from '@tcgwatch/market';
import { fold, toNumber } from '@tcgwatch/shared';
import type { SetProgress } from '@/lib/card-sets';

/** Carte affichée dans la collection, un classeur ou une vitrine. */
export interface CollectionCard {
  id: string;
  localId: string;
  name: string;
  rarity: string | null;
  image: string | null;
  price: number | null;
  /** Prix en français (médiane des annonces eBay), relevé pour les cartes possédées. */
  frPrice: number | null;
  variants: string[];
  /** Exemplaires possédés, toutes variantes. */
  owned: number;
  /** Exemplaires par variante. */
  byVariant: Record<string, number>;
  release: { code: string; name: string; total: number | null };
}

/** Champs d'une carte, avec les exemplaires possédés par cet utilisateur. */
export const cardSelectFor = (userId: string) =>
  ({
    ...cardFields,
    owned: { where: { userId }, select: { variant: true, quantity: true } },
  }) as const;

const cardFields = {
  id: true,
  localId: true,
  number: true,
  name: true,
  rarity: true,
  imageUrl: true,
  priceTrend: true,
  frPrice: true,
  variants: true,
  release: { select: { tcgdexId: true, nameFr: true, cardCountOfficial: true } },
} as const;

type CardRow = {
  id: string;
  localId: string;
  name: string;
  rarity: string | null;
  imageUrl: string | null;
  priceTrend: unknown;
  frPrice: unknown;
  variants: string[];
  owned: { variant: string; quantity: number }[];
  release: { tcgdexId: string | null; nameFr: string; cardCountOfficial: number | null };
};

export function toCollectionCard(c: CardRow): CollectionCard {
  const byVariant: Record<string, number> = {};
  for (const o of c.owned) byVariant[o.variant] = (byVariant[o.variant] ?? 0) + o.quantity;
  return {
    id: c.id,
    localId: c.localId,
    name: c.name,
    rarity: c.rarity,
    image: tcgdexAsset(c.imageUrl ?? undefined, '/low.webp') ?? null,
    price: toNumber(c.priceTrend as never),
    frPrice: toNumber(c.frPrice as never),
    variants: c.variants,
    owned: c.owned.reduce((n, o) => n + o.quantity, 0),
    byVariant,
    release: {
      code: c.release.tcgdexId ?? '',
      name: c.release.nameFr,
      total: c.release.cardCountOfficial,
    },
  };
}

export interface ReleaseProgress {
  code: string;
  name: string;
  serie: string | null;
  logo: string | null;
  owned: number;
  total: number;
  copies: number;
  value: number;
  progress: SetProgress;
}

/** Vue d'ensemble : valeur, nombre de cartes, avancement par extension, derniers ajouts. */
export async function getCardCollection(userId: string) {
  const [rows, recent] = await Promise.all([
    prisma.$queryRaw<
      {
        releaseId: string;
        code: string | null;
        name: string;
        serie: string | null;
        logo: string | null;
        total: bigint;
        reversible: bigint;
        owned: bigint;
        classic: bigint;
        reverse: bigint;
        copies: bigint;
        value: unknown;
      }[]
    >`
      SELECT r.id AS "releaseId", r."tcgdexId" AS code, r."nameFr" AS name,
        s.name AS serie, r."imageUrl" AS logo,
        (SELECT count(*) FROM "Card" x WHERE x."releaseId" = r.id) AS total,
        (SELECT count(*) FROM "Card" x WHERE x."releaseId" = r.id AND 'reverse' = ANY(x.variants)) AS reversible,
        count(DISTINCT o."cardId") AS owned,
        count(DISTINCT o."cardId") FILTER (WHERE o.variant <> 'reverse' AND o.quantity > 0) AS classic,
        count(DISTINCT o."cardId") FILTER (WHERE o.variant = 'reverse' AND o.quantity > 0 AND 'reverse' = ANY(c.variants)) AS reverse,
        sum(o.quantity) AS copies,
        sum(o.quantity * coalesce(c."priceTrend", 0)) AS value
      FROM "OwnedCard" o JOIN "Card" c ON c.id = o."cardId" JOIN "Release" r ON r.id = c."releaseId"
      LEFT JOIN "Serie" s ON s.id = r."serieId"
      WHERE o."userId" = ${userId}
      GROUP BY r.id, s.name
      ORDER BY max(o."updatedAt") DESC`,
    prisma.ownedCard.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 12,
      select: { card: { select: cardSelectFor(userId) } },
    }),
  ]);
  const releases: ReleaseProgress[] = rows.map((r) => ({
    code: r.code ?? '',
    name: r.name,
    serie: r.serie,
    logo: r.logo,
    owned: Number(r.owned),
    total: Number(r.total),
    copies: Number(r.copies),
    value: toNumber(r.value as never) ?? 0,
    progress: {
      full: { owned: Number(r.classic), total: Number(r.total) },
      master:
        Number(r.reversible) > 0
          ? {
              owned: Number(r.classic) + Number(r.reverse),
              total: Number(r.total) + Number(r.reversible),
            }
          : null,
    },
  }));
  const seen = new Set<string>();
  const latest = recent
    .map((o) => toCollectionCard(o.card))
    .filter((c) => !seen.has(c.id) && seen.add(c.id));
  return {
    releases,
    latest,
    distinct: releases.reduce((n, r) => n + r.owned, 0),
    copies: releases.reduce((n, r) => n + r.copies, 0),
    value: releases.reduce((n, r) => n + r.value, 0),
  };
}

/** Extensions avec des cartes, pour les listes de choix (plus récentes d'abord). */
export async function getCardReleases() {
  return prisma.release.findMany({
    where: { tcgdexId: { not: null }, cards: { some: {} } },
    select: {
      id: true,
      tcgdexId: true,
      nameFr: true,
      releaseDate: true,
      imageUrl: true,
      symbolUrl: true,
      serieRef: { select: { name: true, logoUrl: true } },
    },
    orderBy: [{ releaseDate: { sort: 'desc', nulls: 'last' } }, { nameFr: 'asc' }],
  });
}

/** Toutes les cartes d'une extension avec les exemplaires possédés. */
export async function getReleaseCards(userId: string, code: string) {
  const release = await prisma.release.findUnique({
    where: { tcgdexId: code },
    select: { id: true, tcgdexId: true, nameFr: true, cardCountOfficial: true },
  });
  if (!release) return null;
  const cards = await prisma.card.findMany({
    where: { releaseId: release.id },
    orderBy: [{ number: { sort: 'asc', nulls: 'last' } }, { localId: 'asc' }],
    select: cardSelectFor(userId),
  });
  return { release, cards: cards.map(toCollectionCard) };
}

/** Recherche de cartes par nom (toutes extensions), pour les classeurs et vitrines. */
export async function searchCards(userId: string, q: string, onlyOwned = false, take = 36) {
  const words = fold(q)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return [];
  // Sans accents des deux côtés : « evoli » trouve « Évoli ».
  const folded = Prisma.sql`translate(lower(c.name), 'àâäáãéèêëíìîïóòôöõúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')`;
  const ids = await prisma.$queryRaw<{ id: string }[]>`
    SELECT c.id FROM "Card" c
    WHERE ${Prisma.join(
      words.map((w) => Prisma.sql`${folded} LIKE ${`%${w}%`}`),
      ' AND ',
    )}
    ${onlyOwned ? Prisma.sql`AND EXISTS (SELECT 1 FROM "OwnedCard" o WHERE o."cardId" = c.id AND o."userId" = ${userId})` : Prisma.empty}
    ORDER BY c."priceTrend" DESC NULLS LAST LIMIT ${take}`;
  const cards = await prisma.card.findMany({
    where: { id: { in: ids.map((i) => i.id) } },
    select: cardSelectFor(userId),
  });
  const order = new Map(ids.map((i, n) => [i.id, n]));
  return cards.sort((a, b) => order.get(a.id)! - order.get(b.id)!).map(toCollectionCard);
}

export async function getBinders(userId: string) {
  const binders = await prisma.cardBinder.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      release: {
        select: {
          id: true,
          tcgdexId: true,
          nameFr: true,
          imageUrl: true,
          symbolUrl: true,
          serieRef: { select: { logoUrl: true } },
        },
      },
      _count: { select: { cards: true } },
    },
  });
  // Avancement des classeurs d'extension : cartes possédées / cartes de l'extension.
  const releaseIds = binders.flatMap((b) => (b.release ? [b.release.id] : []));
  const counts = releaseIds.length
    ? await prisma.$queryRaw<
        { releaseId: string; total: bigint; reversible: bigint; classic: bigint; reverse: bigint }[]
      >`
        SELECT c."releaseId", count(*) AS total,
          count(*) FILTER (WHERE 'reverse' = ANY(c.variants)) AS reversible,
          count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "OwnedCard" o WHERE o."cardId" = c.id AND o."userId" = ${userId} AND o.variant <> 'reverse' AND o.quantity > 0)) AS classic,
          count(*) FILTER (WHERE 'reverse' = ANY(c.variants) AND EXISTS (SELECT 1 FROM "OwnedCard" o WHERE o."cardId" = c.id AND o."userId" = ${userId} AND o.variant = 'reverse' AND o.quantity > 0)) AS reverse
        FROM "Card" c WHERE c."releaseId" = ANY(${releaseIds}) GROUP BY 1`
    : [];
  const byRelease = new Map(counts.map((c) => [c.releaseId, c]));
  const customOwned = await prisma.binderCard.groupBy({
    by: ['binderId'],
    where: { binder: { userId }, card: { owned: { some: { userId } } } },
    _count: true,
  });
  const ownedByBinder = new Map(customOwned.map((c) => [c.binderId, c._count]));
  return binders.map((b) => {
    const r = b.release ? byRelease.get(b.release.id) : undefined;
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      release: b.release,
      progress: (r
        ? {
            full: { owned: Number(r.classic), total: Number(r.total) },
            master:
              Number(r.reversible) > 0
                ? {
                    owned: Number(r.classic) + Number(r.reverse),
                    total: Number(r.total) + Number(r.reversible),
                  }
                : null,
          }
        : {
            full: { owned: ownedByBinder.get(b.id) ?? 0, total: b._count.cards },
            master: null,
          }) satisfies SetProgress,
    };
  });
}

export async function getBinder(userId: string, id: string) {
  const binder = await prisma.cardBinder.findFirst({
    where: { id, userId },
    select: {
      id: true,
      name: true,
      description: true,
      release: { select: { tcgdexId: true, nameFr: true } },
      cards: {
        orderBy: { position: 'asc' },
        select: { card: { select: cardSelectFor(userId) } },
      },
    },
  });
  if (!binder) return null;
  const cards = binder.release
    ? ((await getReleaseCards(userId, binder.release.tcgdexId!))?.cards ?? [])
    : binder.cards.map((b) => toCollectionCard(b.card));
  return { ...binder, cards };
}

export async function getShowcases(userId: string) {
  return prisma.showcase.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      slug: true,
      public: true,
      showPrices: true,
      wanted: true,
      cards: {
        orderBy: { position: 'asc' },
        take: 4,
        select: { card: { select: { imageUrl: true } } },
      },
      _count: { select: { cards: true } },
    },
  });
}

/** Vitrine d'un utilisateur (par id) ou vitrine publique (par slug, cartes de son auteur). */
export async function getShowcase(where: { id: string; userId: string } | { slug: string }) {
  const s = await prisma.showcase.findFirst({
    where,
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      slug: true,
      public: true,
      showPrices: true,
      wanted: true,
      updatedAt: true,
      cards: {
        orderBy: { position: 'asc' },
        select: {
          card: {
            select: {
              ...cardFields,
              owned: { select: { userId: true, variant: true, quantity: true } },
            },
          },
        },
      },
    },
  });
  if (!s) return null;
  return {
    ...s,
    cards: s.cards.map((c) =>
      toCollectionCard({ ...c.card, owned: c.card.owned.filter((o) => o.userId === s.userId) }),
    ),
  };
}
