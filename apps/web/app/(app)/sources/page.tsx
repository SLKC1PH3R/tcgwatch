import { CircleAlert, CircleCheck, CircleDashed, CircleX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate } from '@tcgwatch/shared';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ago } from '@/lib/alerts';
import { requireAdmin } from '@/lib/auth';
import { getIncompleteReleases, getSourcesStatus } from '@/lib/data/sources';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Sources de données' };

const HEALTH = {
  ok: { label: 'OK', className: 'text-success', icon: CircleCheck },
  degraded: { label: 'Erreurs récentes', className: 'text-warning', icon: CircleAlert },
  down: { label: 'En panne ou en retard', className: 'text-destructive', icon: CircleX },
  unknown: {
    label: 'Pas encore de passage',
    className: 'text-muted-foreground',
    icon: CircleDashed,
  },
} as const;

const duration = (ms: number | null) =>
  ms === null ? '' : ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`;

/**
 * Tableau de bord des sources : dernier passage réussi de chaque tâche, erreurs, quota eBay, et
 * extensions incomplètes (sans images, sans reverses).
 */
export default async function SourcesPage() {
  await requireAdmin();
  const [{ jobs, ebay }, incomplete] = await Promise.all([
    getSourcesStatus(),
    getIncompleteReleases(),
  ]);
  const pct = Math.min(100, Math.round((ebay.today / ebay.quota) * 100));

  return (
    <FitPage>
      <PageHeader
        title="Sources de données"
        description="Dernier passage réussi de chaque tâche du worker, erreurs des dernières 24 h, quota eBay du jour et extensions encore incomplètes."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/sources/erreurs">Erreurs du worker</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/revendeurs/etat">État des relevés</Link>
            </Button>
          </>
        }
      />
      <div className="grid shrink-0 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card px-4 py-3 sm:col-span-1">
          <p className="text-xs font-semibold text-muted-foreground">Quota eBay du jour</p>
          <p className="font-display text-2xl font-bold tabular-nums">
            {ebay.today.toLocaleString('fr-FR')}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              / {ebay.quota.toLocaleString('fr-FR')}
            </span>
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-warning' : 'bg-info',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            7 jours : {ebay.days.map((d) => d.calls.toLocaleString('fr-FR')).join(' · ') || '—'}
          </p>
        </div>
        {(['down', 'degraded'] as const).map((h) => {
          const n = jobs.filter((j) => j.health === h).length;
          const Icon = HEALTH[h].icon;
          return (
            <div key={h} className="rounded-2xl border bg-card px-4 py-3">
              <p
                className={cn(
                  'flex items-center gap-1.5 text-xs font-semibold',
                  HEALTH[h].className,
                )}
              >
                <Icon className="size-3.5" /> {HEALTH[h].label}
              </p>
              <p className="font-display text-2xl font-bold tabular-nums">{n}</p>
              <p className="text-xs text-muted-foreground">tâche{n > 1 ? 's' : ''}</p>
            </div>
          );
        })}
      </div>

      <div className={cn(fitGrid, 'xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)]')}>
        <Card className={cn(fitCard, 'pb-0')}>
          <CardHeader className="shrink-0">
            <CardTitle>Tâches du worker</CardTitle>
          </CardHeader>
          <CardContent className={cn('px-0', fitScroll)}>
            <ul className="divide-y">
              {jobs.map((j) => {
                const h = HEALTH[j.health];
                const Icon = h.icon;
                return (
                  <li key={j.job} className="space-y-0.5 px-6 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{j.label}</p>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 text-xs font-semibold',
                          h.className,
                        )}
                      >
                        <Icon className="size-3.5" /> {h.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {j.source} · dernier succès {j.lastOk ? ago(j.lastOk.startedAt) : 'jamais'}
                      {j.last?.finishedAt && ` · durée ${duration(j.durationMs)}`} · {j.runs24h}{' '}
                      passage
                      {j.runs24h > 1 ? 's' : ''} en 24 h
                      {j.failures24h > 0 && `, ${j.failures24h} en erreur`}
                    </p>
                    {j.lastFailure?.error && (
                      <p
                        className="line-clamp-2 text-xs text-destructive"
                        title={j.lastFailure.error}
                      >
                        Dernière erreur ({ago(j.lastFailure.startedAt)}) : {j.lastFailure.error}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card className={cn(fitCard, 'pb-0')}>
          <CardHeader className="shrink-0">
            <CardTitle>
              Extensions incomplètes{' '}
              <span className="font-sans text-sm text-muted-foreground">· {incomplete.length}</span>
            </CardTitle>
            <CardDescription>
              Cartes sans image, ou extension récente pour laquelle aucune reverse n’est connue.
            </CardDescription>
          </CardHeader>
          <CardContent className={cn('px-0', fitScroll)}>
            {incomplete.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Toutes les extensions sont complètes.
              </p>
            ) : (
              <ul className="divide-y">
                {incomplete.map((r) => (
                  <li key={r.code}>
                    <Link
                      href={`/collection/cartes/ajout-rapide?extension=${encodeURIComponent(r.code)}`}
                      className="block px-6 py-2.5 transition-colors hover:bg-accent"
                    >
                      <p className="truncate text-sm font-semibold">
                        {r.name}{' '}
                        <span className="font-normal text-muted-foreground">
                          · {r.code}
                          {r.releaseDate ? ` · ${formatDate(r.releaseDate)}` : ''}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.noImage > 0 && (
                          <span className="text-warning">
                            {r.noImage}/{r.cards} sans image
                          </span>
                        )}
                        {r.noImage > 0 && r.noReverse && ' · '}
                        {r.noReverse && <span className="text-warning">aucune reverse connue</span>}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </FitPage>
  );
}
