import 'server-only';
import { prisma } from '@tcgwatch/db';
import { todayUtc } from '@tcgwatch/shared';

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
}

/**
 * Événements du calendrier : sorties (extensions / produits spéciaux) et dates propres
 * à un produit détectées chez les revendeurs (si différentes de la sortie liée).
 */
export async function getCalendarEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
  const [releases, products] = await Promise.all([
    prisma.release.findMany({
      where: { releaseDate: { gte: from, lt: to } },
      orderBy: { releaseDate: 'asc' },
    }),
    prisma.product.findMany({
      where: { releaseDate: { gte: from, lt: to } },
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
  }));

  for (const p of products) {
    const same = p.release?.releaseDate?.getTime() === p.releaseDate!.getTime();
    if (same) continue;
    events.push({
      id: p.id,
      kind: 'product',
      title: p.name,
      subtitle: p.release?.nameFr ?? null,
      date: p.releaseDate!,
      source: p.releaseDateSource ?? undefined,
      imageUrl: p.imageUrl,
      href: `/produits/${p.id}`,
    });
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function getUpcomingEvents(limit = 20) {
  const from = todayUtc();
  const to = new Date(from.getTime() + 400 * 86_400_000);
  return (await getCalendarEvents(from, to)).slice(0, limit);
}

export async function getReleasesForEdit() {
  return prisma.release.findMany({
    orderBy: [{ releaseDate: { sort: 'desc', nulls: 'first' } }, { nameFr: 'asc' }],
    include: { _count: { select: { products: true } } },
  });
}
