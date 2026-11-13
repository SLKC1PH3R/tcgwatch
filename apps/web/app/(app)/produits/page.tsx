import { Bell, ExternalLink, Plus, TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  boosterCount,
  formatDate,
  formatPercent,
  formatPrice,
  PRODUCT_TYPE_LABELS,
  type ProductTypeKey,
} from '@tcgwatch/shared';
import { AvailabilityBadge } from '@/components/availability-badge';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getLowSinceBadges } from '@/lib/data/history';
import { getProducts } from '@/lib/data/products';

export const metadata: Metadata = { title: 'Produits suivis' };

export default async function ProductsPage() {
  const products = await getProducts();
  const lows = await getLowSinceBadges(
    products.map((p) => ({ id: p.id, best: p.best?.price ?? null })),
  );

  return (
    <>
      <PageHeader
        title="Produits suivis"
        description="Meilleur prix actuel et disponibilité par revendeur. Les liens ouvrent la fiche du site : aucun achat automatique."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/produits/nouveau">Nouveau produit</Link>
            </Button>
            <Button asChild>
              <Link href="/produits/ajouter">
                <Plus /> Ajouter une URL
              </Link>
            </Button>
          </>
        }
      />
      <Card className="py-2">
        <CardContent className="px-2">
          {products.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucun produit. Commencez par{' '}
              <Link href="/produits/ajouter" className="text-primary underline">
                ajouter une URL
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Meilleur prix</TableHead>
                  <TableHead>Disponibilité par site</TableHead>
                  <TableHead className="text-right">Prix cible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id} className="align-top">
                    <TableCell className="min-w-56">
                      <div className="flex items-start gap-3">
                        {p.displayImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            referrerPolicy="no-referrer"
                            src={p.displayImage}
                            alt=""
                            className="size-12 shrink-0 rounded-md border bg-white object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="size-12 shrink-0 rounded-md border bg-muted" />
                        )}
                        <div className="space-y-1">
                          <Link href={`/produits/${p.id}`} className="font-medium hover:underline">
                            {p.name}
                          </Link>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <Badge variant="outline">
                              {PRODUCT_TYPE_LABELS[p.type as ProductTypeKey] ?? p.type}
                            </Badge>
                            {p.release && (p.release.setCode || p.release.nameFr !== p.name) && (
                              <span>{p.release.setCode ?? p.release.nameFr}</span>
                            )}
                            {(p.releaseDate ?? p.release?.releaseDate) && (
                              <span>· {formatDate(p.releaseDate ?? p.release?.releaseDate)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-40">
                      {p.best ? (
                        <div className="space-y-1.5">
                          <p className="text-lg font-semibold tabular-nums">
                            {formatPrice(p.best.price)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.best.retailerName}
                            {p.best.delivered !== null &&
                              ` · livré ${formatPrice(p.best.delivered)}`}
                          </p>
                          <LowSince low={lows.get(p.id)} />
                          <PerBooster
                            name={p.name}
                            type={p.type}
                            price={p.best.price}
                            msrp={p.msrp}
                          />
                          <Button asChild size="sm">
                            <a href={p.best.url} target="_blank" rel="noopener noreferrer">
                              Acheter <ExternalLink />
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Indisponible</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.listings.length === 0 ? (
                        <span className="text-sm text-muted-foreground">Aucune fiche suivie</span>
                      ) : (
                        <ul className="space-y-1.5">
                          {p.listings.map((l) => (
                            <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="w-24 truncate font-medium">{l.retailerName}</span>
                              <AvailabilityBadge availability={l.availability} />
                              <span className="tabular-nums">{formatPrice(l.price)}</span>
                              {l.state === 'PAUSED' && <Badge variant="secondary">En pause</Badge>}
                              {(l.state === 'ERROR' || l.state === 'BLOCKED_BY_ROBOTS') && (
                                <span title={l.lastError ?? ''} className="text-destructive">
                                  <TriangleAlert className="size-4" />
                                </span>
                              )}
                              <a
                                href={l.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                Acheter
                              </a>
                              {l.stockAlertUrl && (
                                <a
                                  href={l.stockAlertUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                  title="Alerte de stock du site"
                                >
                                  <Bell className="size-3.5" /> Alerte site
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(p.targetPrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** Pastille « plus bas depuis X jours » (meilleur prix achetable). */
function LowSince({ low }: { low?: { days: number; allTime: boolean } }) {
  if (!low) return null;
  return (
    <Badge
      variant="outline"
      className="border-success/40 text-success"
      title="Meilleur prix achetable, toutes boutiques suivies"
    >
      {low.allTime ? `Plus bas jamais vu (${low.days} j)` : `Plus bas depuis ${low.days} j`}
    </Badge>
  );
}

/** Prix par booster et écart avec le prix conseillé ramené au booster. */
function PerBooster({
  name,
  type,
  price,
  msrp,
}: {
  name: string;
  type: string;
  price: number;
  msrp: number | null;
}) {
  const n = boosterCount(name, type);
  if (!n || n === 1) return null;
  const gap = msrp ? price / msrp - 1 : null;
  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      {formatPrice(price / n)} / booster
      {gap !== null && <span> · {formatPercent(gap)} vs conseillé</span>}
    </p>
  );
}
