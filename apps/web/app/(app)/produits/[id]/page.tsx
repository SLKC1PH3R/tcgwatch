import { ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
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
  PRODUCT_TYPE_LABELS,
  toNumber,
  type ProductTypeKey,
} from '@tcgwatch/shared';
import { FormError } from '@/components/form-message';
import { PageHeader } from '@/components/page-header';
import { PriceChart } from '@/components/price-chart';
import { TrendChart } from '@/components/trend-chart';
import { ProductGallery } from '@/components/product-gallery';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPriceHistory, PERIODS, periodOf } from '@/lib/data/history';
import { cn } from '@/lib/utils';
import { getProduct, getReleaseOptions } from '@/lib/data/products';
import { getChaseIndicator, getFormatComparison, getProductExtension } from '@/lib/data/release';
import { toDateInput } from '@/lib/form';
import { MarketPriceForm } from '../../marche/market-price-form';
import { deleteProductAction, updateProductAction } from '../actions';
import { ProductForm } from '../product-form';
import { ListingRow } from './listing-row';

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
  if (!product) notFound();
  const period = periodOf(periode);

  const extension = await getProductExtension(product.id);
  const showChase = product.type === 'DISPLAY' || product.type === 'ETB';
  const [history, releases, alerts, marketPrices, retailers, formats, chase] = await Promise.all([
    getPriceHistory(id, period.days),
    getReleaseOptions(),
    prisma.alertEvent.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.marketPrice.findMany({ where: { productId: id }, orderBy: { date: 'desc' }, take: 5 }),
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
  const categories = [
    ...new Set(product.listings.map((l) => l.category).filter((c): c is string => !!c)),
  ];

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {PRODUCT_TYPE_LABELS[product.type as ProductTypeKey] ?? product.type}
            </Badge>
            {extension ? (
              <Link
                href={`/extensions/${encodeURIComponent(extension.code)}`}
                className="font-medium text-primary hover:underline"
              >
                Extension {extension.name}
                {extension.setCode ? ` (${extension.setCode})` : ''}
              </Link>
            ) : (
              product.release &&
              product.release.nameFr !== product.name && <span>{product.release.nameFr}</span>
            )}
            {(product.releaseDate ?? product.release?.releaseDate) && (
              <span>
                · sortie le {formatDate(product.releaseDate ?? product.release?.releaseDate)}
              </span>
            )}
          </span>
        }
        actions={
          <Button asChild>
            <Link href={`/produits/ajouter?produit=${product.id}`}>
              <Plus /> Ajouter une fiche revendeur
            </Link>
          </Button>
        }
      />
      <FormError message={erreur} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
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
              <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                <Stat
                  label="Meilleur prix"
                  value={formatPrice(product.best?.price)}
                  hint={
                    product.best
                      ? product.best.delivered !== null
                        ? `livré ${formatPrice(product.best.delivered)}${
                            product.best.shipping === 0 ? ' (port offert)' : ''
                          } · ${product.best.retailerName}`
                        : `${product.best.retailerName} · port inconnu`
                      : undefined
                  }
                />
                <Stat
                  label="Plus bas historique"
                  value={formatPrice(history.allTimeLow)}
                  hint={history.low30 !== null ? `30 j : ${formatPrice(history.low30)}` : undefined}
                />
                <Stat
                  label="Prix par booster"
                  value={bestPerBooster !== null ? formatPrice(bestPerBooster) : '—'}
                  hint={
                    msrpPerBooster !== null
                      ? `conseillé ${formatPrice(msrpPerBooster)}${
                          bestPerBooster !== null
                            ? ` (${formatPercent(bestPerBooster / msrpPerBooster - 1)})`
                            : ''
                        }`
                      : boosters
                        ? `${boosters} booster${boosters > 1 ? 's' : ''}`
                        : 'contenu variable'
                  }
                />
                <Stat
                  label="Prix marché"
                  value={formatPrice(history.lastMarket)}
                  hint={
                    [
                      history.lastMarketListings !== null
                        ? `${history.lastMarketListings} annonce${history.lastMarketListings > 1 ? 's' : ''}`
                        : null,
                      history.lastMarketMedian !== null
                        ? `médiane ${formatPrice(history.lastMarketMedian)}`
                        : null,
                      history.ratio !== null
                        ? `${formatPercent(history.ratio - 1)} vs achat`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                />
              </dl>
            </CardHeader>
            <CardContent>
              <PriceChart
                data={history.data}
                retailers={history.retailers}
                hasBest={history.hasBest}
                hasMarket={history.hasMarket}
                outOfStock={history.outOfStock}
                allTimeLow={history.allTimeLow}
                low30={history.low30}
                msrp={product.msrp}
                avgPurchase={history.avgPurchase}
                points={history.points}
              />
            </CardContent>
          </Card>

          {formats.length > 1 && (
            <Card>
              <CardHeader className="flex-col">
                <CardTitle>Comparateur {extension?.name}</CardTitle>
                <CardDescription>
                  Prix par booster de chaque format achetable aujourd’hui (prix livré quand le port
                  de la boutique est connu).
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                      {i === 0 && <Badge variant="success">Le plus avantageux</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {f.boosters} booster{f.boosters > 1 ? 's' : ''} · {formatPrice(f.price)}
                        {f.delivered ? ' livré' : ''} · {f.retailerName}
                      </span>
                      <span className="w-24 text-right font-semibold tabular-nums">
                        {formatPrice(f.perBooster)}
                        <span className="text-xs font-normal text-muted-foreground"> /b.</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {chase && (
            <Card>
              <CardHeader className="flex-col">
                <CardTitle>Indicateur cartes phares</CardTitle>
                <CardDescription>
                  Somme des tendances Cardmarket des {chase.cards} cartes phares suivies de
                  l’extension. Un repère de l’intérêt à ouvrir plutôt que garder scellé, pas une
                  valeur attendue (faute de taux de tirage fiables).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {chase.current && (
                  <p className="text-sm">
                    <span className="text-2xl font-semibold tabular-nums">
                      {formatPrice(chase.current.sum)}
                    </span>{' '}
                    <span className="text-muted-foreground">
                      ({chase.current.count} cartes cotées
                      {product.best ? `, produit à ${formatPrice(product.best.price)}` : ''})
                    </span>
                  </p>
                )}
                <TrendChart
                  data={chase.series}
                  series={[
                    { key: 'sum', label: 'Cartes phares', color: 'var(--chart-1)', width: 2.5 },
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
              </CardContent>
            </Card>
          )}

          {history.stock.length > 0 && (
            <Card>
              <CardHeader className="flex-col">
                <CardTitle>Historique des ruptures</CardTitle>
                <CardDescription>
                  Jours où le produit était achetable, sur les jours relevés de chaque boutique.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Fiches revendeurs ({product.listings.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {product.listings.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucune fiche suivie pour ce produit.
                </p>
              )}
              {product.listings.map((l) => (
                <ListingRow key={l.id} listing={l} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique des alertes</CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune alerte émise.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {alerts.map((a) => (
                    <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>{a.title}</span>
                      <span className="text-muted-foreground">
                        {formatDateTime(a.createdAt)} · ntfy {a.sentNtfy ? '✓' : '—'}
                        {a.sentTelegram ? ' · Telegram ✓' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="space-y-4">
              {product.images.length > 0 ? (
                <ProductGallery images={product.images} alt={product.name} />
              ) : (
                <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                  Pas encore d’image : elle sera reprise de la première fiche revendeur relevée.
                </p>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {product.brand && (
                  <>
                    <dt className="text-muted-foreground">Marque</dt>
                    <dd>{product.brand}</dd>
                  </>
                )}
                {product.ean && (
                  <>
                    <dt className="text-muted-foreground">EAN</dt>
                    <dd className="font-mono text-xs leading-5">{product.ean}</dd>
                  </>
                )}
                {product.msrp !== null && (
                  <>
                    <dt className="text-muted-foreground">Prix public</dt>
                    <dd className="tabular-nums">{formatPrice(product.msrp)}</dd>
                  </>
                )}
                {product.targetPrice !== null && (
                  <>
                    <dt className="text-muted-foreground">Prix cible</dt>
                    <dd className="tabular-nums">{formatPrice(product.targetPrice)}</dd>
                  </>
                )}
                {categories.length > 0 && (
                  <>
                    <dt className="text-muted-foreground">Rayons</dt>
                    <dd>{categories.join(' · ')}</dd>
                  </>
                )}
              </dl>
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
              {product.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-col">
              <CardTitle>Chercher chez d’autres revendeurs</CardTitle>
              <CardDescription>
                Recherche « {terms} ». Copiez l’URL de la fiche trouvée dans « Ajouter une fiche
                revendeur » pour la suivre.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-col">
              <CardTitle>Prix marché (Cardmarket)</CardTitle>
              <CardDescription>
                Saisie manuelle du prix constaté — un relevé par jour.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MarketPriceForm
                productId={product.id}
                today={new Date().toISOString().slice(0, 10)}
              />
              {marketPrices.length > 0 && (
                <ul className="divide-y text-sm">
                  {marketPrices.map((m) => (
                    <li key={m.id} className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">
                        {formatDate(m.date)} · {m.source}
                      </span>
                      <span className="tabular-nums">{formatPrice(toNumber(m.price))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fiche produit</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductForm
                action={updateProductAction.bind(null, product.id)}
                releases={releases.map((r) => ({
                  id: r.id,
                  label: r.setCode ? `${r.nameFr} (${r.setCode})` : r.nameFr,
                }))}
                values={{
                  name: product.name,
                  type: product.type,
                  releaseId: product.release?.id,
                  ean: product.ean,
                  imageUrl: product.imageUrl,
                  brand: product.brand,
                  description: product.description,
                  msrp: product.msrp,
                  targetPrice: product.targetPrice,
                  releaseDate: toDateInput(product.releaseDate),
                  notes: product.notes,
                }}
              />
              <form
                action={deleteProductAction.bind(null, product.id)}
                className="mt-6 border-t pt-4"
              >
                <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                  <Trash2 /> Supprimer le produit et ses suivis
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="truncate text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
