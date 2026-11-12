import 'server-only';
import { prisma, type Prisma } from '@tcgwatch/db';
import { PRODUCT_TYPES, todayUtc, toNumber, type ProductTypeKey } from '@tcgwatch/shared';

/** Filtre du calendrier : « extension » (sorties sans type de produit) ou un type de produit. */
export type CalendarFilter = 'extension' | ProductTypeKey;

export function parseCalendarFilter(value: string | undefined): CalendarFilter | undefined {
  if (value === 'extension') return value;
  return PRODUCT_TYPES.find((t) => t === value);
}

function releaseWhere(filter: CalendarFilter | undefined): Prisma.ReleaseWhereInput {
  if (!filter) return {};
  return filter === 'extension' ? { productType: null } : { productType: filter };
}

export interface CalendarEvent {
  id: string;
  kind: 'release' | 'product';
  title: string;
  subtitle: string | null;
  date: Date;
  status?: 'AUTO' | 'VALIDATED';
  source?: string;
  imageUrl: string | null;
  href: string;
  productType: string | null;
  msrp: number | null;
  sourceUrl: string | null;
}

/**
 * Événements du calendrier : sorties (extensions / produits spéciaux) et dates propres
 * à un produit détectées chez les revendeurs (si différentes de la sortie liée).
 */
export async function getCalendarEvents(
  from: Date,
  to: Date,
  filter?: CalendarFilter,
): Promise<CalendarEvent[]> {
  const [releases, products] = await Promise.all([
    prisma.release.findMany({
      where: { releaseDate: { gte: from, lt: to }, ...releaseWhere(filter) },
      orderBy: [{ releaseDate: 'asc' }, { nameFr: 'asc' }],
    }),
    prisma.product.findMany({
      where: {
        releaseDate: { gte: from, lt: to },
        ...(filter && filter !== 'extension' ? { type: filter } : {}),
      },
      include: { release: { select: { releaseDate: true, nameFr: true } } },
      orderBy: { releaseDate: 'asc' },
    }),
  ]);

  const events: CalendarEvent[] = releases.map((r) => ({
    id: r.id,
    kind: 'release',
    title: r.nameFr,
    subtitle: r.setCode,
    date: r.releaseDate!,
    status: r.status,
    source: r.source,
    imageUrl: r.imageUrl,
    href: `/calendrier?edit=${r.id}#release-${r.id}`,
    productType: r.productType,
    msrp: toNumber(r.msrp),
    sourceUrl: r.sourceUrl,
  }));

  // Les dates propres à un produit ne sont pas des extensions.
  for (const p of filter === 'extension' ? [] : products) {
    const same = p.release?.releaseDate?.getTime() === p.releaseDate!.getTime();
    if (same) continue;
    events.push({
      id: p.id,
      kind: 'product',
      title: p.name,
      subtitle: p.release?.nameFr ?? null,
      date: p.releaseDate!,
      source: p.releaseDateSource ?? undefined,
      imageUrl: p.imageUrl ?? p.images[0] ?? null,
      href: `/produits/${p.id}`,
      productType: p.type,
      msrp: toNumber(p.msrp),
      sourceUrl: null,
    });
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function getUpcomingEvents(limit = 20, filter?: CalendarFilter) {
  const from = todayUtc();
  const to = new Date(from.getTime() + 400 * 86_400_000);
  return (await getCalendarEvents(from, to, filter)).slice(0, limit);
}

export async function getReleasesForEdit(filter?: CalendarFilter) {
  return prisma.release.findMany({
    where: releaseWhere(filter),
    orderBy: [{ releaseDate: { sort: 'desc', nulls: 'first' } }, { nameFr: 'asc' }],
    include: { _count: { select: { products: true } } },
  });
}
