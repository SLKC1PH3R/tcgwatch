import { ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildSearchUrl, RETAILER_ACCESS_LABELS, searchTermsFor } from '@tcgwatch/adapters';
import { prisma } from '@tcgwatch/db';
import {
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
import { ProductGallery } from '@/components/product-gallery';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPriceHistory, getProduct, getReleaseOptions } from '@/lib/data/products';
import { toDateInput } from '@/lib/form';
import { MarketPriceForm } from '../../marche/market-price-form';
import { deleteProductAction, updateProductAction } from '../actions';
import { ProductForm } from '../product-form';
import { ListingRow } from './listing-row';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ erreur?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await prisma.product.findUnique({ where: { id }, select: { name: true } });
  return { title: p?.name ?? 'Produit' };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ id }, { erreur }] = await Promise.all([params, searchParams]);
  const product = await getProduct(id);
  if (!product) notFound();

  const [history, releases, alerts, marketPrices, retailers] = await Promise.all([
    getPriceHistory(id),
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
  ]);

  // Recherche du produit sur les sites de l'annuaire où il n'est pas encore suivi.
  const followed = new Set(product.listings.map((l) => l.retailerId));
  const terms = searchTermsFor(product.name);
  const searches = retailers
    .filter((r) => !followed.has(r.id))
    .map((r) => ({ ...r, href: buildSearchUrl(r.searchUrl, terms) }))
    .filter((r): r is typeof r & { href: string } => !!r.href);
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
            {product.release && product.release.nameFr !== product.name && (
              <span>{product.release.nameFr}</span>
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
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>Prix boutiques vs marché</CardTitle>
                <CardDescription>90 derniers jours</CardDescription>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Meilleur prix</p>
                  <p className="font-semibold tabular-nums">{formatPrice(product.best?.price)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Prix marché</p>
                  <p className="font-semibold tabular-nums">{formatPrice(history.lastMarket)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Marché / achat</p>
                  <p className="font-semibold tabular-nums">
                    {history.ratio !== null
                      ? `×${history.ratio.toFixed(2).replace('.', ',')}`
                      : '—'}
                    {history.ratio !== null && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({formatPercent(history.ratio - 1)})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <PriceChart
                data={history.data}
                series={history.series}
                avgPurchase={history.avgPurchase}
              />
            </CardContent>
          </Card>

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

          {searches.length > 0 && (
            <Card>
              <CardHeader className="flex-col">
                <CardTitle>Chercher chez d’autres revendeurs</CardTitle>
                <CardDescription>
                  Recherche « {terms} » sur les sites de l’annuaire. Copiez l’URL de la fiche
                  trouvée dans « Ajouter une fiche revendeur ».
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1.5 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {searches.map((r) => (
                    <li key={r.id}>
                      <a
                        href={r.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                        title={RETAILER_ACCESS_LABELS[r.access]}
                      >
                        <Search className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{r.name}</span>
                        <ExternalLink className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

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
