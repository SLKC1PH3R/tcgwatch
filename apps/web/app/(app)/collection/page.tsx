import { Download, Trash2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate, formatPercent, formatPrice } from '@tcgwatch/shared';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getCollection } from '@/lib/data/collection';
import { getProductOptions } from '@/lib/data/products';
import { cn } from '@/lib/utils';
import { deleteCollectionItemAction } from './actions';
import { CollectionForm, CONDITION_LABELS } from './collection-form';

export const metadata: Metadata = { title: 'Ma collection' };

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-semibold tabular-nums', className)}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function CollectionPage() {
  const [{ rows, valuation }, products] = await Promise.all([getCollection(), getProductOptions()]);
  const positive = valuation.unrealizedGain >= 0;

  return (
    <>
      <PageHeader
        title="Ma collection"
        description="Valeur estimée au dernier prix marché connu, à défaut au meilleur prix boutique."
        actions={
          <Button asChild variant="outline">
            <a href="/api/collection/export">
              <Download /> Export CSV
            </a>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Investi" value={formatPrice(valuation.totalCost)} />
        <Stat label="Valeur estimée" value={formatPrice(valuation.estimatedValue)} />
        <Stat
          label="Plus-value latente"
          value={`${positive ? '+' : ''}${formatPrice(valuation.unrealizedGain)}`}
          className={positive ? 'text-success' : 'text-destructive'}
        />
        <Stat
          label="Performance"
          value={formatPercent(valuation.ratio !== null ? valuation.ratio - 1 : null)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="py-2">
          <CardContent className="px-2">
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Votre collection est vide.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">Achat (u.)</TableHead>
                    <TableHead className="text-right">Valeur (u.)</TableHead>
                    <TableHead className="text-right">Plus-value</TableHead>
                    <TableHead>Achat</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="min-w-52">
                        <div className="flex items-center gap-3">
                          {r.photoPath || r.product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              referrerPolicy="no-referrer"
                              src={
                                r.photoPath ? `/api/uploads/${r.photoPath}` : r.product.imageUrl!
                              }
                              alt=""
                              className="size-10 shrink-0 rounded border bg-white object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="size-10 shrink-0 rounded border bg-muted" />
                          )}
                          <div>
                            <Link
                              href={`/produits/${r.product.id}`}
                              className="font-medium hover:underline"
                            >
                              {r.product.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {CONDITION_LABELS[r.condition]}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(r.purchasePrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(r.unitValue)}
                        {r.valueSource && (
                          <Badge
                            variant={r.valueSource === 'marché' ? 'info' : 'secondary'}
                            className="ml-1"
                          >
                            {r.valueSource}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right tabular-nums',
                          r.gain !== null && (r.gain >= 0 ? 'text-success' : 'text-destructive'),
                        )}
                      >
                        {r.gain !== null ? `${r.gain >= 0 ? '+' : ''}${formatPrice(r.gain)}` : '—'}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatDate(r.purchaseDate)}
                        {r.store && <div>{r.store}</div>}
                      </TableCell>
                      <TableCell>
                        <form action={deleteCollectionItemAction.bind(null, r.id)}>
                          <Button
                            size="icon"
                            variant="ghost"
                            type="submit"
                            aria-label="Supprimer"
                            className="text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader className="flex-col">
            <CardTitle>Ajouter un achat</CardTitle>
            <CardDescription>
              Produit absent ?{' '}
              <Link href="/produits/nouveau" className="text-primary hover:underline">
                Créez-le
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CollectionForm products={products} today={new Date().toISOString().slice(0, 10)} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
