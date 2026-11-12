import { Bell, ExternalLink, Plus, TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatDate,
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
import { getProducts } from '@/lib/data/products';

export const metadata: Metadata = { title: 'Produits suivis' };

export default async function ProductsPage() {
  const products = await getProducts();

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
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            referrerPolicy="no-referrer"
                            src={p.imageUrl}
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
                            {p.release && <span>{p.release.setCode ?? p.release.nameFr}</span>}
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
                          <p className="text-xs text-muted-foreground">{p.best.retailerName}</p>
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
