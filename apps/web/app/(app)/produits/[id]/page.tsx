import { ArrowLeft, BellPlus, BellRing, ExternalLink, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildSearchUrl,
  LINK_ONLY_SEARCHES,
  RETAILER_ACCESS_LABELS,
  searchTermsFor,
} from '@tcgwatch/adapters';
import { prisma } from '@tcgwatch/db';
import {
  boosterCount,
  formatDate,
  formatDateTime,
  formatPercent,
  formatPrice,
  isBuyable,
  PRODUCT_TYPE_LABELS,
  type ProductTypeKey,
} from '@tcgwatch/shared';
import { AvailabilityBadge } from '@/components/availability-badge';
import { FitPage } from '@/components/fit-page';
import { FormError } from '@/components/form-message';
import { PriceChart } from '@/components/price-chart';
import { TrendChart } from '@/components/trend-chart';
import { ProductGallery } from '@/components/product-gallery';
import { TabPanels } from '@/components/tab-panels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getPriceHistory, PERIODS, periodOf } from '@/lib/data/history';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { ALERT_STYLE, PRODUCT_ALERT_TYPES } from '@/lib/alerts';
import { setProductAlertMuteAction } from '../../alertes/actions';
import { cn } from '@/lib/utils';
import { getProduct } from '@/lib/data/products';
import { getChaseIndicator, getFormatComparison, getProductExtension } from '@/lib/data/release';
import { setProductTargetAction } from '../actions';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string; periode?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await prisma.product.findUnique({ where: { id }, select: { name: true } });
  return { title: p?.name ?? 'Produit' };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ id }, { erreur, periode }] = await Promise.all([params, searchParams]);
  const product = await getProduct(id);
  const muted = new Set(
    (await prisma.product.findUnique({ where: { id }, select: { mutedAlerts: true } }))
      ?.mutedAlerts ?? [],
  );
  if (!product) notFound();
  const period = periodOf(periode);

  const extension = await getProductExtension(product.id);
  const showChase = product.type === 'DISPLAY' || product.type === 'ETB';
  const [history, alerts, retailers, formats, chase] = await Promise.all([
    getPriceHistory(id, period.days),
    prisma.alertEvent.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.retailer.findMany({
      where: { enabled: true, searchUrl: { not: null } },
      select: { id: true, name: true, searchUrl: true, access: true },
      orderBy: { name: 'asc' },
    }),
    extension ? getFormatComparison(extension) : Promise.resolve([]),
    extension && showChase ? getChaseIndicator(extension.id, period.days) : Promise.resolve(null),
  ]);

  // Recherche du produit sur les sites de l'annuaire où il n'est pas encore suivi.
  const followed = new Set(product.listings.map((l) => l.retailerId));
  const terms = searchTermsFor(product.name);
  const searches = retailers
    .filter((r) => !followed.has(r.id))
    .map((r) => ({ ...r, href: buildSearchUrl(r.searchUrl, terms) }))
    .filter((r): r is typeof r & { href: string } => !!r.href);
  // Grandes enseignes : liens de recherche seulement, jamais relevées.
  const bigStoreTerms = /pok[ée]mon/i.test(terms) ? terms : `Pokémon ${terms}`;
  const bigStores = LINK_ONLY_SEARCHES.map((s) => ({
    name: s.name,
    href: buildSearchUrl(s.searchUrl, bigStoreTerms)!,
  }));
  // Prix par booster : compare les formats entre eux et au prix conseillé.
  const boosters = boosterCount(product.name, product.type);
  const perBooster = (price: number | null | undefined) =>
    boosters && price ? price / boosters : null;
  const bestPerBooster = perBooster(product.best?.price);
  const msrpPerBooster = perBooster(product.msrp);
  const bestPrice = product.best ? (product.best.delivered ?? product.best.price) : null;
  const categories = [
    ...new Set(product.listings.map((l) => l.category).filter((c): c is string => !!c)),
  ];

  const typeLabel = PRODUCT_TYPE_LABELS[product.type as ProductTypeKey] ?? product.type;
  const sortedListings = [...product.listings].sort(
    (a, b) =>
      Number(isBuyable(b.availability)) - Number(isBuyable(a.availability)) ||
      (a.delivered ?? a.price ?? Infinity) - (b.delivered ?? b.price ?? Infinity),
  );
  const fmtInput = (v: number | null) => (v !== null ? String(v).replace('.', ',') : '');
  const releaseDate = product.releaseDate ?? product.release?.releaseDate;

  return (
    <FitPage>
      <FormError message={erreur} />

      <div
        className={cn(
          fitGrid,
          'lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_22rem]',
        )}
      >
        {/* Identité du produit */}
        <Card className={cn(fitCard, 'holo-frame px-5')}>
          <div className={cn('space-y-4', fitScroll)}>
            <Link
              href="/produits"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <ArrowLeft className="size-4" /> Produits suivis
            </Link>
            <div className="rounded-xl bg-white/[0.03] p-2">
              {product.images.length > 0 ? (
                <ProductGallery images={product.images} alt={product.name} />
              ) : (
                <p className="flex h-64 items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Pas encore d’image : elle sera reprise de la première fiche revendeur relevée.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {typeLabel}
                {extension && (
                  <>
                    {' · '}
                    <Link
                      href={`/extensions/${encodeURIComponent(extension.code)}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {extension.name}
                      {extension.setCode ? ` (${extension.setCode})` : ''}
                    </Link>
                  </>
                )}
                {releaseDate && ` · sortie le ${formatDate(releaseDate)}`}
              </p>
              <h1 className="font-display text-2xl leading-tight font-bold tracking-tight text-balance">
                {product.name}
              </h1>
              <div className="pt-2">
                {product.targetPrice === null ? (
                  <Button asChild size="sm">
                    <Link href={`/produits/mes-produits?ajouter=${product.id}#ajouter`}>
                      <BellPlus /> Ajouter aux suivis
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/produits/mes-produits#p-${product.id}`}>
                      <BellRing /> Dans mes suivis · bon prix {formatPrice(product.targetPrice)}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Meta label="Marque" value={product.brand} />
              <Meta label="EAN" value={product.ean} mono />
              <Meta
                label="Prix public"
                value={product.msrp !== null ? formatPrice(product.msrp) : null}
              />
              <div className="min-w-0">
                <dt className="text-muted-foreground">Prix cible</dt>
                <dd>
                  <form action={setProductTargetAction.bind(null, product.id)} className="mt-1">
                    <Input
                      name="targetPrice"
                      inputMode="decimal"
                      defaultValue={fmtInput(product.targetPrice)}
                      placeholder="ex. 70"
                      title="Prix cible en euros : Entrée pour enregistrer, vide pour aucun"
                      aria-label="Prix cible en euros"
                      className="h-9 w-28"
                    />
                  </form>
                </dd>
              </div>
              <Meta
                label="Prix par booster"
                value={
                  bestPerBooster !== null
                    ? `${formatPrice(bestPerBooster)}${
                        msrpPerBooster !== null
                          ? ` (${formatPercent(bestPerBooster / msrpPerBooster - 1)})`
                          : ''
                      }`
                    : null
                }
              />
              <Meta
                label="Plus bas historique"
                value={history.allTimeLow !== null ? formatPrice(history.allTimeLow) : null}
              />
              {categories.length > 0 && (
                <div className="col-span-2 min-w-0">
                  <dt className="text-muted-foreground">Rayons</dt>
                  <dd className="font-medium">{categories.join(' · ')}</dd>
                </div>
              )}
            </dl>
          </div>
        </Card>

        {/* Prix : chiffres clés, courbe, revendeurs */}
        <div className={fitColumn}>
          <div className="grid shrink-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <HeroStat
              label="Meilleur prix"
              value={formatPrice(bestPrice)}
              hint={
                product.best
                  ? `${product.best.retailerName} · ${
                      product.best.availability === 'PREORDER' ? 'précommande' : 'en stock'
                    }${
                      product.best.delivered !== null
                        ? product.best.shipping === 0
                          ? ' · port offert'
                          : ' · livré'
                        : ''
                    }`
                  : 'pas achetable actuellement'
              }
              hintClass={product.best ? 'text-success' : undefined}
            />
            <HeroStat
              label="Prix marché"
              value={formatPrice(history.lastMarket)}
              valueClass="text-primary"
              hint={
                [
                  history.lastMarketSource
                    ? (MARKET_SOURCE[history.lastMarketSource] ?? history.lastMarketSource)
                    : null,
                  history.lastMarketListings !== null
                    ? `${history.lastMarketListings} annonce${history.lastMarketListings > 1 ? 's' : ''}`
                    : null,
                  history.lastMarketMedian !== null
                    ? `médiane ${formatPrice(history.lastMarketMedian)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'aucun relevé'
              }
            />
            <HeroStat
              label="Occasion (eBay)"
              value={history.secondhand ? formatPrice(history.secondhand.median) : '—'}
              valueClass="text-chart-5"
              hint={
                history.secondhand
                  ? `médiane de ${history.secondhand.count} annonces · dès ${formatPrice(history.secondhand.low)}`
                  : 'pas encore de relevé'
              }
            />
            {history.ratio !== null ? (
              <HeroStat
                label="Marché / achat"
                value={history.ratio.toLocaleString('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                valueClass={history.ratio >= 1 ? 'text-success' : 'text-destructive'}
                hint={`${formatPrice(history.lastMarket)} marché · ${formatPrice(
                  history.avgPurchase,
                )} payé · ${history.owned} ex.`}
              />
            ) : history.lastMarket !== null && bestPrice !== null ? (
              <HeroStat
                label="Marché / meilleur prix"
                value={formatPercent(history.lastMarket / bestPrice - 1)}
                valueClass={history.lastMarket >= bestPrice ? 'text-success' : undefined}
                hint={`${formatPrice(history.lastMarket)} marché · ${formatPrice(bestPrice)} en boutique`}
              />
            ) : (
              <HeroStat
                label="Marché / achat"
                value="—"
                hint={
                  history.owned > 0
                    ? 'pas encore de prix marché'
                    : 'pas de prix marché ou pas en vente'
                }
              />
            )}
          </div>

          <Card className={cn(fitCard, 'fit:flex-1')}>
            <CardHeader className="flex-col">
              <div className="flex w-full flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Prix boutiques vs marché</CardTitle>
                  <CardDescription>
                    {period.days ? `${period.days} derniers jours` : 'Tout l’historique'} · périodes
                    de rupture grisées
                    {history.setAside > 0 &&
                      ` · ${history.setAside} point${history.setAside > 1 ? 's' : ''} écarté${
                        history.setAside > 1 ? 's' : ''
                      } (prix aberrant ou exclu)`}
                  </CardDescription>
                </div>
                <nav aria-label="Période" className="flex gap-1">
                  {PERIODS.map((p) => (
                    <Link
                      key={p.key}
                      href={`/produits/${product.id}?periode=${p.key}`}
                      scroll={false}
                      aria-current={p.key === period.key ? 'true' : undefined}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent',
                        p.key === period.key &&
                          'border-foreground bg-foreground text-background hover:bg-foreground',
                      )}
                    >
                      {p.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </CardHeader>
            <CardContent className="fit:flex fit:min-h-0 fit:flex-1 fit:flex-col">
              <PriceChart
                data={history.data}
                retailers={history.retailers}
                hasBest={history.hasBest}
                hasMarket={history.hasMarket}
                hasSecondhand={history.hasSecondhand}
                outOfStock={history.outOfStock}
                allTimeLow={history.allTimeLow}
                low30={history.low30}
                msrp={product.msrp}
                avgPurchase={history.avgPurchase}
                points={history.points}
              />
            </CardContent>
          </Card>

          <Card className={cn(fitCard, 'fit:max-h-[42%] fit:shrink-0')}>
            <TabPanels
              bodyClassName={fitScroll}
              tabs={[
                {
                  id: 'revendeurs',
                  label: `Revendeurs · ${sortedListings.length}`,
                  content: (
                    <>
                      {sortedListings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Aucune fiche suivie pour ce produit.
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                            <tr className="border-b">
                              <th className="py-2 text-left font-semibold">Site</th>
                              <th className="py-2 text-left font-semibold">Statut</th>
                              <th className="hidden py-2 text-left font-semibold sm:table-cell">
                                Dernier relevé
                              </th>
                              <th className="py-2 text-right font-semibold">Prix</th>
                              <th className="py-2">
                                <span className="sr-only">Action</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {sortedListings.map((l) => (
                              <tr key={l.id}>
                                <td className="py-3 pr-2 font-semibold">{l.retailerName}</td>
                                <td className="py-3 pr-2">
                                  <AvailabilityBadge availability={l.availability} />
                                </td>
                                <td className="hidden py-3 pr-2 text-muted-foreground sm:table-cell">
                                  {l.lastCheckedAt ? ago(l.lastCheckedAt) : 'jamais'}
                                </td>
                                <td className="py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                                  {formatPrice(l.price)}
                                  {l.delivered !== null && l.delivered !== l.price && (
                                    <span className="block text-xs font-normal text-muted-foreground">
                                      livré {formatPrice(l.delivered)}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 pl-3 text-right">
                                  <Button
                                    asChild
                                    size="sm"
                                    variant={
                                      l.id === product.best?.listingId ? 'default' : 'secondary'
                                    }
                                  >
                                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                                      Acheter
                                    </a>
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  ),
                },
                ...(formats.length > 1
                  ? [
                      {
                        id: 'formats',
                        label: 'Formats',
                        content: (
                          <>
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <h3 className="font-display text-sm font-semibold">
                                  Comparateur {extension?.name}
                                </h3>
                                <CardDescription>
                                  Prix par booster de chaque format achetable aujourd’hui (prix
                                  livré quand le port de la boutique est connu).
                                </CardDescription>
                              </div>
                              <div>
                                <ul className="divide-y text-sm">
                                  {formats.map((f, i) => (
                                    <li
                                      key={f.productId}
                                      className={cn(
                                        'flex flex-wrap items-center gap-x-3 gap-y-1 py-2',
                                        f.productId === product.id && 'font-medium',
                                      )}
                                    >
                                      <Link
                                        href={`/produits/${f.productId}`}
                                        className="min-w-0 flex-1 basis-56 truncate hover:underline"
                                      >
                                        {f.name}
                                      </Link>
                                      {i === 0 && (
                                        <Badge variant="success">Le plus avantageux</Badge>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {f.boosters} booster{f.boosters > 1 ? 's' : ''} ·{' '}
                                        {formatPrice(f.price)}
                                        {f.delivered ? ' livré' : ''} · {f.retailerName}
                                      </span>
                                      <span className="w-24 text-right font-semibold tabular-nums">
                                        {formatPrice(f.perBooster)}
                                        <span className="text-xs font-normal text-muted-foreground">
                                          {' '}
                                          /b.
                                        </span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            )
                          </>
                        ),
                      },
                    ]
                  : []),
                ...(chase
                  ? [
                      {
                        id: 'phares',
                        label: 'Cartes phares',
                        content: (
                          <>
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <h3 className="font-display text-sm font-semibold">
                                  Indicateur cartes phares
                                </h3>
                                <CardDescription>
                                  Somme des tendances Cardmarket des {chase.cards} cartes phares
                                  suivies de l’extension. Un repère de l’intérêt à ouvrir plutôt que
                                  garder scellé, pas une valeur attendue (faute de taux de tirage
                                  fiables).
                                </CardDescription>
                              </div>
                              <div className="space-y-3">
                                {chase.current && (
                                  <p className="text-sm">
                                    <span className="text-2xl font-semibold tabular-nums">
                                      {formatPrice(chase.current.sum)}
                                    </span>{' '}
                                    <span className="text-muted-foreground">
                                      ({chase.current.count} cartes cotées
                                      {product.best
                                        ? `, produit à ${formatPrice(product.best.price)}`
                                        : ''}
                                      )
                                    </span>
                                  </p>
                                )}
                                <TrendChart
                                  data={chase.series}
                                  series={[
                                    {
                                      key: 'sum',
                                      label: 'Cartes phares',
                                      color: 'var(--chart-1)',
                                      width: 2.5,
                                    },
                                  ]}
                                />
                                {chase.top.length > 0 && (
                                  <ul className="grid gap-1 text-sm sm:grid-cols-2">
                                    {chase.top.map((c) => (
                                      <li key={c.tcgdexId} className="flex justify-between gap-2">
                                        <Link
                                          href={`/cartes/${encodeURIComponent(c.tcgdexId)}`}
                                          className="truncate hover:underline"
                                        >
                                          {c.name}
                                        </Link>
                                        <span className="text-muted-foreground tabular-nums">
                                          {formatPrice(c.trend)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                            )
                          </>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        </div>

        {/* Historiques et recherches, en onglets */}
        <Card className={cn(fitCard, 'lg:col-span-2 xl:col-span-1')}>
          <TabPanels
            bodyClassName={cn('space-y-4', fitScroll)}
            tabs={[
              {
                id: 'alertes',
                label: 'Alertes',
                content: (
                  <>
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        Alertes envoyées pour ce produit (cliquer pour couper ou réactiver) :
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {PRODUCT_ALERT_TYPES.map((t) => {
                          const off = muted.has(t);
                          return (
                            <form
                              key={t}
                              action={setProductAlertMuteAction.bind(null, id, t, !off)}
                            >
                              <button
                                type="submit"
                                aria-pressed={!off}
                                className={cn(
                                  'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors hover:bg-accent',
                                  off
                                    ? 'text-muted-foreground line-through'
                                    : 'border-primary/40 bg-primary/10',
                                )}
                              >
                                {ALERT_STYLE[t].label}
                              </button>
                            </form>
                          );
                        })}
                      </div>
                    </div>
                    {alerts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucune alerte émise.</p>
                    ) : (
                      <ul className="divide-y">
                        {alerts.map((a) => (
                          <li key={a.id} className="space-y-0.5 py-2.5 first:pt-0">
                            <p
                              className={cn(
                                'text-xs font-semibold',
                                ALERT_STYLE[a.type]?.className,
                              )}
                            >
                              {ALERT_STYLE[a.type]?.label ?? a.type}
                            </p>
                            <p className="text-sm">{a.message || a.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(a.createdAt)}
                              {a.sentNtfy ? ' · ntfy ✓' : ''}
                              {a.sentTelegram ? ' · Telegram ✓' : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ),
              },
              {
                id: 'ruptures',
                label: 'Ruptures',
                content:
                  history.stock.length > 0 ? (
                    <>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <h3 className="font-display text-sm font-semibold">
                            Historique des ruptures
                          </h3>
                          <CardDescription>
                            Jours où le produit était achetable, sur les jours relevés de chaque
                            boutique.
                          </CardDescription>
                        </div>
                        <div>
                          <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground">
                              <tr>
                                <th className="py-1 text-left font-normal">Boutique</th>
                                <th className="py-1 text-right font-normal">30 j</th>
                                <th className="py-1 text-right font-normal">90 j</th>
                                <th className="hidden py-1 text-right font-normal sm:table-cell">
                                  Dernier jour en stock
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {history.stock.map((s) => (
                                <tr key={s.listingId}>
                                  <td className="py-1.5">{s.retailer}</td>
                                  <td className="py-1.5 text-right tabular-nums">
                                    {s.checked30 ? `${s.in30} / ${s.checked30} j` : '—'}
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums">
                                    {s.in90} / {s.checked90} j
                                  </td>
                                  <td className="hidden py-1.5 text-right text-muted-foreground sm:table-cell">
                                    {s.lastBuyable
                                      ? formatDate(new Date(`${s.lastBuyable}T00:00:00Z`))
                                      : 'jamais'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      )
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Pas encore d’historique.</p>
                  ),
              },
              {
                id: 'ailleurs',
                label: 'Ailleurs',
                content: (
                  <>
                    <div id="autres-revendeurs" className="scroll-mt-24 space-y-3">
                      <div className="space-y-1">
                        <h3 className="font-display text-sm font-semibold">
                          Chercher chez d’autres revendeurs
                        </h3>
                        <CardDescription>
                          Recherche « {terms} » sur les sites qui ne vendent pas encore ce produit
                          dans le suivi. Les nouvelles fiches sont trouvées automatiquement chaque
                          jour.
                        </CardDescription>
                      </div>
                      <div className="space-y-4">
                        {searches.length > 0 && (
                          <ul className="grid gap-1.5 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            {searches.map((r) => (
                              <li key={r.id}>
                                <SearchLink
                                  href={r.href}
                                  name={r.name}
                                  title={RETAILER_ACCESS_LABELS[r.access]}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            Grandes enseignes — liens seulement, prix et stock non suivis
                          </p>
                          <ul className="grid gap-1.5 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            {bigStores.map((r) => (
                              <li key={r.name}>
                                <SearchLink
                                  href={r.href}
                                  name={r.name}
                                  title={`Rechercher « ${bigStoreTerms} » sur ${r.name}`}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                ),
              },
              {
                id: 'cote',
                label: 'Cote',
                content: (
                  <>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <h3 className="font-display text-sm font-semibold">Cardmarket</h3>
                        <CardDescription>
                          {history.cardmarket
                            ? `Guide des prix officiel du ${formatDate(history.cardmarket.date)}, toutes langues confondues.`
                            : 'Guide des prix officiel : disponible quand le produit est relié à Cardmarket (via CardNexus).'}
                        </CardDescription>
                      </div>
                      {history.cardmarket && (
                        <div>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            {[
                              { label: 'À partir de', value: history.cardmarket.low },
                              { label: 'Tendance des prix', value: history.cardmarket.trend },
                              { label: 'Prix moyen 30 jours', value: history.cardmarket.avg30 },
                              { label: 'Prix moyen 7 jours', value: history.cardmarket.avg7 },
                              { label: 'Prix moyen 1 jour', value: history.cardmarket.avg1 },
                            ]
                              .filter((r) => r.value !== null)
                              .map((r) => (
                                <div key={r.label}>
                                  <dt className="text-muted-foreground">{r.label}</dt>
                                  <dd className="font-semibold tabular-nums">
                                    {formatPrice(r.value)}
                                  </dd>
                                </div>
                              ))}
                          </dl>
                        </div>
                      )}
                    </div>
                    {(product.description || product.externalId?.startsWith('pokecardex:')) && (
                      <Card>
                        <CardContent className="space-y-3">
                          {product.description && (
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {product.description}
                            </p>
                          )}
                          {product.externalId?.startsWith('pokecardex:') && (
                            <a
                              href="https://www.pokecardex.com/calendrier"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              Catalogue : calendrier Pokécardex <ExternalLink className="size-3" />
                            </a>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </FitPage>
  );
}

function SearchLink({ href, name, title }: { href: string; name: string; title: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
      title={title}
    >
      <Search className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{name}</span>
      <ExternalLink className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}

const MARKET_SOURCE: Record<string, string> = {
  cardnexus: 'CardNexus (annonces FR)',
  cardmarket: 'Cardmarket · tendance',
  poketrace: 'PokeTrace',
  manual: 'Saisie manuelle',
};

/** « il y a 12 min », « il y a 3 h », puis la date. */
function ago(date: Date): string {
  const min = Math.round((Date.now() - date.getTime()) / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return formatDateTime(date);
}

function HeroStat({
  label,
  value,
  hint,
  valueClass,
  hintClass,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
  hintClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-display text-xl font-bold tabular-nums 2xl:text-2xl', valueClass)}>
        {value}
      </p>
      {hint && (
        <p className={cn('truncate text-xs text-muted-foreground', hintClass)} title={hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('truncate font-medium', mono && 'font-mono text-xs leading-5')}>
        {value ?? '—'}
      </dd>
    </div>
  );
}
