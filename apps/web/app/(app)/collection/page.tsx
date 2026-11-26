import { Trash2, Undo2 } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { after } from 'next/server';
import {
  formatDate,
  formatPercent,
  formatPrice,
  PRICE_CATEGORIES,
  priceCategoryOf,
} from '@tcgwatch/shared';
import { AutoSubmitSelect } from '@/components/auto-submit-select';
import { PriceSourceToggle } from '@/components/price-source-toggle';
import { CollectionChart } from '@/components/collection-chart';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCollection, getCollectionHistory } from '@/lib/data/collection';
import { breakdownByType } from '@/lib/data/dashboard';
import { refreshOwnedCardPrices } from '@/lib/data/extensions';
import { getProductOptions } from '@/lib/data/products';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { PRICE_COOKIE, parsePriceSource } from '@/lib/price-source';
import { cn } from '@/lib/utils';
import { cancelSaleAction, deleteCollectionItemAction } from './actions';
import { AddPurchaseDialog } from './add-purchase-dialog';
import { CONDITION_LABELS } from './collection-form';
import { SellDialog } from './sell-dialog';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Ma collection' };

const SHARE_COLORS = [
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-1)',
];
const euros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const SORTS = [
  { value: 'plus-value', label: 'Trier : plus-value' },
  { value: 'valeur', label: 'Trier : valeur' },
  { value: 'achat', label: 'Trier : date d’achat' },
  { value: 'nom', label: 'Trier : nom' },
] as const;
type Sort = (typeof SORTS)[number]['value'];

type Props = { searchParams: Promise<{ tri?: string; categorie?: string; vue?: string }> };

export default async function CollectionPage({ searchParams }: Props) {
  const { tri, categorie, vue } = await searchParams;
  const soldView = vue === 'vendus';
  const today = new Date().toISOString().slice(0, 10);
  const user = await requireUser();
  const priceSource = parsePriceSource((await cookies()).get(PRICE_COOKIE)?.value);
  const category = PRICE_CATEGORIES.find((c) => c.key === categorie);
  const sort: Sort = SORTS.find((s) => s.value === tri)?.value ?? 'plus-value';
  const [{ rows: allRows, sold: allSold, realized, valuation: v }, products, history] =
    await Promise.all([
      getCollection(user.id, priceSource),
      getProductOptions(),
      getCollectionHistory(user.id, 5 * 366, priceSource),
    ]);
  const breakdown = breakdownByType(allRows, v.cards.value);
  // Filtre par type (ETB, display…) : la valorisation en tête reste celle de tout le scellé.
  const inCategory = (r: { product: { name: string; type: string } }) =>
    !category || priceCategoryOf(r.product.name, r.product.type)?.key === category.key;
  const rows = allRows.filter(inCategory);
  const sold = allSold.filter(inCategory);
  const viewHref = (sold: boolean) => {
    const params = new URLSearchParams();
    if (category) params.set('categorie', category.key);
    if (tri) params.set('tri', tri);
    if (sold) params.set('vue', 'vendus');
    const qs = params.toString();
    return qs ? `/collection?${qs}` : '/collection';
  };
  // Cartes possédées pas encore cotées : reliées à Cardmarket après l'affichage.
  after(() => refreshOwnedCardPrices().then(() => undefined));
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
    <FitPage>
      <PageHeader
        title={category ? `Ma collection · ${category.label}` : 'Ma collection'}
        description={`Scellé et cartes : le scellé au dernier prix marché connu (à défaut au meilleur prix boutique), les cartes ${priceSource === 'ebay' ? 'au prix eBay FR (à défaut à leur cote Cardmarket)' : 'à leur cote Cardmarket'}.`}
        actions={
          <>
            <Button asChild variant="outline">
              <a href="/api/collection/export">Exporter CSV</a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/collection/bilan">Bilan des reventes</Link>
            </Button>
            <AddPurchaseDialog products={products} today={today} />
          </>
        }
      />

      <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] [&>*]:min-w-0">
        <Card className="holo-frame py-4">
          <CardContent className="flex h-full flex-col justify-center gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="label-mono text-muted-foreground">Valeur estimée</p>
              <PriceSourceToggle current={priceSource} />
            </div>
            <p className="font-display text-4xl font-extrabold tracking-tight tabular-nums">
              {formatPrice(v.estimatedValue)}
            </p>
            <p className="text-sm text-muted-foreground">
              Scellé {formatPrice(v.sealed.estimatedValue)} ·{' '}
              <Link href="/collection/cartes" className="hover:text-foreground hover:underline">
                Cartes {formatPrice(v.cards.value)} ({v.cards.copies} carte
                {v.cards.copies > 1 ? 's' : ''})
              </Link>
            </p>
            {v.cards.fallbackCopies > 0 && (
              <p className="text-sm text-muted-foreground">
                Dont {v.cards.fallbackCopies} carte{v.cards.fallbackCopies > 1 ? 's' : ''} sans prix
                eBay FR, comptée{v.cards.fallbackCopies > 1 ? 's' : ''} à la cote Cardmarket.
              </p>
            )}
            {v.estimatedFromRetail > 0 && (
              <p className="text-sm text-muted-foreground">
                Dont {formatPrice(v.estimatedFromRetail)} estimés au prix boutique (pas de prix
                marché).
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="label-mono text-muted-foreground">Investi</p>
              <p className="font-display text-xl font-bold tabular-nums 2xl:text-2xl">
                {formatPrice(v.totalCost)}
              </p>
              {v.cards.copies > 0 && (
                <p
                  className="text-xs text-muted-foreground"
                  title="Cartes sans prix d’achat comptées 0 € (issues de boosters déjà payés)"
                >
                  cartes sans prix d’achat : 0 €
                </p>
              )}
            </div>
            <div>
              <p className="label-mono text-muted-foreground">Plus-value latente</p>
              <p
                className={cn(
                  'font-display text-xl font-bold tabular-nums 2xl:text-2xl',
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
            <div>
              <p className="label-mono text-muted-foreground">Plus-value réalisée</p>
              <p
                className={cn(
                  'font-display text-xl font-bold tabular-nums 2xl:text-2xl',
                  realized.count === 0
                    ? 'text-muted-foreground'
                    : realized.gain >= 0
                      ? 'text-success'
                      : 'text-destructive',
                )}
              >
                {realized.count === 0
                  ? '—'
                  : `${realized.gain >= 0 ? '+' : ''}${formatPrice(realized.gain)}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {realized.count === 0
                  ? 'aucune revente'
                  : `${realized.count} vendu${realized.count > 1 ? 's' : ''} · ${formatPrice(realized.proceeds)} encaissés`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={cn(fitGrid, 'xl:grid-cols-[minmax(0,1fr)_26rem]')}>
        <Card className={cn(fitCard, 'overflow-hidden py-0')}>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
            <nav aria-label="Vue" className="flex gap-1 rounded-full border bg-popover p-1">
              {[
                { sold: false, label: `En collection · ${quantity}` },
                { sold: true, label: `Vendus · ${sold.reduce((n, r) => n + r.quantity, 0)}` },
              ].map((t) => (
                <Link
                  key={t.label}
                  href={viewHref(t.sold)}
                  scroll={false}
                  aria-current={soldView === t.sold ? 'page' : undefined}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
                    soldView === t.sold && 'bg-foreground text-background hover:text-background',
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
            <form className={cn(soldView && 'hidden')}>
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
          {soldView ? (
            <SoldTable rows={sold} />
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {category
                ? `Aucun produit « ${category.label} » dans ta collection.`
                : 'Votre collection est vide.'}
            </p>
          ) : (
            <div className={cn('relative overflow-x-auto', fitScroll)}>
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-xs tracking-wide text-muted-foreground uppercase fit:sticky fit:top-0 fit:z-10 fit:bg-card">
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
                              src={
                                r.photoPath ? `/api/uploads/${r.photoPath}` : r.product.imageUrl!
                              }
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
                      <td
                        className="px-3 py-3 text-right text-muted-foreground tabular-nums"
                        title={
                          r.shipping
                            ? `${formatPrice(r.purchasePrice)} + ${formatPrice(r.shipping)} de port`
                            : undefined
                        }
                      >
                        {formatPrice(r.unitCost)}
                        {r.shipping ? (
                          <span className="block text-[11px] font-normal">port compris</span>
                        ) : null}
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
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <SellDialog
                          id={r.id}
                          name={r.product.name}
                          quantity={r.quantity}
                          purchaseDate={r.purchaseDate.toISOString().slice(0, 10)}
                          suggestedPrice={r.unitValue}
                          today={today}
                        />
                        <form
                          action={deleteCollectionItemAction.bind(null, r.id)}
                          className="inline-block"
                        >
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

        <div className={fitColumn}>
          <Card className={cn(fitCard, 'fit:flex-1')}>
            <CardHeader>
              <CardTitle>Évolution de la collection</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col fit:min-h-0 fit:flex-1">
              <CollectionChart history={history} />
            </CardContent>
          </Card>
          {breakdown.length > 0 && (
            <Card className={cn(fitCard, 'shrink-0')}>
              <CardHeader>
                <CardTitle>Répartition</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
                  role="img"
                  aria-label={breakdown
                    .map((b) => `${b.label} ${Math.round(b.share * 100)} %`)
                    .join(', ')}
                >
                  {breakdown.map((b, i) => (
                    <span
                      key={b.key}
                      className="h-full"
                      style={{
                        flex: `${b.share} 1 0%`,
                        background: SHARE_COLORS[i % SHARE_COLORS.length],
                      }}
                    />
                  ))}
                </div>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {breakdown.map((b, i) => (
                    <li key={b.key} className="flex min-w-0 items-center gap-2 text-sm">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: SHARE_COLORS[i % SHARE_COLORS.length] }}
                      />
                      <span className="truncate font-semibold">{b.label}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
                        {euros.format(b.value)} · {Math.round(b.share * 100)} %
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </FitPage>
  );
}

type SoldRow = Awaited<ReturnType<typeof getCollection>>['sold'][number];

function SoldTable({ rows }: { rows: SoldRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aucune revente enregistrée. Utilise le bouton « Vendre » d’une ligne de ta collection.
      </p>
    );
  }
  return (
    <div className={cn('relative overflow-x-auto', fitScroll)}>
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-xs tracking-wide text-muted-foreground uppercase fit:sticky fit:top-0 fit:z-10 fit:bg-card">
          <tr className="border-b">
            <th className="px-5 py-3 text-left font-semibold">Produit</th>
            <th className="px-3 py-3 text-right font-semibold">Qté</th>
            <th className="px-3 py-3 text-right font-semibold">Coût</th>
            <th className="px-3 py-3 text-right font-semibold">Vendu</th>
            <th className="px-3 py-3 text-right font-semibold">Plus-value</th>
            <th className="px-3 py-3 text-left font-semibold">Vente</th>
            <th className="px-3 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-5 py-3">
                <Link
                  href={`/produits/${r.product.id}`}
                  className="line-clamp-2 font-semibold hover:underline"
                >
                  {r.product.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  Acheté {formatDate(r.purchaseDate)}
                  {r.store ? ` · ${r.store}` : ''}
                </p>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{r.quantity}</td>
              <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                {formatPrice(r.cost)}
                <span className="block text-[11px]">{formatPrice(r.unitCost)} / u.</span>
              </td>
              <td className="px-3 py-3 text-right font-bold tabular-nums">
                {formatPrice(r.proceeds)}
                <span className="block text-[11px] font-normal text-muted-foreground">
                  {formatPrice(r.salePrice)} / u.
                  {r.saleFees ? ` − ${formatPrice(r.saleFees)} frais` : ''}
                </span>
              </td>
              <td className="px-3 py-3 text-right">
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
              </td>
              <td className="px-3 py-3 text-xs whitespace-nowrap text-muted-foreground">
                {[formatDate(r.soldAt), r.saleChannel].filter(Boolean).join(' · ')}
              </td>
              <td className="px-3 py-3 text-right">
                <form action={cancelSaleAction.bind(null, r.id)}>
                  <Button
                    size="icon"
                    variant="ghost"
                    type="submit"
                    aria-label={`Annuler la vente de ${r.product.name}`}
                    title="Annuler la vente (la ligne revient dans la collection)"
                    className="size-8 text-muted-foreground"
                  >
                    <Undo2 />
                  </Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
