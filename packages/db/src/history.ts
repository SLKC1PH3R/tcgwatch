import type { Availability } from './generated/prisma/enums';
import { prisma } from './index';

/** Une disponibilité « achetable » (en stock ou précommande ouverte). */
const BUYABLE: Availability[] = ['IN_STOCK', 'PREORDER'];

/** Rétention des relevés détaillés : au-delà, seul le résumé quotidien est conservé. */
export const SNAPSHOT_RETENTION_DAYS = 30;

export interface Observation {
  listingId: string;
  price: number | null;
  availability: Availability;
  at: Date;
}

/**
 * Faut-il garder un relevé détaillé ? Oui si le prix ou la disponibilité a changé depuis
 * le dernier relevé, et au moins une fois par jour (relevé de confirmation).
 */
export async function shouldKeepSnapshot(
  previous: { price: number | null; availability: Availability; lastCheckedAt: Date | null },
  next: Observation,
): Promise<boolean> {
  if (previous.lastCheckedAt === null) return true;
  if (previous.price !== next.price || previous.availability !== next.availability) return true;
  const dayStart = new Date(next.at);
  dayStart.setUTCHours(0, 0, 0, 0);
  const today = await prisma.snapshot.findFirst({
    where: { listingId: next.listingId, createdAt: { gte: dayStart } },
    select: { id: true },
  });
  return today === null;
}

/**
 * Met à jour le résumé du jour de la fiche (prix mini, maxi, dernier, achetable ou non),
 * à chaque relevé, qu'un relevé détaillé soit gardé ou non.
 */
export async function recordDaily(o: Observation): Promise<void> {
  const buyable = BUYABLE.includes(o.availability);
  const buyablePrice = buyable ? o.price : null;
  await prisma.$executeRaw`
    INSERT INTO "ListingDaily" ("id", "listingId", "date", "minPrice", "maxPrice", "lastPrice",
      "minBuyablePrice", "wasBuyable", "lastAvailability", "checks", "updatedAt")
    VALUES (gen_random_uuid()::text, ${o.listingId}, (${o.at}::timestamptz AT TIME ZONE 'UTC')::date,
      ${o.price}::numeric, ${o.price}::numeric, ${o.price}::numeric, ${buyablePrice}::numeric,
      ${buyable}, ${o.availability}::"Availability", 1, NOW())
    ON CONFLICT ("listingId", "date") DO UPDATE SET
      "minPrice" = LEAST("ListingDaily"."minPrice", EXCLUDED."minPrice"),
      "maxPrice" = GREATEST("ListingDaily"."maxPrice", EXCLUDED."maxPrice"),
      "lastPrice" = COALESCE(EXCLUDED."lastPrice", "ListingDaily"."lastPrice"),
      "minBuyablePrice" = LEAST("ListingDaily"."minBuyablePrice", EXCLUDED."minBuyablePrice"),
      "wasBuyable" = "ListingDaily"."wasBuyable" OR EXCLUDED."wasBuyable",
      "lastAvailability" = EXCLUDED."lastAvailability",
      "checks" = "ListingDaily"."checks" + 1,
      "updatedAt" = NOW()`;
}

/**
 * Regroupement quotidien : complète les résumés à partir des relevés détaillés (au cas où un
 * relevé aurait été enregistré sans résumé), puis supprime les relevés de plus de
 * SNAPSHOT_RETENTION_DAYS jours. Renvoie le nombre de relevés supprimés.
 */
export async function compactSnapshots(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SNAPSHOT_RETENTION_DAYS * 86_400_000);
  cutoff.setUTCHours(0, 0, 0, 0);
  await prisma.$executeRaw`
    INSERT INTO "ListingDaily" ("id", "listingId", "date", "minPrice", "maxPrice", "lastPrice",
      "minBuyablePrice", "wasBuyable", "lastAvailability", "checks", "updatedAt")
    SELECT gen_random_uuid()::text, s."listingId", (s."createdAt" AT TIME ZONE 'UTC')::date,
      MIN(s."price"), MAX(s."price"), (ARRAY_AGG(s."price" ORDER BY s."createdAt" DESC))[1],
      MIN(s."price") FILTER (WHERE s."availability" IN ('IN_STOCK', 'PREORDER')),
      BOOL_OR(s."availability" IN ('IN_STOCK', 'PREORDER')),
      (ARRAY_AGG(s."availability" ORDER BY s."createdAt" DESC))[1], COUNT(*)::int, NOW()
    FROM "Snapshot" s
    WHERE s."createdAt" < ${cutoff}
    GROUP BY s."listingId", (s."createdAt" AT TIME ZONE 'UTC')::date
    ON CONFLICT ("listingId", "date") DO NOTHING`;
  const { count } = await prisma.snapshot.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
