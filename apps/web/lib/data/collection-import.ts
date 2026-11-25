import 'server-only';
import { prisma } from '@tcgwatch/db';
import { tcgdexAsset } from '@tcgwatch/market';
import { importNameKey, importNumberKey, type ImportRow } from '@tcgwatch/shared';

export interface ImportCandidate {
  id: string;
  name: string;
  localId: string;
  release: string;
  image: string | null;
  variants: string[];
}

export interface ImportPreviewRow extends ImportRow {
  status: 'ok' | 'ambiguous' | 'missing';
  /** Carte retenue (une seule) ou cartes possibles (plusieurs). */
  candidates: ImportCandidate[];
  /** Pourquoi la carte n'a pas été trouvée. */
  reason?: string;
}

type ReleaseRef = {
  id: string;
  tcgdexId: string | null;
  nameFr: string;
  nameEn: string | null;
  abbreviation: string | null;
  cardCountOfficial: number | null;
};

/** Extensions désignées par une ligne : sigle ou code, nom (français ou anglais), total imprimé. */
function releasesFor(row: ImportRow, releases: ReleaseRef[]): ReleaseRef[] | null {
  const code = row.setCode?.toLowerCase();
  if (code) {
    const byCode = releases.filter(
      (r) => r.abbreviation?.toLowerCase() === code || r.tcgdexId?.toLowerCase() === code,
    );
    if (byCode.length) return byCode;
  }
  if (row.set) {
    const key = importNameKey(row.set);
    const exact = releases.filter(
      (r) => importNameKey(r.nameFr) === key || (r.nameEn && importNameKey(r.nameEn) === key),
    );
    if (exact.length) return exact;
    const partial = releases.filter(
      (r) =>
        importNameKey(r.nameFr).includes(key) ||
        key.includes(importNameKey(r.nameFr)) ||
        (r.nameEn &&
          (importNameKey(r.nameEn).includes(key) || key.includes(importNameKey(r.nameEn)))),
    );
    if (partial.length) return partial;
    return [];
  }
  if (row.total) {
    const byTotal = releases.filter((r) => r.cardCountOfficial === row.total);
    if (byTotal.length) return byTotal;
  }
  return null; // Aucune indication d'extension.
}

/**
 * Rapproche les lignes d'un fichier des cartes connues : extension (sigle, nom français ou
 * anglais, ou total imprimé) puis numéro, le nom départageant les cas douteux.
 */
export async function previewImport(rows: ImportRow[]): Promise<ImportPreviewRow[]> {
  const releases = await prisma.release.findMany({
    where: { tcgdexId: { not: null }, cards: { some: {} } },
    select: {
      id: true,
      tcgdexId: true,
      nameFr: true,
      nameEn: true,
      abbreviation: true,
      cardCountOfficial: true,
    },
  });
  const scoped = rows.map((r) => ({ row: r, releases: releasesFor(r, releases) }));
  // Cartes des extensions désignées, et cartes portant les numéros des lignes sans extension.
  const releaseIds = [...new Set(scoped.flatMap((s) => (s.releases ?? []).map((r) => r.id)))];
  const looseNumbers = [
    ...new Set(
      scoped
        .filter((s) => s.releases === null && s.row.number)
        .flatMap((s) => {
          const n = s.row.number!.replace(/^0+(?=\d)/, '');
          return [n, n.padStart(2, '0'), n.padStart(3, '0')];
        }),
    ),
  ];
  const cards = await prisma.card.findMany({
    where: {
      OR: [
        { releaseId: { in: releaseIds } },
        ...(looseNumbers.length ? [{ localId: { in: looseNumbers } }] : []),
        // Lignes avec un nom seul : cartes de ce nom exact (majuscules ignorées).
        ...scoped
          .filter((s) => s.releases === null && !s.row.number && s.row.name)
          .slice(0, 500)
          .map((s) => ({ name: { equals: s.row.name!, mode: 'insensitive' as const } })),
      ],
    },
    select: {
      id: true,
      name: true,
      localId: true,
      imageUrl: true,
      variants: true,
      releaseId: true,
      release: { select: { nameFr: true } },
    },
  });
  const toCandidate = (c: (typeof cards)[number]): ImportCandidate => ({
    id: c.id,
    name: c.name,
    localId: c.localId,
    release: c.release.nameFr,
    image: tcgdexAsset(c.imageUrl ?? undefined, '/low.webp') ?? null,
    variants: c.variants.length ? c.variants : ['normal'],
  });

  return scoped.map(({ row, releases: rels }) => {
    if (rels && rels.length === 0) {
      return {
        ...row,
        status: 'missing',
        candidates: [],
        reason: `Extension « ${row.set} » inconnue`,
      };
    }
    const allowed = rels ? new Set(rels.map((r) => r.id)) : null;
    let pool = cards.filter((c) => !allowed || allowed.has(c.releaseId));
    if (row.number) {
      const key = importNumberKey(row.number);
      pool = pool.filter((c) => importNumberKey(c.localId) === key);
    }
    const nameKey = row.name ? importNameKey(row.name) : null;
    if (pool.length > 1 && nameKey) {
      // Nom français ou nom anglais d'un export : on ne garde que les noms qui correspondent,
      // s'il y en a.
      const named = pool.filter((c) => {
        const k = importNameKey(c.name);
        return k === nameKey || k.includes(nameKey) || nameKey.includes(k);
      });
      if (named.length) pool = named;
    } else if (!row.number && nameKey) {
      pool = pool.filter((c) => importNameKey(c.name) === nameKey);
    }
    if (pool.length === 1) return { ...row, status: 'ok', candidates: pool.map(toCandidate) };
    if (pool.length > 1) {
      return { ...row, status: 'ambiguous', candidates: pool.slice(0, 8).map(toCandidate) };
    }
    return {
      ...row,
      status: 'missing',
      candidates: [],
      reason: row.number ? `Aucune carte n° ${row.number}` : `Aucune carte « ${row.name} »`,
    };
  });
}
