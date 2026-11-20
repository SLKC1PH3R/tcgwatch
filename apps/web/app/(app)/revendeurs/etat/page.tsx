import { CircleAlert, CircleCheck, CircleDashed, CircleX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import { isFailingListing, scrapeHealth, type ScrapeHealth } from '@tcgwatch/shared';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ago } from '@/lib/alerts';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'État des relevés' };

const HEALTH: Record<
  ScrapeHealth,
  { label: string; className: string; icon: typeof CircleCheck; order: number }
> = {
  down: { label: 'En panne', className: 'text-destructive', icon: CircleX, order: 0 },
  degraded: { label: 'En difficulté', className: 'text-warning', icon: CircleAlert, order: 1 },
  ok: { label: 'OK', className: 'text-success', icon: CircleCheck, order: 2 },
  idle: { label: 'Aucune fiche', className: 'text-muted-foreground', icon: CircleDashed, order: 3 },
};

type Props = { searchParams: Promise<{ etat?: string; r?: string }> };

/**
 * Santé des relevés par boutique : fiches en erreur, dernier relevé réussi, dernière erreur.
 * Utile quand un site change sa structure ou se met à bloquer les requêtes.
 */
export default async function ScrapeStatusPage({ searchParams }: Props) {
  const { etat, r: picked } = await searchParams;
  const now = new Date();
  const retailers = await prisma.retailer.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      enabled: true,
      access: true,
      listings: {
        where: { state: { not: 'PAUSED' } },
        select: {
          id: true,
          url: true,
          state: true,
          consecutiveErrors: true,
          lastError: true,
          lastCheckedAt: true,
          lastSuccessAt: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
  });

  const rows = retailers
    .filter((r) => r.listings.length > 0)
    .map((r) => {
      const failing = r.listings.filter(isFailingListing);
      const lastSuccess = r.listings.reduce<Date | null>(
        (max, l) => (l.lastSuccessAt && (!max || l.lastSuccessAt > max) ? l.lastSuccessAt : max),
        null,
      );
      const lastFailure = [...failing].sort(
        (a, b) => (b.lastCheckedAt?.getTime() ?? 0) - (a.lastCheckedAt?.getTime() ?? 0),
      )[0];
      return {
        ...r,
        health: r.enabled ? scrapeHealth(r.listings, now) : ('idle' as const),
        failing,
        lastSuccess,
        lastError: lastFailure?.lastError ?? null,
      };
    })
    .sort(
      (a, b) =>
        HEALTH[a.health].order - HEALTH[b.health].order ||
        b.failing.length - a.failing.length ||
        a.name.localeCompare(b.name, 'fr'),
    );
  const counts = Object.fromEntries(
    (Object.keys(HEALTH) as ScrapeHealth[]).map((h) => [
      h,
      rows.filter((r) => r.health === h).length,
    ]),
  ) as Record<ScrapeHealth, number>;
  const filter = (Object.keys(HEALTH) as ScrapeHealth[]).find((h) => h === etat);
  const shown = filter ? rows.filter((r) => r.health === filter) : rows;
  const selected =
    shown.find((r) => r.slug === picked) ?? shown.find((r) => r.failing.length > 0) ?? null;
  const failingListings = rows.reduce((n, r) => n + r.failing.length, 0);

  const href = (patch: { etat?: string; r?: string }) => {
    const params = new URLSearchParams();
    const next = { etat, r: picked, ...patch };
    if (next.etat) params.set('etat', next.etat);
    if (next.r) params.set('r', next.r);
    const qs = params.toString();
    return qs ? `/revendeurs/etat?${qs}` : '/revendeurs/etat';
  };

  return (
    <FitPage>
      <PageHeader
        title="État des relevés"
        description="Boutiques dont les fiches ne se relèvent plus : un site qui change sa structure ou bloque les requêtes apparaît ici en premier."
        actions={
          <Button asChild variant="outline">
            <Link href="/revendeurs">Revendeurs</Link>
          </Button>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-4">
        {(['down', 'degraded', 'ok'] as const).map((h) => {
          const Icon = HEALTH[h].icon;
          return (
            <Link
              key={h}
              href={href({ etat: filter === h ? undefined : h, r: undefined })}
              scroll={false}
              aria-current={filter === h ? 'true' : undefined}
              className={cn(
                'rounded-2xl border bg-card px-4 py-3 transition-colors hover:bg-accent',
                filter === h && 'border-foreground/40 bg-accent',
              )}
            >
              <p
                className={cn(
                  'flex items-center gap-1.5 text-xs font-semibold',
                  HEALTH[h].className,
                )}
              >
                <Icon className="size-3.5" /> {HEALTH[h].label}
              </p>
              <p className="font-display text-2xl font-bold tabular-nums">{counts[h]}</p>
              <p className="text-xs text-muted-foreground">boutique{counts[h] > 1 ? 's' : ''}</p>
            </Link>
          );
        })}
        <div className="rounded-2xl border bg-card px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">Fiches en erreur</p>
          <p className="font-display text-2xl font-bold tabular-nums">{failingListings}</p>
          <p className="text-xs text-muted-foreground">
            sur {rows.reduce((n, r) => n + r.listings.length, 0)} suivies
          </p>
        </div>
      </div>

      <div className={cn(fitGrid, 'xl:grid-cols-[minmax(0,1.6fr)_minmax(22rem,1fr)]')}>
        <Card className={cn(fitCard, 'pb-0')}>
          <CardHeader className="shrink-0">
            <CardTitle>
              {filter ? HEALTH[filter].label : 'Toutes les boutiques suivies'}{' '}
              <span className="text-sm font-normal text-muted-foreground">· {shown.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className={cn('px-0', fitScroll)}>
            {shown.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">Rien à signaler ici.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-xs tracking-wide text-muted-foreground uppercase fit:sticky fit:top-0 fit:z-10 fit:bg-card">
                    <tr className="border-b">
                      <th className="px-6 py-2.5 text-left font-semibold">Boutique</th>
                      <th className="px-3 py-2.5 text-left font-semibold">État</th>
                      <th className="px-3 py-2.5 text-right font-semibold">En erreur</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Dernier relevé réussi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {shown.map((r) => {
                      const h = HEALTH[r.health];
                      const Icon = h.icon;
                      const active = r.slug === selected?.slug;
                      return (
                        <tr key={r.id} className={cn(active && 'xl:bg-accent/60')}>
                          <td className="px-6 py-2.5">
                            <Link
                              href={href({ r: r.slug })}
                              scroll={false}
                              className="font-semibold hover:underline"
                            >
                              {r.name}
                            </Link>
                            {!r.enabled && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                relevés désactivés
                              </span>
                            )}
                            {r.lastError && (
                              <p
                                className="max-w-md truncate text-xs text-muted-foreground"
                                title={r.lastError}
                              >
                                {r.lastError}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 text-xs font-semibold',
                                h.className,
                              )}
                            >
                              <Icon className="size-3.5" /> {h.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className={cn(r.failing.length > 0 && 'font-semibold')}>
                              {r.failing.length}
                            </span>
                            <span className="text-muted-foreground"> / {r.listings.length}</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            {r.lastSuccess ? ago(r.lastSuccess) : 'jamais'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn(fitCard, 'hidden xl:flex')}>
          {selected ? (
            <>
              <CardHeader className="shrink-0">
                <div className="space-y-1">
                  <CardTitle>{selected.name}</CardTitle>
                  <CardDescription>
                    {selected.failing.length} fiche{selected.failing.length > 1 ? 's' : ''} en
                    erreur sur {selected.listings.length}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className={cn('space-y-2', fitScroll)}>
                {selected.failing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Toutes les fiches se relèvent.</p>
                ) : (
                  <ul className="divide-y">
                    {selected.failing.map((l) => (
                      <li key={l.id} className="space-y-0.5 py-2.5 first:pt-0">
                        <Link
                          href={`/produits/${l.product.id}`}
                          className="line-clamp-2 text-sm font-semibold hover:underline"
                        >
                          {l.product.name}
                        </Link>
                        <p className="text-xs text-destructive">
                          {l.consecutiveErrors} échec{l.consecutiveErrors > 1 ? 's' : ''} d’affilée
                          {l.state === 'BLOCKED_BY_ROBOTS' ? ' · bloqué par robots.txt' : ''}
                        </p>
                        {l.lastError && (
                          <p
                            className="line-clamp-2 text-xs text-muted-foreground"
                            title={l.lastError}
                          >
                            {l.lastError}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Réussi {l.lastSuccessAt ? ago(l.lastSuccessAt) : 'jamais'} ·{' '}
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            ouvrir la fiche
                          </a>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Aucune fiche en erreur : tout se relève normalement.
            </CardContent>
          )}
        </Card>
      </div>
    </FitPage>
  );
}
