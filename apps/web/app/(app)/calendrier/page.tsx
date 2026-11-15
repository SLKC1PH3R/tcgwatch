import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatDate,
  formatPrice,
  PRODUCT_TYPE_LABELS,
  todayUtc,
  type ProductTypeKey,
} from '@tcgwatch/shared';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getCalendarEvents,
  getUpcomingEvents,
  parseCalendarFilter,
  type CalendarEvent,
  type CalendarFilter,
} from '@/lib/data/releases';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Calendrier des sorties' };

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const SOURCE_LABEL: Record<string, string> = {
  TCGDEX: 'TCGdex',
  RETAILER: 'Revendeur',
  MANUAL: 'Manuel',
  SEED: 'Seed',
  POKECARDEX: 'Pokécardex',
};

const FILTERS: { value: CalendarFilter | undefined; label: string }[] = [
  { value: undefined, label: 'Tout' },
  { value: 'extension', label: 'Extensions' },
  { value: 'ETB', label: 'ETB' },
  { value: 'DISPLAY', label: 'Displays' },
  { value: 'TRIPACK', label: 'Tripacks' },
  { value: 'BOOSTER', label: 'Boosters' },
  { value: 'BLISTER', label: 'Blisters' },
  { value: 'COFFRET', label: 'Coffrets' },
  { value: 'UPC', label: 'UPC' },
  { value: 'POKEBOX', label: 'Pokébox' },
  { value: 'MINI_TIN', label: 'Mini Tins' },
  { value: 'DECK', label: 'Decks' },
];

/** Nombre de sorties affichées dans une case du mois avant « +N ». */
const MAX_PER_DAY = 3;

function typeLabel(type: string | null): string | null {
  return type ? (PRODUCT_TYPE_LABELS[type as ProductTypeKey] ?? type) : null;
}

function parseMonth(value?: string): Date {
  const m = value?.match(/^(\d{4})-(\d{2})$/);
  const today = todayUtc();
  return m
    ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))
    : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
}

const monthKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

function buildGrid(month: Date): Date[] {
  const first = new Date(month);
  const offset = (first.getUTCDay() + 6) % 7; // lundi = 0
  const start = new Date(first.getTime() - offset * 86_400_000);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86_400_000));
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    mois?: string;
    type?: string;
    jour?: string;
  }>;
}) {
  const { mois, type, jour } = await searchParams;
  const filter = parseCalendarFilter(type);
  const selectedDay = jour && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : undefined;
  /** Lien du calendrier qui conserve mois et filtre. */
  const href = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const all = { mois, type: filter, ...params };
    for (const [k, v] of Object.entries(all)) if (v) q.set(k, v);
    const qs = q.toString();
    return qs ? `/calendrier?${qs}` : '/calendrier';
  };
  const month = parseMonth(mois);
  const grid = buildGrid(month);
  const prev = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));
  const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  const today = todayUtc();

  const [events, upcoming] = await Promise.all([
    getCalendarEvents(grid[0]!, new Date(grid[41]!.getTime() + 86_400_000), filter),
    getUpcomingEvents(15, filter),
  ]);

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const k = e.date.toISOString().slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }

  // Jour détaillé à droite : celui choisi, sinon la prochaine sortie.
  const shownDay = selectedDay ?? upcoming[0]?.date.toISOString().slice(0, 10);

  const monthLabel = month.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <>
      <PageHeader
        title="Calendrier des sorties"
        description="Extensions (TCGdex) et produits scellés FR (Pokécardex), enrichis par les dates « Sortie prévue le » des revendeurs."
      />

      <nav aria-label="Filtrer par type" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={href({ type: f.value, jour: undefined })}
            aria-current={filter === f.value ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors hover:bg-accent',
              filter === f.value &&
                'border-foreground bg-foreground text-background hover:bg-foreground',
            )}
          >
            <span aria-hidden className={cn('size-1.5 rounded-full', dotClass(f.value ?? 'ALL'))} />
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px] [&>*]:min-w-0">
        <Card>
          <CardHeader className="items-center">
            <CardTitle className="capitalize">{monthLabel}</CardTitle>
            <div className="flex gap-1.5">
              <Button asChild size="icon" variant="outline" aria-label="Mois précédent">
                <Link href={href({ mois: monthKey(prev), jour: undefined })}>
                  <ChevronLeft />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={href({ mois: undefined, jour: undefined })}>Aujourd’hui</Link>
              </Button>
              <Button asChild size="icon" variant="outline" aria-label="Mois suivant">
                <Link href={href({ mois: monthKey(next), jour: undefined })}>
                  <ChevronRight />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1.5 text-sm">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {d}.
                </div>
              ))}
              {grid.map((day) => {
                const k = day.toISOString().slice(0, 10);
                const inMonth = day.getUTCMonth() === month.getUTCMonth();
                const isToday = day.getTime() === today.getTime();
                const dayEvents = byDay.get(k) ?? [];
                return (
                  <div
                    key={k}
                    className={cn(
                      'min-h-16 rounded-lg border border-transparent bg-secondary/60 p-1.5 sm:min-h-20',
                      !inMonth && 'bg-secondary/25 text-muted-foreground/60',
                      isToday && 'border-muted-foreground/60',
                      k === shownDay && 'border-primary',
                    )}
                  >
                    <Link
                      href={href({ mois: monthKey(month), jour: k })}
                      aria-label={`Sorties du ${formatDate(day)}`}
                      className={cn(
                        'text-xs font-semibold hover:underline',
                        isToday && 'text-primary',
                      )}
                    >
                      {day.getUTCDate()}
                    </Link>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, MAX_PER_DAY).map((e) => (
                        <Link
                          key={`${e.kind}-${e.id}`}
                          href={e.href}
                          title={e.title}
                          className={cn(
                            'block truncate rounded px-1.5 py-0.5 text-[10px] leading-tight font-semibold',
                            chipClass(eventType(e)),
                          )}
                        >
                          {eventLabel(e)}
                        </Link>
                      ))}
                      {dayEvents.length > MAX_PER_DAY && (
                        <Link
                          href={href({ mois: monthKey(month), jour: k })}
                          className="block px-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                        >
                          +{dayEvents.length - MAX_PER_DAY}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <DayPanel day={shownDay} events={shownDay ? (byDay.get(shownDay) ?? []) : []} />
          <Card>
            <CardHeader>
              <CardTitle>À venir</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune sortie à venir connue.</p>
              ) : (
                <ul className="divide-y">
                  {upcoming.map((e) => (
                    <li key={`${e.kind}-${e.id}`} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={e.href}
                          className="block truncate text-sm font-semibold hover:underline"
                          title={e.title}
                        >
                          {upcomingTitle(e)}
                        </Link>
                        <p className="text-xs text-muted-foreground">{shortDate.format(e.date)}</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-primary tabular-nums">
                        {countdown(e.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

/** Couleur de chaque type de sortie (pastilles des filtres et cases du calendrier). */
const TYPE_COLOR: Record<string, { dot: string; chip: string }> = {
  ALL: { dot: 'bg-current', chip: '' },
  extension: { dot: 'bg-foreground', chip: 'bg-foreground/15 text-foreground' },
  ETB: { dot: 'bg-chart-2', chip: 'bg-chart-2/25 text-chart-2' },
  DISPLAY: { dot: 'bg-chart-3', chip: 'bg-chart-3/20 text-chart-3' },
  TRIPACK: { dot: 'bg-chart-4', chip: 'bg-chart-4/20 text-chart-4' },
  COFFRET: { dot: 'bg-chart-5', chip: 'bg-chart-5/20 text-chart-5' },
  BOOSTER: { dot: 'bg-primary', chip: 'bg-primary/20 text-primary' },
  BLISTER: { dot: 'bg-primary', chip: 'bg-primary/20 text-primary' },
  MINI_TIN: { dot: 'bg-chart-5', chip: 'bg-chart-5/20 text-chart-5' },
};
const OTHER_COLOR = { dot: 'bg-muted-foreground', chip: 'bg-muted-foreground/20 text-foreground' };
const dotClass = (type: string) => (TYPE_COLOR[type] ?? OTHER_COLOR).dot;
const chipClass = (type: string) => (TYPE_COLOR[type] ?? OTHER_COLOR).chip;

/** Type d'une sortie : « extension » pour une extension TCGdex, sinon le type de produit. */
const eventType = (e: CalendarEvent) =>
  e.productType ?? (e.href.startsWith('/extensions/') ? 'extension' : 'AUTRE');
/** Libellé court dans une case : type de produit, ou nom de l'extension. */
const eventLabel = (e: CalendarEvent) =>
  e.productType ? (typeLabel(e.productType) ?? e.title) : e.title;
const upcomingTitle = (e: CalendarEvent) =>
  e.productType && e.subtitle && !e.title.includes(e.subtitle)
    ? `${typeLabel(e.productType)} — ${e.subtitle}`
    : e.title;

const shortDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const longDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
function countdown(date: Date): string {
  const days = Math.round((date.getTime() - todayUtc().getTime()) / 86_400_000);
  if (days === 0) return 'Jour J';
  return days > 0 ? `J-${days}` : `J+${-days}`;
}

/** Détail du jour choisi : extension et produits qui sortent, prix conseillés. */
function DayPanel({ day, events }: { day: string | undefined; events: CalendarEvent[] }) {
  if (!day) {
    return (
      <Card className="holo-frame">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Cliquez sur un jour pour voir ses sorties.
        </CardContent>
      </Card>
    );
  }
  const date = new Date(`${day}T00:00:00Z`);
  const main = events.find((e) => e.href.startsWith('/extensions/')) ?? events[0];
  const items = events.filter((e) => e !== main || events.length === 1);
  return (
    <Card className="holo-frame">
      <CardContent className="space-y-3 pt-5">
        <p className="text-xs text-muted-foreground first-letter:uppercase">
          {longDate.format(date)} · {countdown(date)}
        </p>
        {main ? (
          <>
            <Link
              href={main.href}
              className="block font-display text-xl leading-tight font-bold hover:underline"
            >
              {main.productType ? (main.subtitle ?? main.title) : main.title}
            </Link>
            <ul className="divide-y border-y text-sm">
              {items.map((e) => (
                <li key={`${e.kind}-${e.id}`} className="flex items-center gap-2 py-2">
                  <span
                    aria-hidden
                    className={cn('size-1.5 shrink-0 rounded-full', dotClass(eventType(e)))}
                  />
                  <Link
                    href={e.href}
                    className="min-w-0 flex-1 truncate hover:underline"
                    title={e.title}
                  >
                    {e.title}
                  </Link>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {e.msrp !== null ? formatPrice(e.msrp) : '—'}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href={main.href}>
                  {main.href.startsWith('/extensions/') ? 'Voir l’extension' : 'Voir le produit'}
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Source :{' '}
              {main.source ? (SOURCE_LABEL[main.source] ?? main.source) : 'import automatique'}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune sortie ce jour-là.</p>
        )}
      </CardContent>
    </Card>
  );
}
