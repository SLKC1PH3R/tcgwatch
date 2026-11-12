import { Check, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate, PRODUCT_TYPE_LABELS, todayUtc, type ProductTypeKey } from '@tcgwatch/shared';
import { Countdown } from '@/components/countdown';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getCalendarEvents,
  getReleasesForEdit,
  getUpcomingEvents,
  type CalendarEvent,
} from '@/lib/data/releases';
import { toDateInput } from '@/lib/form';
import { cn } from '@/lib/utils';
import {
  createReleaseAction,
  deleteReleaseAction,
  updateReleaseAction,
  validateReleaseAction,
} from './actions';
import { ReleaseForm } from './release-form';

export const metadata: Metadata = { title: 'Calendrier des sorties' };

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const SOURCE_LABEL: Record<string, string> = {
  TCGDEX: 'TCGdex',
  RETAILER: 'Revendeur',
  MANUAL: 'Manuel',
  SEED: 'Seed',
};

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
  searchParams: Promise<{ mois?: string; tout?: string; edit?: string }>;
}) {
  const { mois, tout, edit } = await searchParams;
  const month = parseMonth(mois);
  const grid = buildGrid(month);
  const prev = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));
  const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  const today = todayUtc();

  const [events, upcoming, releases] = await Promise.all([
    getCalendarEvents(grid[0]!, new Date(grid[41]!.getTime() + 86_400_000)),
    getUpcomingEvents(15),
    getReleasesForEdit(),
  ]);

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const k = e.date.toISOString().slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }

  const recentLimit = new Date(today.getTime() - 60 * 86_400_000);
  const shownReleases = tout
    ? releases
    : releases.filter((r) => !r.releaseDate || r.releaseDate >= recentLimit);
  const monthLabel = month.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <>
      <PageHeader
        title="Calendrier des sorties"
        description="Import quotidien TCGdex, enrichi par les dates « Sortie prévue le » détectées chez les revendeurs."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader className="items-center">
            <CardTitle className="capitalize">{monthLabel}</CardTitle>
            <div className="flex gap-1">
              <Button asChild size="icon" variant="outline" aria-label="Mois précédent">
                <Link href={`/calendrier?mois=${monthKey(prev)}`}>
                  <ChevronLeft />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/calendrier">Aujourd’hui</Link>
              </Button>
              <Button asChild size="icon" variant="outline" aria-label="Mois suivant">
                <Link href={`/calendrier?mois=${monthKey(next)}`}>
                  <ChevronRight />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 overflow-hidden rounded-lg border text-sm">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="border-b bg-muted/50 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
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
                      'min-h-20 border-r border-b p-1 last:border-r-0 sm:min-h-24 [&:nth-child(7n)]:border-r-0',
                      !inMonth && 'bg-muted/30 text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex size-6 items-center justify-center rounded-full text-xs',
                        isToday && 'bg-primary font-semibold text-primary-foreground',
                      )}
                    >
                      {day.getUTCDate()}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayEvents.map((e) => (
                        <Link
                          key={`${e.kind}-${e.id}`}
                          href={e.href}
                          title={e.title}
                          className={cn(
                            'block truncate rounded px-1 py-0.5 text-[11px] leading-tight font-medium',
                            e.kind === 'release'
                              ? 'bg-primary/15 text-primary'
                              : 'bg-chart-2/20 text-foreground',
                          )}
                        >
                          {e.subtitle && e.kind === 'release' ? `${e.subtitle} · ` : ''}
                          {e.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-3 rounded bg-primary/15" /> Sortie / extension
              </span>
              <span className="flex items-center gap-1">
                <span className="size-3 rounded bg-chart-2/20" /> Date propre à un produit
                (revendeur)
              </span>
            </p>
          </CardContent>
        </Card>

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
                  <li
                    key={`${e.kind}-${e.id}`}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <Link
                        href={e.href}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {e.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(e.date)}
                        {e.status === 'AUTO' && ' · à valider'}
                      </p>
                    </div>
                    <Countdown date={e.date} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Sorties</CardTitle>
              <CardDescription>
                {tout ? 'Toutes les sorties.' : 'À venir et 60 derniers jours.'}{' '}
                <Link
                  href={tout ? '/calendrier' : '/calendrier?tout=1'}
                  className="text-primary hover:underline"
                >
                  {tout ? 'Masquer les anciennes' : 'Tout afficher'}
                </Link>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {shownReleases.map((r) => (
                <li key={r.id} id={`release-${r.id}`} className="scroll-mt-20 py-3">
                  <details open={edit === r.id}>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            referrerPolicy="no-referrer"
                            src={r.imageUrl}
                            alt=""
                            className="h-8 w-16 shrink-0 object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-8 w-16 shrink-0 rounded bg-muted" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {r.nameFr}{' '}
                            {r.setCode && (
                              <span className="text-muted-foreground">({r.setCode})</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(r.releaseDate)}
                            {r.productType &&
                              ` · ${PRODUCT_TYPE_LABELS[r.productType as ProductTypeKey]}`}
                            {` · ${SOURCE_LABEL[r.source] ?? r.source}`}
                            {r._count.products > 0 && ` · ${r._count.products} produit(s)`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.releaseDate && r.releaseDate >= today && (
                          <Countdown date={r.releaseDate} />
                        )}
                        <Badge variant={r.status === 'VALIDATED' ? 'success' : 'warning'}>
                          {r.status === 'VALIDATED' ? 'Validé' : 'Auto'}
                        </Badge>
                        <span className="text-xs text-primary">Modifier</span>
                      </div>
                    </summary>
                    <div className="mt-4 space-y-3 rounded-lg border p-4">
                      <ReleaseForm
                        action={updateReleaseAction.bind(null, r.id)}
                        submitLabel="Enregistrer et valider"
                        values={{
                          id: r.id,
                          nameFr: r.nameFr,
                          setCode: r.setCode,
                          releaseDate: toDateInput(r.releaseDate),
                          productType: r.productType,
                          imageUrl: r.imageUrl,
                          notes: r.notes,
                          status: r.status,
                        }}
                      />
                      <div className="flex gap-2 border-t pt-3">
                        {r.status === 'AUTO' && (
                          <form action={validateReleaseAction.bind(null, r.id)}>
                            <Button size="sm" variant="success" type="submit">
                              <Check /> Valider tel quel
                            </Button>
                          </form>
                        )}
                        <form action={deleteReleaseAction.bind(null, r.id)}>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="submit"
                            className="text-destructive"
                          >
                            <Trash2 /> Supprimer
                          </Button>
                        </form>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader className="flex-col">
            <CardTitle>Ajouter une sortie</CardTitle>
            <CardDescription>
              Coffret spécial, UPC, date annoncée… (statut « validé »).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReleaseForm action={createReleaseAction} submitLabel="Ajouter" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
