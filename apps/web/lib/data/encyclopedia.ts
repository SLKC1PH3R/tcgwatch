import 'server-only';
import { Prisma, prisma } from '@tcgwatch/db';
import { tcgdexAsset } from '@tcgwatch/market';
import { queryWords, toNumber } from '@tcgwatch/shared';

/** Séries hors générations principales : regroupées en fin d'encyclopédie. */
const SIDE_SERIES = new Set(['misc', 'pop', 'tk', 'mc']);

/**
 * Encyclopédie : générations de la plus récente à la plus ancienne (ordre TCGdex), puis promos,
 * kits du dresseur et collections McDonald's. Extensions de chaque série par date décroissante.
 */
export async function getSeries() {
  const series = await prisma.serie.findMany({
    orderBy: { order: 'desc' },
    include: {
      releases: {
        where: { tcgdexId: { not: null } },
        orderBy: [{ releaseDate: { sort: 'desc', nulls: 'first' } }, { nameFr: 'asc' }],
        select: {
          id: true,
          tcgdexId: true,
          nameFr: true,
          setCode: true,
          releaseDate: true,
          imageUrl: true,
          symbolUrl: true,
          cardCountOfficial: true,
          cardCountTotal: true,
          _count: { select: { extensionProducts: true } },
          // Replis quand TCGdex n'a ni logo ni symbole : visuel d'un produit scellé, sinon
          // première carte illustrée.
          extensionProducts: {
            where: { imageUrl: { not: null } },
            select: { type: true, imageUrl: true },
            take: 12,
          },
          cards: {
            where: { imageUrl: { not: null } },
            orderBy: [{ number: 'asc' }, { localId: 'asc' }],
            select: { imageUrl: true },
            take: 1,
          },
        },
      },
    },
  });
  const withSets = series
    .filter((s) => s.releases.length > 0)
    .map(({ releases, ...s }) => ({
      ...s,
      releases: releases.map(({ extensionProducts, cards, ...r }) => ({
        ...r,
        coverUrl: r.imageUrl || r.symbolUrl ? null : coverOf(extensionProducts, cards),
      })),
    }));
  return {
    main: withSets.filter((s) => !SIDE_SERIES.has(s.id)),
    side: withSets.filter((s) => SIDE_SERIES.has(s.id)),
  };
}
/** Types de produits dont la boîte montre le mieux l'extension, du plus parlant au moins. */
const COVER_TYPES = ['ETB', 'DISPLAY', 'BOOSTER', 'TRIPACK', 'COFFRET'];

function coverOf(
  products: { type: string; imageUrl: string | null }[],
  cards: { imageUrl: string | null }[],
): string | null {
  const rank = (t: string) => {
    const i = COVER_TYPES.indexOf(t);
    return i === -1 ? COVER_TYPES.length : i;
  };
  const product = [...products].sort((a, b) => rank(a.type) - rank(b.type))[0];
  if (product?.imageUrl) return product.imageUrl;
  const card = cards[0]?.imageUrl;
  return card ? tcgdexAsset(card, '/low.webp')! : null;
}

export type SerieWithSets = Awaited<ReturnType<typeof getSeries>>['main'][number];

/** Minuscules sans accents côté SQL (même principe que `fold` de @tcgwatch/shared). */
const foldedName = Prisma.sql`translate(lower(c."name"), 'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy')`;

export interface EncyclopediaCard {
  id: string;
  localId: string;
  name: string;
  nameMissing: boolean;
  rarity: string | null;
  image: string | null;
  price: number | null;
  setCode: string;
  setName: string;
  serie: string | null;
  releaseDate: Date | null;
  tracked: boolean;
}

/**
 * Cartes dont le nom contient tous les mots de la recherche (sans accents), toutes
 * générations confondues, de la plus récente à la plus ancienne : « dracaufeu » → toutes
 * les cartes de Dracaufeu (Méga-Dracaufeu X-ex compris).
 */
export async function searchCards(
  q: string,
  limit = 500,
): Promise<{ cards: EncyclopediaCard[]; total: number }> {
  const words = queryWords(q).filter((w) => w.length >= 2);
  if (words.length === 0) return { cards: [], total: 0 };
  const where = Prisma.join(
    words.map((w) => Prisma.sql`${foldedName} LIKE ${`%${w}%`}`),
    ' AND ',
  );
  const rows = await prisma.$queryRaw<
    {
      id: string;
      localId: string;
      name: string;
      nameMissing: boolean;
      rarity: string | null;
      imageUrl: string | null;
      priceTrend: Prisma.Decimal | null;
      priceAvg30: Prisma.Decimal | null;
      tcgdexId: string;
      nameFr: string;
      serie: string | null;
      releaseDate: Date | null;
      tracked: boolean;
      total: bigint;
    }[]
  >`
    SELECT c."id", c."localId", c."name", c."nameMissing", c."rarity", c."imageUrl",
      c."priceTrend", c."priceAvg30", r."tcgdexId", r."nameFr", s."name" AS serie,
      r."releaseDate", EXISTS (SELECT 1 FROM "ChaseCard" k WHERE k."tcgdexId" = c."id") AS tracked,
      COUNT(*) OVER () AS total
    FROM "Card" c
    JOIN "Release" r ON r."id" = c."releaseId"
    LEFT JOIN "Serie" s ON s."id" = r."serieId"
    WHERE ${where}
    ORDER BY r."releaseDate" DESC NULLS LAST, c."number" ASC NULLS LAST, c."localId"
    LIMIT ${limit}`;
  return {
    total: Number(rows[0]?.total ?? 0),
    cards: rows.map((r) => ({
      id: r.id,
      localId: r.localId,
      name: r.name,
      nameMissing: r.nameMissing,
      rarity: r.rarity,
      image: tcgdexAsset(r.imageUrl ?? undefined, '/low.webp') ?? null,
      price: toNumber(r.priceTrend) ?? toNumber(r.priceAvg30),
      setCode: r.tcgdexId,
      setName: r.nameFr,
      serie: r.serie,
      releaseDate: r.releaseDate,
      tracked: r.tracked,
    })),
  };
}

/** Fiche locale d'une carte : extension, série et cartes voisines (précédente / suivante). */
export async function getLocalCard(id: string) {
  const card = await prisma.card.findUnique({
    where: { id },
    include: {
      release: {
        select: {
          id: true,
          tcgdexId: true,
          nameFr: true,
          cardCountOfficial: true,
          serieRef: { select: { name: true } },
        },
      },
    },
  });
  if (!card) return null;
  const siblings = await prisma.card.findMany({
    where: { releaseId: card.releaseId },
    orderBy: [{ number: { sort: 'asc', nulls: 'last' } }, { localId: 'asc' }],
    select: { id: true, name: true, localId: true },
  });
  const i = siblings.findIndex((s) => s.id === id);
  return {
    ...card,
    prev: i > 0 ? siblings[i - 1]! : null,
    next: i >= 0 && i < siblings.length - 1 ? siblings[i + 1]! : null,
  };
}
export type LocalCard = NonNullable<Awaited<ReturnType<typeof getLocalCard>>>;
