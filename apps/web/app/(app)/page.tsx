import Link from 'next/link';
import { formatPercent, formatPrice, todayUtc } from '@tcgwatch/shared';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { TrendChart } from '@/components/trend-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboard } from '@/lib/data/dashboard';
import { ago } from '@/lib/time';
import { cn } from '@/lib/utils';
import { acknowledgeAlertAction, acknowledgeAllAlertsAction } from './produits/actions';

const ALERT_STYLE = {
  BACK_IN_STOCK: { label: 'Retour en stock', className: 'text-success' },
  PREORDER_OPEN: { label: 'Précommande', className: 'text-info' },
  PRICE_TARGET: { label: 'Prix cible', className: 'text-primary' },
  RELEASE_DATE: { label: 'Date de sortie', className: 'text-info' },
  NEW_LOW: { label: 'Plus bas historique', className: 'text-success' },
  MARKET_MOVE: { label: 'Variation marché', className: 'text-warning' },
  CARD_PRICE: { label: 'Carte', className: 'text-chart-2' },
  MARKET_DEAL: { label: 'Bon prix', className: 'text-success' },
} as const;

const month = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const DAY_MS = 86_400_000;

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{children}</p>;
}

export default async function DashboardPage() {
  const d = await getDashboard();
  const v = d.valuation;
  const gainPositive = v.unrealizedGain >= 0;
  const today = todayUtc().getTime();

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={`${d.trackedCount} fiche${d.trackedCount > 1 ? 's' : ''} revendeur suivie${
          d.trackedCount > 1 ? 's' : ''
        }${d.lastCheckedAt ? ` · dernier relevé ${ago(d.lastCheckedAt)}` : ''}`}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] [&>*]:min-w-0">
        {/* Valeur de la collection */}
        <Card className="holo-frame flex flex-col justify-end">
          <CardContent className="flex flex-1 flex-col justify-end gap-3 pt-6">
            {d.collectionHistory.length > 1 && (
              <TrendChart
                data={d.collectionHistory}
                height="h-36"
                series={[
                  { key: 'value', label: 'Valeur estimée', color: 'var(--chart-2)', width: 2.5 },
                  {
                    key: 'invested',
                    label: 'Total investi',
                    color: 'var(--muted-foreground)',
                    dashed: true,
                    step: true,
                  },
                ]}
              />
            )}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Ma collection · valeur estimée</p>
              <p className="font-display text-5xl font-extrabold tracking-tight tabular-nums md:text-6xl">
                {formatPrice(v.estimatedValue)}
              </p>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-2 text-sm">
              <p className="text-muted-foreground">
                Investi {formatPrice(v.totalCost)} ·{' '}
                <span
                  className={cn(
                    'font-semibold',
                    gainPositive ? 'text-success' : 'text-destructive',
                  )}
                >
                  {gainPositive ? '+' : ''}
                  {formatPrice(v.unrealizedGain)} (
                  {formatPercent(v.ratio !== null ? v.ratio - 1 : null)})
                </span>
                {v.estimatedFromRetail > 0 &&
                  ` · dont ${formatPrice(v.estimatedFromRetail)} au prix boutique`}
              </p>
              <Link
                href="/collection"
                className="font-semibold text-primary underline underline-offset-4"
              >
                Voir la collection
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Alertes actives */}
        <Card>
          <CardHeader className="items-center">
            <CardTitle>Alertes · {d.alerts.count}</CardTitle>
            {d.alerts.count > 0 && (
              <form action={acknowledgeAllAlertsAction}>
                <Button size="sm" variant="ghost" type="submit" className="text-muted-foreground">
                  Tout marquer lu
                </Button>
              </form>
            )}
          </CardHeader>
          <CardContent>
            {d.alerts.items.length === 0 ? (
              <Empty>Aucune alerte en attente.</Empty>
            ) : (
              <ul className="divide-y">
                {d.alerts.items.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 space-y-0.5">
                      <p className={cn('text-xs font-semibold', ALERT_STYLE[a.type].className)}>
                        {ALERT_STYLE[a.type].label}
                      </p>
                      <Link
                        href={
                          a.product
                            ? `/produits/${a.product.id}`
                            : `/cartes/${encodeURIComponent(a.chaseCard?.tcgdexId ?? '')}`
                        }
                        className="block truncate text-sm font-semibold hover:underline"
                      >
                        {a.product?.name ?? a.chaseCard?.name ?? '—'}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground" title={a.message}>
                        {a.message}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {a.url && (
                        <Button asChild size="sm" variant="outline">
                          <a href={a.url} target="_blank" rel="noopener noreferrer">
                            {a.product ? 'Acheter' : 'Voir'}
                          </a>
                        </Button>
                      )}
                      <form action={acknowledgeAlertAction.bind(null, a.id)}>
                        <Button
                          size="sm"
                          variant="ghost"
                          type="submit"
                          aria-label="Marquer comme lue"
                          title="Marquer comme lue"
                        >
                          ✓
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        {/* Prochaines sorties */}
        <Card>
          <CardHeader className="items-center">
            <CardTitle>Prochaines sorties</CardTitle>
            <Link
              href="/calendrier"
              className="text-sm font-semibold text-primary underline underline-offset-4"
            >
              Calendrier
            </Link>
          </CardHeader>
          <CardContent>
            {d.upcoming.length === 0 ? (
              <Empty>Aucune sortie à venir connue.</Empty>
            ) : (
              <ul className="space-y-2">
                {d.upcoming.map((e) => {
                  const days = Math.max(0, Math.ceil((e.date.getTime() - today) / DAY_MS));
                  return (
                    <li key={`${e.kind}-${e.id}`} className="flex items-center gap-3">
                      <span className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-secondary py-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                          {month.format(e.date)}
                        </span>
                        <span className="font-display text-lg leading-none font-bold">
                          {String(e.date.getUTCDate()).padStart(2, '0')}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={e.href}
                          title={e.title}
                          className="block truncate text-sm font-semibold hover:underline"
                        >
                          {e.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {e.msrp !== null
                            ? `Prix conseillé ${formatPrice(e.msrp)}`
                            : (e.subtitle ?? 'Prix conseillé inconnu')}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-primary tabular-nums">
                        {days === 0 ? 'Jour J' : `J-${days}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Derniers retours en stock */}
        <Card>
          <CardHeader className="items-center">
            <CardTitle>Derniers retours en stock</CardTitle>
            <Link
              href="/retours-en-stock"
              className="text-sm font-semibold text-primary underline underline-offset-4"
            >
              Tout voir
            </Link>
          </CardHeader>
          <CardContent>
            {d.restocks.length === 0 ? (
              <Empty>Aucun retour en stock détecté pour l’instant.</Empty>
            ) : (
              <ul className="space-y-2">
                {d.restocks.map((r) =>
                  !r.product ? null : (
                    <li key={r.id} className="flex items-center gap-3">
                      <Thumb
                        src={r.product.imageUrl ?? r.product.images[0] ?? r.listing?.lastImageUrl}
                        className="size-11"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/produits/${r.product.id}`}
                          className="block truncate text-sm font-semibold hover:underline"
                        >
                          {r.product.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {r.listing?.retailer.name ?? '—'} · {ago(r.createdAt)}
                        </p>
                      </div>
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-sm font-bold tabular-nums hover:underline"
                          title="Acheter"
                        >
                          {formatPrice(r.price)}
                        </a>
                      ) : (
                        <span className="shrink-0 text-sm font-bold tabular-nums">
                          {formatPrice(r.price)}
                        </span>
                      )}
                    </li>
                  ),
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top variations 30 j */}
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Top variations · 30 j</CardTitle>
        </CardHeader>
        <CardContent>
          {d.moves.length === 0 ? (
            <Empty>Pas encore assez d’historique.</Empty>
          ) : (
            <ul className="divide-y">
              {d.moves.map((m) => {
                const up = m.change > 0;
                return (
                  <li
                    key={`${m.kind}-${m.productId}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/produits/${m.productId}`}
                        className="block truncate text-sm font-semibold hover:underline"
                      >
                        {m.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {m.kind === 'marché' ? 'Prix marché' : 'Meilleur prix boutique'} ·{' '}
                        {formatPrice(m.before)} → {formatPrice(m.after)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums',
                        up ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
                      )}
                    >
                      {formatPercent(m.change)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
