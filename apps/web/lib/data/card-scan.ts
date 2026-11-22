import 'server-only';
import { prisma } from '@tcgwatch/db';
import { tcgdexAsset } from '@tcgwatch/market';
import { scanScore, toNumber, type ScanSignature } from '@tcgwatch/shared';

interface Ref {
  id: string;
  hi: number;
  lo: number;
  /** Chromaticité 4 × 4 (32 octets), absente tant que le worker ne l'a pas calculée. */
  color: Uint8Array | null;
  release: string | null;
}

interface Query {
  hi: number;
  lo: number;
  color: Uint8Array;
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

const bytes = (hex: string) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

/** Même échelle que `colorDistance` (0-64). */
const colorGap = (a: Uint8Array, b: Uint8Array) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
  return (sum / a.length) * (64 / 85);
};

/** Empreintes de toutes les cartes, gardées en mémoire 10 minutes (≈ 20 000 lignes). */
let cache: { at: number; refs: Ref[] } | null = null;
async function references(): Promise<Ref[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.refs;
  const rows = await prisma.card.findMany({
    where: { imageHash: { not: null } },
    select: {
      id: true,
      imageHash: true,
      imageColor: true,
      release: { select: { tcgdexId: true } },
    },
  });
  const refs = rows.map((r) => ({
    id: r.id,
    release: r.release.tcgdexId,
    color: r.imageColor?.length === 64 ? bytes(r.imageColor) : null,
    ...split(r.imageHash!),
  }));
  cache = { at: Date.now(), refs };
  return refs;
}

/** Au-delà de cette distance de forme, l'image n'a plus grand-chose à voir. */
const MAX_DISTANCE = 22;
/** Score (forme + couleur) au-delà duquel une carte n'est pas proposée. */
const MAX_SCORE = 28;
/** Score sous lequel la carte est reconnue… */
const SURE_SCORE = 14;
/** … à condition de devancer nettement la suivante (autre illustration). */
const SURE_GAP = 6;

export interface ScanMatch {
  id: string;
  name: string;
  localId: string;
  image: string | null;
  release: string;
  price: number | null;
  owned: number;
  /** Score de ressemblance : 0 = identique, plus bas = plus proche. */
  score: number;
  variants: string[];
}

export interface ScanResult {
  matches: ScanMatch[];
  /** La première carte est reconnue avec certitude (score bas et nette avance). */
  confident: boolean;
}

/**
 * Cartes les plus proches d'une photo, éventuellement dans une seule extension. Le navigateur
 * envoie plusieurs cadrages possibles de la carte : chaque carte connue garde le plus proche.
 * Score = distance de forme (pHash) + écart de couleur, pour départager les variantes recolorées.
 */
export async function matchCardScan(
  userId: string,
  candidates: ScanSignature[],
  release?: string,
  take = 6,
): Promise<ScanResult> {
  const queries: Query[] = candidates
    .filter((c) => /^[0-9a-f]{16}$/.test(c.hash) && /^[0-9a-f]{64}$/.test(c.color))
    .map((c) => ({ ...split(c.hash), color: bytes(c.color) }));
  if (queries.length === 0) return { matches: [], confident: false };
  const scored: { id: string; score: number }[] = [];
  for (const r of await references()) {
    if (release && r.release !== release) continue;
    let best = Infinity;
    for (const q of queries) {
      const d = popcount32(r.hi ^ q.hi) + popcount32(r.lo ^ q.lo);
      if (d > MAX_DISTANCE) continue;
      best = Math.min(best, scanScore(d, r.color ? colorGap(r.color, q.color) : null));
    }
    if (best <= MAX_SCORE) scored.push({ id: r.id, score: best });
  }
  const best = scored.sort((a, b) => a.score - b.score).slice(0, take);
  if (best.length === 0) return { matches: [], confident: false };
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
  const matches = best.flatMap((b) => {
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
        score: Math.round(b.score * 10) / 10,
        variants: c.variants.length ? c.variants : ['normal'],
      },
    ];
  });
  const [first, second] = matches;
  // Réimpression de la même carte (même nom) : ne remet pas la certitude en cause.
  const confident =
    !!first &&
    first.score <= SURE_SCORE &&
    (!second || second.name === first.name || second.score - first.score >= SURE_GAP);
  return { matches, confident };
}

/** Avancement des empreintes (affiché sur la page du scanner). */
export async function scanCoverage() {
  const [hashed, total] = await Promise.all([
    prisma.card.count({ where: { imageHash: { not: null } } }),
    prisma.card.count({ where: { imageUrl: { not: null } } }),
  ]);
  return { hashed, total };
}
