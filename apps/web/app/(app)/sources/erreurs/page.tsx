import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ago } from '@/lib/alerts';
import { requireAdmin } from '@/lib/auth';
import { EBAY_DAILY_QUOTA } from '@/lib/data/sources';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';
import { todayUtc } from '@tcgwatch/shared';

export const metadata: Metadata = { title: 'Erreurs du worker' };

const SOURCES: Record<string, string> = {
  boutiques: 'Boutiques',
  tcgdex: 'TCGdex',
  ebay: 'eBay',
  cardmarket: 'Cardmarket',
  pokecardex: 'Pokécardex',
  notifications: 'Notifications',
  worker: 'Worker',
};

/** Début de la période affichée. */
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

type Props = { searchParams: Promise<{ source?: string; jours?: string }> };

/**
 * Erreurs récentes du worker : avertissements et erreurs regroupés (boutique en panne, TCGdex
 * indisponible, quota eBay…), fiches de boutiques en échec et tâches échouées.
 */
export default async function WorkerErrorsPage({ searchParams }: Props) {
  await requireAdmin();
  const { source, jours } = await searchParams;
  const days = [1, 7, 30].includes(Number(jours)) ? Number(jours) : 7;
  const since = daysAgo(days);
  const picked = source && SOURCES[source] ? source : undefined;
  const [errors, bySource, failedRuns, failingListings, ebayToday] = await Promise.all([
    prisma.workerError.findMany({
      where: { lastAt: { gte: since }, ...(picked ? { source: picked } : {}) },
      orderBy: { lastAt: 'desc' },
      take: 200,
    }),
    prisma.workerError.groupBy({
      by: ['source'],
      where: { lastAt: { gte: since } },
      _sum: { count: true },
      _count: { _all: true },
    }),
    prisma.jobRun.findMany({
      where: { ok: false, startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: { id: true, job: true, startedAt: true, error: true },
    }),
    prisma.listing.groupBy({
      by: ['retailerId'],
      where: { consecutiveErrors: { gte: 3 }, state: { not: 'PAUSED' } },
      _count: { _all: true },
      _max: { lastCheckedAt: true },
    }),
    prisma.apiUsage.findUnique({
      where: { source_day: { source: 'ebay', day: todayUtc() } },
      select: { calls: true },
    }),
  ]);
  const retailers = failingListings.length
    ? await prisma.retailer.findMany({
        where: { id: { in: failingListings.map((l) => l.retailerId) } },
        select: { id: true, name: true },
      })
    : [];
  const retailerName = new Map(retailers.map((r) => [r.id, r.name]));
  const counts = new Map(bySource.map((s) => [s.source, s._sum.count ?? 0]));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const ebayCalls = ebayToday?.calls ?? 0;
  const href = (patch: { source?: string | null; jours?: number }) => {
    const p = new URLSearchParams();
    const s = patch.source === null ? undefined : (patch.source ?? picked);
    if (s) p.set('source', s);
    const d = patch.jours ?? days;
    if (d !== 7) p.set('jours', String(d));
    const qs = p.toString();
    return qs ? `/sources/erreurs?${qs}` : '/sources/erreurs';
  };

  return (
    <FitPage>
      <PageHeader
        title="Erreurs du worker"
        description="Avertissements et erreurs des tâches, regroupés quand ils se répètent : boutique injoignable, TCGdex indisponible, quota eBay, envoi de notification…"
        actions={
          <Button asChild variant="outline">
            <Link href="/sources">Sources de données</Link>
          </Button>
        }
      />

      <div className="card-frame grid shrink-0 overflow-hidden rounded-[1.375rem] border bg-card sm:grid-cols-4 [&>*+*]:border-border max-sm:[&>*+*]:border-t sm:[&>*+*]:border-l">
        <Kpi label={`Erreurs (${days} j)`} value={total.toLocaleString('fr-FR')} />
        <Kpi label="Groupes distincts" value={String(errors.length)} />
        <Kpi
          label="Boutiques en échec"
          value={String(failingListings.length)}
          tone={failingListings.length ? 'text-warning' : undefined}
        />
        <Kpi
          label="Quota eBay du jour"
          value={`${Math.round((ebayCalls / EBAY_DAILY_QUOTA) * 100)} %`}
          hint={`${ebayCalls.toLocaleString('fr-FR')} / ${EBAY_DAILY_QUOTA.toLocaleString('fr-FR')} recherches`}
          tone={ebayCalls >= EBAY_DAILY_QUOTA * 0.9 ? 'text-destructive' : undefined}
        />
      </div>

      <nav aria-label="Filtres" className="flex shrink-0 flex-wrap items-center gap-2">
        <Chip href={href({ source: null })} on={!picked}>
          Toutes · {total}
        </Chip>
        {Object.entries(SOURCES).map(([key, label]) =>
          counts.get(key) ? (
            <Chip key={key} href={href({ source: key })} on={picked === key}>
              {label} · {counts.get(key)}
            </Chip>
          ) : null,
        )}
        <span className="ml-auto flex gap-1">
          {[1, 7, 30].map((d) => (
            <Chip key={d} href={href({ jours: d })} on={d === days}>
              {d} j
            </Chip>
          ))}
        </span>
      </nav>

      <div className={cn(fitGrid, 'xl:grid-cols-[minmax(0,1fr)_22rem]')}>
        <Card className={cn(fitCard, 'overflow-hidden py-0')}>
          {errors.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Aucune erreur sur cette période.
            </p>
          ) : (
            <div className={cn('overflow-x-auto', fitScroll)}>
              <table className="w-full min-w-[720px] text-sm">
                <thead className="label-mono text-muted-foreground fit:sticky fit:top-0 fit:z-10 fit:bg-card">
                  <tr className="border-b">
                    <th className="px-5 py-3 text-left font-medium">Dernière fois</th>
                    <th className="px-3 py-3 text-left font-medium">Source</th>
                    <th className="px-3 py-3 text-left font-medium">Erreur</th>
                    <th className="px-5 py-3 text-right font-medium">Fois</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {errors.map((e) => (
                    <tr key={e.id} className="align-top">
                      <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">
                        {ago(e.lastAt)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            'font-semibold',
                            e.level === 'error' ? 'text-destructive' : 'text-warning',
                          )}
                        >
                          {SOURCES[e.source] ?? e.source}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">
                          {e.message}
                          {e.subject && (
                            <span className="text-muted-foreground"> · {e.subject}</span>
                          )}
                        </p>
                        {e.detail && (
                          <p className="mt-0.5 line-clamp-2 font-mono text-xs break-all text-muted-foreground">
                            {e.detail}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-bold tabular-nums">
                        {e.count.toLocaleString('fr-FR')}
                        {e.count > 1 && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            depuis {ago(e.firstAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className={fitColumn}>
          <Card className="shrink-0 gap-3">
            <CardHeader>
              <CardTitle>Boutiques en échec</CardTitle>
              <CardDescription>Fiches en erreur au moins 3 relevés de suite.</CardDescription>
            </CardHeader>
            <CardContent>
              {failingListings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {failingListings
                    .sort((a, b) => b._count._all - a._count._all)
                    .map((l) => (
                      <li key={l.retailerId} className="flex justify-between gap-2 py-1.5">
                        <span className="truncate">{retailerName.get(l.retailerId) ?? '—'}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {l._count._all} fiche{l._count._all > 1 ? 's' : ''}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
              <Link
                href="/revendeurs/etat"
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                État des relevés
              </Link>
            </CardContent>
          </Card>
          <Card className={cn(fitCard, 'gap-3')}>
            <CardHeader className="shrink-0">
              <CardTitle>Tâches échouées</CardTitle>
              <CardDescription>Passages complets du worker terminés en erreur.</CardDescription>
            </CardHeader>
            <CardContent className={fitScroll}>
              {failedRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {failedRuns.map((r) => (
                    <li key={r.id}>
                      <p className="font-semibold">
                        {r.job}{' '}
                        <span className="font-normal text-muted-foreground">
                          · {ago(r.startedAt)}
                        </span>
                      </p>
                      {r.error && (
                        <p className="line-clamp-2 font-mono text-xs break-all text-muted-foreground">
                          {r.error}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </FitPage>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="label-mono text-muted-foreground">{label}</p>
      <p className={cn('mt-1.5 font-display text-2xl font-bold tabular-nums', tone)}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-semibold tabular-nums transition-colors hover:bg-accent',
        on && 'border-primary bg-primary text-primary-foreground hover:bg-primary',
      )}
    >
      {children}
    </Link>
  );
}
