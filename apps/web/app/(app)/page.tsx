import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  CalendarDays,
  PackageCheck,
  Vault,
} from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatDateTime, formatPercent, formatPrice } from '@tcgwatch/shared';
import { Countdown } from '@/components/countdown';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { TrendChart } from '@/components/trend-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboard } from '@/lib/data/dashboard';
import { cn } from '@/lib/utils';
import { acknowledgeAlertAction, acknowledgeAllAlertsAction } from './produits/actions';

const ALERT_LABEL = {
  BACK_IN_STOCK: 'Retour en stock',
  PREORDER_OPEN: 'Précommande',
  PRICE_TARGET: 'Prix cible',
  RELEASE_DATE: 'Date de sortie',
  NEW_LOW: 'Plus bas historique',
  MARKET_MOVE: 'Variation marché',
  CARD_PRICE: 'Carte',
} as const;

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{children}</p>;
}

export default async function DashboardPage() {
  const d = await getDashboard();
  const gainPositive = d.valuation.unrealizedGain >= 0;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={`${d.trackedCount} fiche(s) revendeur suivie(s)`}
        actions={
          <Button asChild>
            <Link href="/produits/ajouter">Suivre une URL</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* Valeur de la collection */}
        <Card className="holo-frame md:col-span-2">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Vault className="size-4 text-muted-foreground" /> Ma collection
              </CardTitle>
              <CardDescription>{d.itemCount} ligne(s)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-display text-5xl font-extrabold tracking-tight tabular-nums md:text-6xl">
                {formatPrice(d.valuation.estimatedValue)}
              </p>
              <p className="text-sm text-muted-foreground">valeur estimée</p>
            </div>
            <div className="grid max-w-md grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Investi</p>
                <p className="font-medium tabular-nums">{formatPrice(d.valuation.totalCost)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Plus-value latente</p>
                <p
                  className={cn(
                    'font-medium tabular-nums',
                    gainPositive ? 'text-success' : 'text-destructive',
                  )}
                >
                  {gainPositive ? '+' : ''}
                  {formatPrice(d.valuation.unrealizedGain)}{' '}
                  <span className="text-xs">
                    ({formatPercent(d.valuation.ratio !== null ? d.valuation.ratio - 1 : null)})
                  </span>
                </p>
              </div>
            </div>
            {d.valuation.estimatedFromRetail > 0 && (
              <p className="text-xs text-muted-foreground">
                Dont {formatPrice(d.valuation.estimatedFromRetail)} estimés au prix boutique (pas de
                prix marché).
              </p>
            )}
            {d.collectionHistory.length > 1 && (
              <TrendChart
                data={d.collectionHistory}
                height="h-44"
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
          </CardContent>
        </Card>

        {/* Alertes actives */}
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <BellRing className="size-4 text-muted-foreground" /> Alertes actives
              </CardTitle>
              <CardDescription>{d.alerts.count} non lue(s)</CardDescription>
            </div>
            {d.alerts.count > 0 && (
              <form action={acknowledgeAllAlertsAction}>
                <Button size="sm" variant="ghost" type="submit">
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
                  <li key={a.id} className="flex items-start justify-between gap-2 py-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant={a.type === 'PRICE_TARGET' ? 'warning' : 'success'}>
                          {ALERT_LABEL[a.type]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(a.createdAt)}
                        </span>
                      </div>
                      <Link
                        href={
                          a.product
                            ? `/produits/${a.product.id}`
                            : `/cartes/${encodeURIComponent(a.chaseCard?.tcgdexId ?? '')}`
                        }
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {a.product?.name ?? a.chaseCard?.name ?? '—'}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{a.message}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
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

        {/* Prochaines sorties */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" /> Prochaines sorties
            </CardTitle>
            <Link href="/calendrier" className="text-sm text-primary hover:underline">
              Calendrier
            </Link>
          </CardHeader>
          <CardContent>
            {d.upcoming.length === 0 ? (
              <Empty>Aucune sortie à venir connue.</Empty>
            ) : (
              <ul className="divide-y">
                {d.upcoming.map((e) => (
                  <li
                    key={`${e.kind}-${e.id}`}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Thumb src={e.imageUrl} />
                      <div className="min-w-0">
                        <Link
                          href={e.href}
                          title={e.title}
                          className="line-clamp-2 text-sm font-medium hover:underline"
                        >
                          {e.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(e.date)}
                          {e.subtitle ? ` · ${e.subtitle}` : ''}
                          {e.msrp !== null ? ` · ${formatPrice(e.msrp)}` : ''}
                        </p>
                      </div>
                    </div>
                    <Countdown date={e.date} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Derniers retours en stock */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="size-4 text-muted-foreground" /> Derniers retours en stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.restocks.length === 0 ? (
              <Empty>Aucun retour en stock détecté pour l’instant.</Empty>
            ) : (
              <ul className="divide-y">
                {d.restocks.map((r) =>
                  !r.product ? null : (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Thumb
                          src={r.product.imageUrl ?? r.product.images[0] ?? r.listing?.lastImageUrl}
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/produits/${r.product.id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {r.product.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {ALERT_LABEL[r.type]} · {r.listing?.retailer.name ?? '—'} ·{' '}
                            {formatDateTime(r.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium tabular-nums">
                          {formatPrice(r.price)}
                        </span>
                        {r.url && (
                          <Button asChild size="sm">
                            <a href={r.url} target="_blank" rel="noopener noreferrer">
                              Acheter
                            </a>
                          </Button>
                        )}
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Top variations 30 j */}
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Top variations · 30 j</CardTitle>
              <CardDescription>Meilleur prix boutique et prix marché</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {d.moves.length === 0 ? (
              <Empty>Pas encore assez d’historique.</Empty>
            ) : (
              <ul className="divide-y">
                {d.moves.map((m) => {
                  const up = m.change > 0;
                  const Icon = up ? ArrowUpRight : ArrowDownRight;
                  return (
                    <li
                      key={`${m.kind}-${m.productId}`}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/produits/${m.productId}`}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {m.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {m.kind} · {formatPrice(m.before)} → {formatPrice(m.after)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'flex items-center gap-0.5 text-sm font-medium tabular-nums',
                          up ? 'text-destructive' : 'text-success',
                          m.kind === 'marché' && (up ? 'text-success' : 'text-destructive'),
                        )}
                      >
                        <Icon className="size-4" />
                        {formatPercent(m.change)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
