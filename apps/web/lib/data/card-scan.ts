import 'server-only';
import { prisma } from '@tcgwatch/db';
import { tcgdexAsset } from '@tcgwatch/market';
import { toNumber } from '@tcgwatch/shared';

interface Ref {
  id: string;
  hi: number;
  lo: number;
  release: string | null;
}

const popcount32 = (n: number) => {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

const split = (hex: string) => ({
  hi: parseInt(hex.slice(0, 8), 16) >>> 0,
  lo: parseInt(hex.slice(8, 16), 16) >>> 0,
});

/** Empreintes de toutes les cartes, gardées en mémoire 10 minutes (≈ 20 000 lignes). */
let cache: { at: number; refs: Ref[] } | null = null;
async function references(): Promise<Ref[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.refs;
  const rows = await prisma.card.findMany({
    where: { imageHash: { not: null } },
    select: { id: true, imageHash: true, release: { select: { tcgdexId: true } } },
  });
  const refs = rows.map((r) => ({ id: r.id, release: r.release.tcgdexId, ...split(r.imageHash!) }));
  cache = { at: Date.now(), refs };
  return refs;
}

/** Au-delà, l'image n'a plus grand-chose à voir : pas proposée. */
const MAX_DISTANCE = 22;

export interface ScanMatch {
  id: string;
  name: string;
  localId: string;
  image: string | null;
  release: string;
  price: number | null;
  owned: number;
  distance: number;
  variants: string[];
}

/**
 * Cartes les plus proches d'une empreinte (photo de l'appareil), éventuellement dans une seule
 * extension : les meilleures d'abord, avec les exemplaires déjà possédés par l'utilisateur.
 */
export async function matchCardHash(
  userId: string,
  hash: string,
  release?: string,
  take = 6,
): Promise<ScanMatch[]> {
  if (!/^[0-9a-f]{16}$/.test(hash)) return [];
  const q = split(hash);
  const best = (await references())
    .filter((r) => !release || r.release === release)
    .map((r) => ({ id: r.id, d: popcount32(r.hi ^ q.hi) + popcount32(r.lo ^ q.lo) }))
    .filter((r) => r.d <= MAX_DISTANCE)
    .sort((a, b) => a.d - b.d)
    .slice(0, take);
  if (best.length === 0) return [];
  const cards = await prisma.card.findMany({
    where: { id: { in: best.map((b) => b.id) } },
    select: {
      id: true,
      name: true,
      localId: true,
      imageUrl: true,
      priceTrend: true,
      variants: true,
      release: { select: { nameFr: true } },
      owned: { where: { userId }, select: { quantity: true } },
    },
  });
  const byId = new Map(cards.map((c) => [c.id, c]));
  return best.flatMap((b) => {
    const c = byId.get(b.id);
    if (!c) return [];
    return [
      {
        id: c.id,
        name: c.name,
        localId: c.localId,
        image: tcgdexAsset(c.imageUrl ?? undefined, '/low.webp') ?? null,
        release: c.release.nameFr,
        price: toNumber(c.priceTrend),
        owned: c.owned.reduce((n, o) => n + o.quantity, 0),
        distance: b.d,
        variants: c.variants.length ? c.variants : ['normal'],
      },
    ];
  });
}

/** Avancement des empreintes (affiché sur la page du scanner). */
export async function scanCoverage() {
  const [hashed, total] = await Promise.all([
    prisma.card.count({ where: { imageHash: { not: null } } }),
    prisma.card.count({ where: { imageUrl: { not: null } } }),
  ]);
  return { hashed, total };
}
