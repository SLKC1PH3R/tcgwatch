import 'server-only';
import { prisma } from '@tcgwatch/db';
import { todayUtc } from '@tcgwatch/shared';

/** Tâches du worker et la source de données de chacune. */
export const JOBS: { job: string; label: string; source: string; everyHours: number }[] = [
  {
    job: 'listings',
    label: 'Relevés des revendeurs',
    source: 'Sites des boutiques',
    everyHours: 1,
  },
  {
    job: 'tcgdex',
    label: 'Extensions, cartes et logos',
    source: 'TCGdex · pokemontcg.io · Pokécardex',
    everyHours: 24,
  },
  {
    job: 'market',
    label: 'Cotes des cartes et du scellé',
    source: 'Cardmarket (guide des prix)',
    everyHours: 24,
  },
  {
    job: 'ebay',
    label: 'Annonces, occasion et prix FR',
    source: 'eBay (API officielle)',
    everyHours: 1,
  },
  { job: 'pokecardex', label: 'Calendrier des sorties', source: 'Pokécardex', everyHours: 24 },
  {
    job: 'discovery',
    label: 'Découverte de fiches',
    source: 'Sites des boutiques',
    everyHours: 24,
  },
  { job: 'card-hashes', label: 'Empreintes du scanner', source: 'Images TCGdex', everyHours: 1 },
  {
    job: 'release-reminders',
    label: 'Rappels de sorties',
    source: 'Base TCGWatch',
    everyHours: 24,
  },
  { job: 'history', label: 'Nettoyage et résumés', source: 'Base TCGWatch', everyHours: 24 },
];

/** Quota quotidien de l'API eBay (Browse). */
export const EBAY_DAILY_QUOTA = 5000;

export async function getSourcesStatus() {
  const since = new Date(Date.now() - 86_400_000);
  const today = todayUtc();
  const [runs, usage] = await Promise.all([
    prisma.jobRun.findMany({
      where: { startedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      orderBy: { startedAt: 'desc' },
      select: { job: true, startedAt: true, finishedAt: true, ok: true, error: true },
    }),
    prisma.apiUsage.findMany({
      where: { source: 'ebay', day: { gte: new Date(today.getTime() - 6 * 86_400_000) } },
      orderBy: { day: 'asc' },
    }),
  ]);
  const jobs = JOBS.map((j) => {
    const mine = runs.filter((r) => r.job === j.job);
    const last = mine[0] ?? null;
    const lastOk = mine.find((r) => r.ok) ?? null;
    const lastFailure = mine.find((r) => r.ok === false) ?? null;
    const recent = mine.filter((r) => r.startedAt >= since);
    const failures = recent.filter((r) => r.ok === false).length;
    // En retard : aucun passage réussi depuis plus de deux fois l'intervalle prévu.
    const late = !lastOk || Date.now() - lastOk.startedAt.getTime() > j.everyHours * 2 * 3_600_000;
    return {
      ...j,
      last,
      lastOk,
      lastFailure,
      runs24h: recent.length,
      failures24h: failures,
      health: !last
        ? 'unknown'
        : late
          ? 'down'
          : last.ok === false || failures > 0
            ? 'degraded'
            : 'ok',
      durationMs:
        last?.finishedAt && last.startedAt
          ? last.finishedAt.getTime() - last.startedAt.getTime()
          : null,
    } as const;
  });
  const ebayToday = usage.find((u) => u.day.getTime() === today.getTime())?.calls ?? 0;
  return {
    jobs,
    ebay: {
      today: ebayToday,
      quota: EBAY_DAILY_QUOTA,
      days: usage.map((u) => ({ day: u.day.toISOString().slice(0, 10), calls: u.calls })),
    },
  };
}

/**
 * Extensions incomplètes : cartes sans image, extension moderne sans aucune reverse, cartes
 * pas encore reconnaissables par le scanner.
 */
export async function getIncompleteReleases() {
  const rows = await prisma.$queryRaw<
    {
      code: string;
      name: string;
      releaseDate: Date | null;
      cards: bigint;
      noImage: bigint;
      reverses: bigint;
      noHash: bigint;
    }[]
  >`
    SELECT r."tcgdexId" AS code, r."nameFr" AS name, r."releaseDate",
      count(c.id) AS cards,
      count(c.id) FILTER (WHERE c."imageUrl" IS NULL) AS "noImage",
      count(c.id) FILTER (WHERE 'reverse' = ANY(c.variants)) AS reverses,
      count(c.id) FILTER (WHERE c."imageUrl" IS NOT NULL AND c."imageHash" IS NULL) AS "noHash"
    FROM "Release" r JOIN "Card" c ON c."releaseId" = r.id
    WHERE r."tcgdexId" IS NOT NULL
    GROUP BY r.id
    ORDER BY r."releaseDate" DESC NULLS FIRST`;
  return rows
    .map((r) => {
      const modern = /^(bw|xy|sm|swsh|sv|me)\d/i.test(r.code);
      return {
        code: r.code,
        name: r.name,
        releaseDate: r.releaseDate,
        cards: Number(r.cards),
        noImage: Number(r.noImage),
        noReverse: modern && Number(r.reverses) === 0,
        noHash: Number(r.noHash),
      };
    })
    .filter((r) => r.noImage > 0 || r.noReverse);
}
