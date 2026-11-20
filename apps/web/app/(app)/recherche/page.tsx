import { ExternalLink, Layers, Package, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatDate,
  formatPercent,
  formatPrice,
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPES,
  type ProductTypeKey,
} from '@tcgwatch/shared';
import { AvailabilityBadge } from '@/components/availability-badge';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { search } from '@/lib/data/search';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Recherche' };

/** Types proposés en filtre rapide (les plus recherchés d'abord). */
const QUICK_TYPES: ProductTypeKey[] = ['BOOSTER', 'DISPLAY', 'ETB', 'TRIPACK', 'COFFRET', 'UPC'];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q = '', type: rawType } = await searchParams;
  const type = (PRODUCT_TYPES as readonly string[]).includes(rawType ?? '')
    ? (rawType as ProductTypeKey)
    : undefined;
  const query = q.trim();
  const results = await search(query, type);
  const href = (t?: ProductTypeKey) =>
    `/recherche?q=${encodeURIComponent(query)}${t ? `&type=${t}` : ''}`;
  const empty =
    results.products.length === 0 && results.releases.length === 0 && results.cards.length === 0;

  const none = (what: string) => (
    <p className="text-sm text-muted-foreground">
      Aucun{what} pour « {query} ».
    </p>
  );

  return (
    <FitPage>
      <PageHeader
        title={query ? `Recherche : « ${query} »` : 'Recherche'}
        description="Produits scellés FR, extensions et cartes Pokémon. Astuce : « / » ou Ctrl+K pour chercher depuis n’importe quelle page."
      />

      {query && (
        <nav aria-label="Type de produit" className="flex shrink-0 flex-wrap gap-1.5">
          {[undefined, ...QUICK_TYPES].map((t) => (
            <Link
              key={t ?? 'tout'}
              href={href(t)}
              aria-current={type === t ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-accent',
                type === t &&
                  'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {t ? PRODUCT_TYPE_LABELS[t] : 'Tout'}
            </Link>
          ))}
        </nav>
      )}

      {!query ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Tapez un nom d’extension (« Flammes Fantasmagoriques »), de produit (« ETB 151 ») ou de
          Pokémon (« Dracaufeu ») dans le champ de recherche.
        </p>
      ) : empty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Aucun résultat pour « {query} »{type && ` en ${PRODUCT_TYPE_LABELS[type]}`}.
        </p>
      ) : (
        <div className={cn(fitGrid, 'lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]')}>
          {results.releases.length > 0 && (
            <Card className={cn(fitCard, 'lg:col-start-2 lg:row-start-1')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="size-4" /> Extensions
                  <span className="text-sm font-normal text-muted-foreground">
                    {results.releases.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent
                className={cn('grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-1', fitScroll)}
              >
                {results.releases.map((r) => (
                  <Link
                    key={r.id}
                    href={
                      r.tcgdexId
                        ? `/extensions/${encodeURIComponent(r.tcgdexId)}`
                        : `/recherche?q=${encodeURIComponent(r.name)}`
                    }
                    className="flex min-w-0 items-center gap-3 rounded-md border p-2 transition-colors hover:bg-accent"
                  >
                    <Thumb src={r.imageUrl} className="w-14 bg-transparent" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[
                          r.setCode,
                          formatDate(r.releaseDate),
                          r.productCount > 0 && `${r.productCount} produits`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {results.products.length > 0 ? (
            <Card className={cn(fitCard, 'lg:col-start-1 lg:row-start-1')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="size-4" /> Produits scellés
                  <span className="text-sm font-normal text-muted-foreground">
                    {results.total > results.products.length
                      ? `${results.products.length} sur ${results.total}`
                      : results.total}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className={cn('divide-y', fitScroll)}>
                {results.products.map(({ product: p, resale }) => {
                  const gain = resale && p.msrp ? resale.price / p.msrp - 1 : null;
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                      <Thumb src={p.displayImage} className="size-14" />
                      <div className="min-w-0 flex-1 basis-48">
                        <Link
                          href={`/produits/${p.id}`}
                          className="line-clamp-2 text-sm font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge variant="secondary">
                            {PRODUCT_TYPE_LABELS[p.type as ProductTypeKey] ?? p.type}
                          </Badge>
                          {p.releaseDate && <span>Sortie {formatDate(p.releaseDate)}</span>}
                          {p.listings.length > 0 && (
                            <span>
                              · {p.listings.length} revendeur{p.listings.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <dl className="grid w-full grid-cols-3 gap-x-4 text-right text-xs">
                        <div>
                          <dt className="text-muted-foreground">Prix conseillé</dt>
                          <dd className="text-sm tabular-nums">{formatPrice(p.msrp)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Meilleur prix</dt>
                          <dd className="text-sm tabular-nums">
                            {p.best ? (
                              <a
                                href={p.best.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:underline"
                                title={p.best.retailerName}
                              >
                                {formatPrice(p.best.price)}
                                <ExternalLink className="size-3" />
                              </a>
                            ) : (
                              '—'
                            )}
                          </dd>
                          {p.best && (
                            <dd className="mt-0.5">
                              <AvailabilityBadge availability={p.best.availability} />
                            </dd>
                          )}
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Revente</dt>
                          <dd className="text-sm tabular-nums">
                            {resale ? formatPrice(resale.price) : '—'}
                          </dd>
                          {gain !== null && (
                            <dd
                              className={cn(
                                'tabular-nums',
                                gain > 0.05 && 'text-success',
                                gain < -0.05 && 'text-destructive',
                              )}
                            >
                              {formatPercent(gain)}
                            </dd>
                          )}
                        </div>
                      </dl>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <Card className={cn(fitCard, 'lg:col-start-1 lg:row-start-1')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="size-4" /> Produits scellés
                </CardTitle>
              </CardHeader>
              <CardContent>{none(' produit')}</CardContent>
            </Card>
          )}

          {results.releases.length === 0 && (
            <Card className={cn(fitCard, 'lg:col-start-2 lg:row-start-1')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="size-4" /> Extensions
                </CardTitle>
              </CardHeader>
              <CardContent>{none('e extension')}</CardContent>
            </Card>
          )}

          {results.cards.length > 0 ? (
            <Card className={cn(fitCard, 'lg:col-start-3 lg:row-start-1')}>
              <CardHeader>
                <div className="min-w-0 space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="size-4" /> Cartes Pokémon
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Prix Cardmarket (tendance) via TCGdex
                  </p>
                </div>
                {results.cardTotal > results.cards.length && (
                  <Link
                    href={`/cartes?q=${encodeURIComponent(q)}`}
                    className="shrink-0 text-sm text-primary hover:underline"
                  >
                    Voir les {results.cardTotal} cartes
                  </Link>
                )}
              </CardHeader>
              <CardContent
                className={cn(
                  'grid grid-cols-2 content-start gap-3 sm:grid-cols-4 lg:grid-cols-3',
                  fitScroll,
                )}
              >
                {results.cards.map((c) => (
                  <Link
                    key={c.id}
                    href={`/cartes/${encodeURIComponent(c.id)}`}
                    className="min-w-0 rounded-md transition-opacity hover:opacity-85"
                  >
                    <figure className="min-w-0">
                      {c.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          referrerPolicy="no-referrer"
                          src={c.image}
                          alt={c.name}
                          loading="lazy"
                          className="aspect-[63/88] w-full rounded-md border bg-muted object-cover"
                        />
                      ) : (
                        <div className="aspect-[63/88] w-full rounded-md border bg-muted" />
                      )}
                      <figcaption className="mt-1.5 space-y-0.5 text-xs">
                        <span className="block truncate font-medium">{c.name}</span>
                        <span className="block truncate text-muted-foreground">
                          {[c.setName, c.number].filter(Boolean).join(' · ')}
                        </span>
                        <span className="flex items-center justify-between gap-1">
                          <span className="tabular-nums">{formatPrice(c.price)}</span>
                          {c.tracked && <Badge variant="info">Suivie</Badge>}
                        </span>
                      </figcaption>
                    </figure>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className={cn(fitCard, 'lg:col-start-3 lg:row-start-1')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4" /> Cartes Pokémon
                </CardTitle>
              </CardHeader>
              <CardContent>{none('e carte')}</CardContent>
            </Card>
          )}
        </div>
      )}
    </FitPage>
  );
}
