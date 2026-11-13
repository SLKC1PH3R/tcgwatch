import type { Availability } from './generated/prisma/enums';
import type { Prisma } from './generated/prisma/client';
import { prisma } from './index';

const parisDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Minuit heure de Paris du jour qui contient `at` (même calcul que @tcgwatch/shared). */
function parisDayStart(at: Date): Date {
  const key = parisDay.format(at);
  const base = Date.parse(`${key}T00:00:00Z`);
  for (const h of [2, 1, 0]) {
    const t = new Date(base - h * 3_600_000);
    if (parisDay.format(t) === key) return t;
  }
  return new Date(base);
}

/** Une disponibilité « achetable » (en stock ou précommande ouverte). */
const BUYABLE: Availability[] = ['IN_STOCK', 'PREORDER'];

/** Rétention par défaut des relevés détaillés : au-delà, seul le résumé quotidien reste. */
export const SNAPSHOT_RETENTION_DAYS = 14;
/** Rétention par défaut des alertes (l'anti-doublon ne remonte qu'à un jour). */
export const ALERT_RETENTION_DAYS = 180;

/**
 * Un prix est mis de côté s'il est inférieur à cette part du prix de référence (médiane des
 * meilleurs prix sur 30 jours, à défaut prix conseillé) : prix mal lu, mauvaise fiche…
 */
export const SUSPECT_RATIO = 0.5;
/** Nombre de jours d'historique nécessaires pour utiliser la médiane 30 j comme référence. */
const MEDIAN_MIN_DAYS = 5;

/**
 * Résumés quotidiens retenus dans l'historique : un choix manuel (`excluded`) l'emporte sur
 * la mise de côté automatique (`suspect`).
 */
export const KEPT_DAILY = {
  OR: [{ excluded: false }, { excluded: null, suspect: false }],
} satisfies Prisma.ListingDailyWhereInput;

export interface Observation {
  listingId: string;
  price: number | null;
  availability: Availability;
  at: Date;
  /** Prix aberrant : le résumé du jour est mis de côté (rétablissable sur le graphique). */
  suspect?: boolean;
}

/**
 * Faut-il garder un relevé détaillé ? Oui si le prix ou la disponibilité a changé depuis
 * le dernier relevé, et au moins une fois par jour (relevé de confirmation, jour de Paris).
 */
export async function shouldKeepSnapshot(
  previous: { price: number | null; availability: Availability; lastCheckedAt: Date | null },
  next: Observation,
): Promise<boolean> {
  if (previous.lastCheckedAt === null) return true;
  if (previous.price !== next.price || previous.availability !== next.availability) return true;
  const today = await prisma.snapshot.findFirst({
    where: { listingId: next.listingId, createdAt: { gte: parisDayStart(next.at) } },
    select: { id: true },
  });
  return today === null;
}

/**
 * Prix de référence d'un produit pour repérer un prix aberrant : médiane des meilleurs prix
 * achetables quotidiens des 30 derniers jours (au moins 5 jours), sinon le prix conseillé.
 */
export async function referencePrice(
  productId: string,
  msrp: number | null,
  now = new Date(),
): Promise<number | null> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [row] = await prisma.$queryRaw<{ median: number | null; days: bigint }[]>`
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY best)::float8 AS median, COUNT(*) AS days
    FROM (
      SELECT d."date", MIN(d."minBuyablePrice") AS best
      FROM "ListingDaily" d JOIN "Listing" l ON l."id" = d."listingId"
      WHERE l."productId" = ${productId} AND d."date" >= ${since}::date
        AND d."minBuyablePrice" IS NOT NULL AND NOT COALESCE(d."excluded", d."suspect")
      GROUP BY d."date"
    ) t`;
  if (row && row.median !== null && Number(row.days) >= MEDIAN_MIN_DAYS) return row.median;
  return msrp && msrp > 0 ? msrp : null;
}

/** Prix inférieur à SUSPECT_RATIO du prix de référence. */
export function isSuspectPrice(price: number | null, reference: number | null): boolean {
  return price !== null && reference !== null && price < reference * SUSPECT_RATIO;
}

/**
 * Met à jour le résumé du jour (jour de Paris) de la fiche : prix mini, maxi, dernier,
 * achetable ou non, à chaque relevé, qu'un relevé détaillé soit gardé ou non.
 */
export async function recordDaily(o: Observation): Promise<void> {
  const buyable = BUYABLE.includes(o.availability);
  const buyablePrice = buyable ? o.price : null;
  const suspect = o.suspect ?? false;
  await prisma.$executeRaw`
    INSERT INTO "ListingDaily" ("id", "listingId", "date", "minPrice", "maxPrice", "lastPrice",
      "minBuyablePrice", "wasBuyable", "lastAvailability", "checks", "suspect", "updatedAt")
    VALUES (gen_random_uuid()::text, ${o.listingId},
      (${o.at}::timestamptz AT TIME ZONE 'Europe/Paris')::date,
      ${o.price}::numeric, ${o.price}::numeric, ${o.price}::numeric, ${buyablePrice}::numeric,
      ${buyable}, ${o.availability}::"Availability", 1, ${suspect}, NOW())
    ON CONFLICT ("listingId", "date") DO UPDATE SET
      "minPrice" = LEAST("ListingDaily"."minPrice", EXCLUDED."minPrice"),
      "maxPrice" = GREATEST("ListingDaily"."maxPrice", EXCLUDED."maxPrice"),
      "lastPrice" = COALESCE(EXCLUDED."lastPrice", "ListingDaily"."lastPrice"),
      "minBuyablePrice" = LEAST("ListingDaily"."minBuyablePrice", EXCLUDED."minBuyablePrice"),
      "wasBuyable" = "ListingDaily"."wasBuyable" OR EXCLUDED."wasBuyable",
      "lastAvailability" = EXCLUDED."lastAvailability",
      "checks" = "ListingDaily"."checks" + 1,
      "suspect" = "ListingDaily"."suspect" OR EXCLUDED."suspect",
      "updatedAt" = NOW()`;
}

/**
 * Regroupement quotidien : complète les résumés à partir des relevés détaillés (au cas où un
 * relevé aurait été enregistré sans résumé), puis supprime les relevés de plus de
 * `retentionDays` jours. Renvoie le nombre de relevés supprimés.
 */
export async function compactSnapshots(
  now = new Date(),
  retentionDays = SNAPSHOT_RETENTION_DAYS,
): Promise<number> {
  const cutoff = parisDayStart(new Date(now.getTime() - retentionDays * 86_400_000));
  // createdAt est un horodatage UTC sans fuseau : conversion explicite vers l'heure de Paris.
  await prisma.$executeRaw`
    INSERT INTO "ListingDaily" ("id", "listingId", "date", "minPrice", "maxPrice", "lastPrice",
      "minBuyablePrice", "wasBuyable", "lastAvailability", "checks", "updatedAt")
    SELECT gen_random_uuid()::text, s."listingId",
      ((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')::date,
      MIN(s."price"), MAX(s."price"), (ARRAY_AGG(s."price" ORDER BY s."createdAt" DESC))[1],
      MIN(s."price") FILTER (WHERE s."availability" IN ('IN_STOCK', 'PREORDER')),
      BOOL_OR(s."availability" IN ('IN_STOCK', 'PREORDER')),
      (ARRAY_AGG(s."availability" ORDER BY s."createdAt" DESC))[1], COUNT(*)::int, NOW()
    FROM "Snapshot" s
    WHERE s."createdAt" < ${cutoff}
    GROUP BY s."listingId", ((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')::date
    ON CONFLICT ("listingId", "date") DO NOTHING`;
  const { count } = await prisma.snapshot.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}

/**
 * Ménage quotidien hors historique des prix : alertes de plus de `alertDays` jours et
 * sessions expirées. Les résumés quotidiens (prix, cartes, marché) sont gardés sans limite :
 * une ligne par fiche et par jour.
 */
export async function purgeStale(now = new Date(), alertDays = ALERT_RETENTION_DAYS) {
  const [alerts, sessions] = await Promise.all([
    prisma.alertEvent.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - alertDays * 86_400_000) } },
    }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return { alerts: alerts.count, sessions: sessions.count };
}
