import Link from 'next/link';
import { formatPercent, formatPrice, todayUtc } from '@tcgwatch/shared';
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

/** Couleurs de la répartition par type (ordre : du plus gros au plus petit). */
const SHARE_COLORS = [
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-1)',
];

const month = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const DAY_MS = 86_400_000;

/**
 * Carte de l'accueil : sur un écran assez grand, elle prend la hauteur que lui donne la grille
 * et fait défiler son propre contenu au besoin (la page, elle, ne défile pas).
 */
const tile = 'gap-3 py-5 fit:min-h-0 fit:overflow-hidden';
// Fondu en bas : signale qu'une liste trop longue continue (elle défile dans sa carte).
const tileBody =
  'fit:min-h-0 fit:flex-1 fit:overflow-y-auto fit:pb-2 fit:[mask-image:linear-gradient(to_bottom,#000_calc(100%-1.75rem),transparent)]';

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{children}</p>;
}

function SeeAll({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 text-sm font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}

const countdown = (date: Date, today: number) => {
  const days = Math.max(0, Math.ceil((date.getTime() - today) / DAY_MS));
  return days === 0 ? 'Jour J' : `J-${days}`;
};

export default async function DashboardPage() {
  const d = await getDashboard();
  const v = d.valuation;
  const gainPositive = v.unrealizedGain >= 0;
  const today = todayUtc().getTime();
  const [next, ...later] = d.upcoming;

  return (
    <div data-fit-screen className="flex flex-col gap-4 fit:min-h-0 fit:flex-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Tableau de bord
        </h1>
        <p className="text-sm text-muted-foreground">
          {d.trackedCount} fiche{d.trackedCount > 1 ? 's' : ''} revendeur suivie
          {d.trackedCount > 1 ? 's' : ''}
          {d.lastCheckedAt ? ` · dernier relevé ${ago(d.lastCheckedAt)}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1.2fr)_minmax(0,1fr)] [&>*]:min-w-0">
        {/* Valeur de la collection + répartition par type */}
        <Card className={cn('holo-frame md:col-span-2 lg:col-span-6', tile)}>
          <CardContent className="flex flex-col gap-5 sm:flex-row fit:min-h-0 fit:flex-1">
            <div className="flex min-w-0 flex-1 flex-col gap-2 fit:min-h-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-muted-foreground">Ma collection · valeur estimée</p>
                <SeeAll href="/collection">Voir la collection</SeeAll>
              </div>
              <p className="font-display text-4xl font-extrabold tracking-tight tabular-nums xl:text-5xl">
                {formatPrice(v.estimatedValue)}
              </p>
              <p className="text-sm text-muted-foreground">
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
              </p>
              {d.collectionHistory.length > 1 && (
                <div className="mt-1 fit:min-h-20 fit:flex-1">
                  <TrendChart
                    data={d.collectionHistory}
                    height="h-36 fit:h-full"
                    series={[
                      {
                        key: 'value',
                        label: 'Valeur estimée',
                        color: 'var(--chart-2)',
                        width: 2.5,
                      },
                      {
                        key: 'invested',
                        label: 'Total investi',
                        color: 'var(--muted-foreground)',
                        dashed: true,
                        step: true,
                      },
                    ]}
                  />
                </div>
              )}
            </div>

            {d.breakdown.length > 0 && (
              <div className="flex shrink-0 flex-col gap-3 sm:w-56 sm:border-l sm:border-border/60 sm:pl-5 fit:overflow-y-auto">
                <p className="text-sm font-semibold text-muted-foreground">Répartition</p>
                <ul className="flex flex-col gap-3">
                  {d.breakdown.map((b, i) => (
                    <li key={b.key} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-semibold">{b.label}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {formatPrice(b.value)} · {Math.round(b.share * 100)} %
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(2, b.share * 100)}%`,
                            background: SHARE_COLORS[i % SHARE_COLORS.length],
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alertes actives */}
        <Card className={cn('lg:col-span-3', tile)}>
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
          <CardContent className={tileBody}>
            {d.alerts.items.length === 0 ? (
              <Empty>Aucune alerte en attente.</Empty>
            ) : (
              <ul className="divide-y">
                {d.alerts.items.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 space-y-0.5">
                      <p className={cn('text-xs font-semibold', ALERT_STYLE[a.type].className)}>
                        {ALERT_STYLE[a.type].label} ·{' '}
                        <span className="font-normal text-muted-foreground">
                          {ago(a.createdAt)}
                        </span>
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

        {/* Prochaine sortie (toute la colonne) + les suivantes */}
        <Card className={cn('md:col-span-2 lg:col-span-3', tile)}>
          <CardHeader className="items-center">
            <CardTitle>Prochaine sortie</CardTitle>
            <SeeAll href="/calendrier">Calendrier</SeeAll>
          </CardHeader>
          <CardContent className={cn('flex flex-col gap-1.5', tileBody)}>
            {!next ? (
              <Empty>Aucune sortie à venir connue.</Empty>
            ) : (
              <>
                <p className="font-display text-5xl leading-none font-extrabold text-primary xl:text-6xl">
                  {countdown(next.date, today)}
                </p>
                <Link
                  href={next.href}
                  title={next.title}
                  className="mt-2 line-clamp-2 shrink-0 text-lg leading-snug font-bold hover:underline"
                >
                  {next.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {longDate.format(next.date)}
                  {next.msrp !== null ? ` · ${formatPrice(next.msrp)}` : ''}
                </p>
                {later.length > 0 && (
                  <>
                    <p className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Ensuite
                    </p>
                    <ul className="flex flex-col divide-y">
                      {later.map((e) => (
                        <li key={`${e.kind}-${e.id}`} className="flex items-center gap-3 py-2">
                          <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-secondary py-1 leading-none">
                            <span className="text-[0.65rem] font-semibold text-muted-foreground uppercase">
                              {month.format(e.date)}
                            </span>
                            <span className="font-display text-base font-bold">
                              {String(e.date.getUTCDate()).padStart(2, '0')}
                            </span>
                          </span>
                          <Link
                            href={e.href}
                            title={e.title}
                            className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-semibold hover:underline"
                          >
                            {e.title}
                          </Link>
                          <span className="shrink-0 text-xs font-bold text-primary tabular-nums">
                            {countdown(e.date, today)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Derniers retours en stock */}
        <Card className={cn('md:col-span-2 lg:col-span-6', tile)}>
          <CardHeader className="items-center">
            <CardTitle>Derniers retours en stock</CardTitle>
            <SeeAll href="/retours-en-stock">Tout voir</SeeAll>
          </CardHeader>
          <CardContent className={tileBody}>
            {d.restocks.length === 0 ? (
              <Empty>Aucun retour en stock détecté pour l’instant.</Empty>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
                {d.restocks.map((r) =>
                  !r.product ? null : (
                    <li
                      key={r.id}
                      className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-secondary/40 p-3"
                    >
                      <Thumb
                        src={r.product.imageUrl ?? r.product.images[0] ?? r.listing?.lastImageUrl}
                        className="h-20 w-full rounded-xl"
                      />
                      <Link
                        href={`/produits/${r.product.id}`}
                        title={r.product.name}
                        className="line-clamp-2 text-sm leading-snug font-semibold hover:underline"
                      >
                        {r.product.name}
                      </Link>
                      <div className="mt-auto flex items-baseline justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-muted-foreground">
                          {r.listing?.retailer.name ?? '—'} · {ago(r.createdAt)}
                        </span>
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
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Top variations 30 j */}
        <Card className={cn('lg:col-span-3', tile)}>
          <CardHeader>
            <CardTitle>Top variations · 30 j</CardTitle>
          </CardHeader>
          <CardContent className={tileBody}>
            {d.moves.length === 0 ? (
              <Empty>Pas encore assez d’historique.</Empty>
            ) : (
              <ul className="divide-y">
                {d.moves.map((m) => {
                  const up = m.change > 0;
                  return (
                    <li
                      key={`${m.kind}-${m.productId}`}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/produits/${m.productId}`}
                          className="block truncate text-sm font-semibold hover:underline"
                        >
                          {m.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.kind === 'marché' ? 'Marché' : 'Boutique'} · {formatPrice(m.before)} →{' '}
                          {formatPrice(m.after)}
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

        {/* Bons plans */}
        <Card className={cn('lg:col-span-3', tile)}>
          <CardHeader className="items-center">
            <CardTitle>Bons plans</CardTitle>
            <SeeAll href="/produits/bons-plans">Tout voir</SeeAll>
          </CardHeader>
          <CardContent className={tileBody}>
            {d.deals.length === 0 ? (
              <Empty>Aucune offre sous la cote ou le prix public en ce moment.</Empty>
            ) : (
              <ul className="divide-y">
                {d.deals.map((deal) => (
                  <li key={deal.p.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <Link
                        href={`/produits/${deal.p.id}`}
                        className="block truncate text-sm font-semibold hover:underline"
                      >
                        {deal.p.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {deal.p.bestRetailer ?? '—'} ·{' '}
                        <a
                          href={deal.p.bestUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-foreground hover:underline"
                        >
                          {formatPrice(deal.offer)}
                        </a>
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-success/15 px-2 py-0.5 text-xs font-bold text-success tabular-nums">
                      −{Math.round(deal.discount * 100)} %
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
