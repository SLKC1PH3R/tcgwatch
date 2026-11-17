import { Trash2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatDate,
  formatPercent,
  formatPrice,
  PRICE_CATEGORIES,
  priceCategoryOf,
} from '@tcgwatch/shared';
import { AutoSubmitSelect } from '@/components/auto-submit-select';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCollection } from '@/lib/data/collection';
import { getProductOptions } from '@/lib/data/products';
import { cn } from '@/lib/utils';
import { deleteCollectionItemAction } from './actions';
import { CollectionForm, CONDITION_LABELS } from './collection-form';

export const metadata: Metadata = { title: 'Ma collection' };

const SORTS = [
  { value: 'plus-value', label: 'Trier : plus-value' },
  { value: 'valeur', label: 'Trier : valeur' },
  { value: 'achat', label: 'Trier : date d’achat' },
  { value: 'nom', label: 'Trier : nom' },
] as const;
type Sort = (typeof SORTS)[number]['value'];

type Props = { searchParams: Promise<{ tri?: string; categorie?: string }> };

export default async function CollectionPage({ searchParams }: Props) {
  const { tri, categorie } = await searchParams;
  const category = PRICE_CATEGORIES.find((c) => c.key === categorie);
  const sort: Sort = SORTS.find((s) => s.value === tri)?.value ?? 'plus-value';
  const [{ rows: allRows, valuation: v }, products] = await Promise.all([
    getCollection(),
    getProductOptions(),
  ]);
  // Filtre par type (ETB, display…) : la valorisation en tête reste celle de tout le scellé.
  const rows = category
    ? allRows.filter((r) => priceCategoryOf(r.product.name, r.product.type)?.key === category.key)
    : allRows;
  const positive = v.unrealizedGain >= 0;
  const quantity = rows.reduce((n, r) => n + r.quantity, 0);
  const sorted = [...rows].sort((a, b) => {
    switch (sort) {
      case 'valeur':
        return (b.unitValue ?? 0) * b.quantity - (a.unitValue ?? 0) * a.quantity;
      case 'achat':
        return (b.purchaseDate?.getTime() ?? 0) - (a.purchaseDate?.getTime() ?? 0);
      case 'nom':
        return a.product.name.localeCompare(b.product.name, 'fr');
      default:
        return (b.gain ?? -Infinity) - (a.gain ?? -Infinity);
    }
  });

  return (
    <>
      <PageHeader
        title={category ? `Ma collection · ${category.label}` : 'Ma collection'}
        description="Valeur estimée au dernier prix marché connu, à défaut au meilleur prix boutique."
        actions={
          <>
            <Button asChild variant="outline">
              <a href="/api/collection/export">Exporter CSV</a>
            </Button>
            <Button asChild>
              <a href="#ajouter-achat">Ajouter un achat</a>
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="holo-frame">
          <CardContent className="flex h-full flex-col justify-center gap-2 py-4">
            <p className="text-sm text-muted-foreground">Valeur estimée</p>
            <p className="font-display text-5xl font-extrabold tracking-tight tabular-nums md:text-6xl">
              {formatPrice(v.estimatedValue)}
            </p>
            {v.estimatedFromRetail > 0 && (
              <p className="text-sm text-muted-foreground">
                Dont {formatPrice(v.estimatedFromRetail)} estimés au prix boutique (pas de prix
                marché).
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 py-1">
            <div>
              <p className="text-xs text-muted-foreground">Investi</p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {formatPrice(v.totalCost)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plus-value latente</p>
              <p
                className={cn(
                  'font-display text-2xl font-bold tabular-nums',
                  positive ? 'text-success' : 'text-destructive',
                )}
              >
                {positive ? '+' : ''}
                {formatPrice(v.unrealizedGain)}
              </p>
              {v.ratio !== null && (
                <p className={cn('text-xs', positive ? 'text-success' : 'text-destructive')}>
                  {formatPercent(v.ratio - 1)} · ratio{' '}
                  {v.ratio.toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6 overflow-hidden py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="font-display text-lg font-bold">
            {rows.length} ligne{rows.length > 1 ? 's' : ''} · {quantity} produit
            {quantity > 1 ? 's' : ''}
          </h2>
          <form>
            {category && <input type="hidden" name="categorie" value={category.key} />}
            <AutoSubmitSelect
              name="tri"
              value={sort}
              label="Trier la collection"
              options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
              className="h-10 rounded-lg border bg-secondary px-3 text-sm font-medium"
            />
            <noscript>
              <Button type="submit" size="sm" variant="outline" className="ml-2">
                Trier
              </Button>
            </noscript>
          </form>
        </div>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {category
              ? `Aucun produit « ${category.label} » dans ta collection.`
              : 'Votre collection est vide.'}
          </p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                <tr className="border-b">
                  <th className="px-5 py-3 text-left font-semibold">Produit</th>
                  <th className="px-3 py-3 text-right font-semibold">Qté</th>
                  <th className="px-3 py-3 text-right font-semibold">Achat (u.)</th>
                  <th className="px-3 py-3 text-right font-semibold">Valeur (u.)</th>
                  <th className="px-3 py-3 text-right font-semibold">Plus-value</th>
                  <th className="px-3 py-3 text-left font-semibold">Achat</th>
                  <th className="px-3 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {r.photoPath || r.product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            referrerPolicy="no-referrer"
                            src={r.photoPath ? `/api/uploads/${r.photoPath}` : r.product.imageUrl!}
                            alt=""
                            className="size-10 shrink-0 rounded-lg border bg-white object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="size-10 shrink-0 rounded-lg border bg-muted" />
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/produits/${r.product.id}`}
                            className="line-clamp-2 font-semibold hover:underline"
                          >
                            {r.product.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {CONDITION_LABELS[r.condition]}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.quantity}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                      {formatPrice(r.purchasePrice)}
                    </td>
                    <td
                      className="px-3 py-3 text-right font-bold tabular-nums"
                      title={r.valueSource ? `Prix ${r.valueSource}` : 'Pas de prix connu'}
                    >
                      {formatPrice(r.unitValue)}
                      {r.valueSource === 'boutique' && (
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          prix boutique
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {r.gain !== null ? (
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs font-bold tabular-nums',
                            r.gain >= 0
                              ? 'bg-success/15 text-success'
                              : 'bg-destructive/15 text-destructive',
                          )}
                        >
                          {r.gain >= 0 ? '+' : ''}
                          {formatPrice(r.gain)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap text-muted-foreground">
                      {[formatDate(r.purchaseDate), r.store].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <form action={deleteCollectionItemAction.bind(null, r.id)}>
                        <Button
                          size="icon"
                          variant="ghost"
                          type="submit"
                          aria-label={`Supprimer ${r.product.name}`}
                          title="Supprimer cette ligne"
                          className="size-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card id="ajouter-achat" className="max-w-2xl scroll-mt-24">
        <CardHeader className="flex-col">
          <CardTitle>Ajouter un achat</CardTitle>
          <CardDescription>
            Choisissez un produit du catalogue (importé automatiquement).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CollectionForm products={products} today={new Date().toISOString().slice(0, 10)} />
        </CardContent>
      </Card>
    </>
  );
}
