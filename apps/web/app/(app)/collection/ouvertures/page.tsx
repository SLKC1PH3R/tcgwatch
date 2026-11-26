import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  formatDate,
  formatPercent,
  formatPrice,
  PRODUCT_TYPE_LABELS,
  todayUtc,
  type ProductTypeKey,
} from '@tcgwatch/shared';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { PriceSourceToggle } from '@/components/price-source-toggle';
import { SafeImg } from '@/components/safe-img';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth';
import { getOpenings, getOpeningStats } from '@/lib/data/openings';
import { getProductOptions } from '@/lib/data/products';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { PRICE_COOKIE, parsePriceSource } from '@/lib/price-source';
import { cn } from '@/lib/utils';
import { NewOpeningForm } from './new-opening-form';

export const metadata: Metadata = { title: 'Ouvertures' };

/**
 * Rentabilité des produits ouverts : ce que chaque display, ETB ou booster a rapporté face à
 * son prix, et la moyenne par produit sur toutes les ouvertures du site.
 */
export default async function OpeningsPage() {
  const user = await requireUser();
  const [openings, stats, products, jar] = await Promise.all([
    getOpenings(user.id),
    getOpeningStats(),
    getProductOptions(),
    cookies(),
  ]);
  const priceSource = parsePriceSource(jar.get(PRICE_COOKIE)?.value);
  const valueOf = (v: { cm: number; fr: number }) => (priceSource === 'ebay' ? v.fr : v.cm);
  const spent = openings.reduce((n, o) => n + o.price, 0);
  const pulled = openings.reduce((n, o) => n + valueOf(o.value), 0);

  return (
    <FitPage>
      <PageHeader
        title="Ouvertures"
        description="Notez les cartes sorties d’un display, d’un ETB ou d’un booster : vous voyez ce qu’il a rapporté face à son prix, et la moyenne de chaque produit sur toutes les ouvertures du site."
        actions={<PriceSourceToggle current={priceSource} />}
      />
      <div className="grid shrink-0 gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Produits ouverts',
            value: String(openings.length),
            hint: `${formatPrice(spent)} dépensés`,
          },
          {
            label: `Valeur tirée · ${priceSource === 'ebay' ? 'eBay FR' : 'Cardmarket'}`,
            value: formatPrice(pulled),
            hint: 'cartes sorties, au prix du jour',
          },
          {
            label: 'Rendement',
            value: spent > 0 ? `${Math.round((pulled / spent) * 100)} %` : '—',
            hint:
              spent > 0
                ? `${formatPercent(pulled / spent - 1)} par rapport au prix payé`
                : 'aucune ouverture',
          },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl border bg-card px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground">{t.label}</p>
            <p className="font-display text-2xl font-bold tabular-nums">{t.value}</p>
            <p className="text-xs text-muted-foreground">{t.hint}</p>
          </div>
        ))}
      </div>

      <div className={cn(fitGrid, 'xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,1fr)]')}>
        <Card className={cn(fitCard, 'pb-0')}>
          <CardHeader className="shrink-0">
            <CardTitle>
              Mes ouvertures{' '}
              <span className="font-sans text-sm text-muted-foreground">· {openings.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className={cn('px-0', fitScroll)}>
            {openings.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">
                Aucune ouverture pour l’instant : choisissez le produit à droite, puis touchez les
                cartes qui en sont sorties.
              </p>
            ) : (
              <ul className="divide-y">
                {openings.map((o) => {
                  const value = valueOf(o.value);
                  const gain = value - o.price;
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/collection/ouvertures/${o.id}`}
                        className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-accent"
                      >
                        <SafeImg
                          src={o.product.imageUrl}
                          alt=""
                          className="size-14 shrink-0 rounded-lg bg-muted object-contain"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate text-sm font-semibold">{o.product.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatDate(o.openedAt)} · {o.cards} carte{o.cards > 1 ? 's' : ''} ·
                            payé {formatPrice(o.price)}
                          </p>
                          <div className="flex gap-1">
                            {o.hits.map((h) => (
                              <span
                                key={`${h.id}:${h.variant}`}
                                title={`${h.name}${h.price !== null ? ` · ${formatPrice(h.price)}` : ''}`}
                              >
                                <SafeImg
                                  src={h.image}
                                  alt={h.name}
                                  className="h-10 w-7 rounded bg-muted object-cover"
                                />
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <p className="text-sm font-semibold">{formatPrice(value)}</p>
                          <p
                            className={cn(
                              'text-xs',
                              gain >= 0 ? 'text-success' : 'text-destructive',
                            )}
                          >
                            {gain >= 0 ? '+' : ''}
                            {formatPrice(gain)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-col gap-4">
          <Card className="shrink-0">
            <CardHeader>
              <CardTitle>Nouvelle ouverture</CardTitle>
            </CardHeader>
            <CardContent>
              <NewOpeningForm
                today={todayUtc().toISOString().slice(0, 10)}
                products={products.filter((p) => p.type !== 'DECK' && p.type !== 'AUTRE')}
              />
            </CardContent>
          </Card>
          <Card className={cn(fitCard, 'pb-0')}>
            <CardHeader className="shrink-0">
              <CardTitle>Ce que rapporte chaque produit</CardTitle>
              <CardDescription>
                Moyenne de toutes les ouvertures saisies sur le site, cartes au prix du jour.
              </CardDescription>
            </CardHeader>
            <CardContent className={cn('px-0', fitScroll)}>
              {stats.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">Pas encore de données.</p>
              ) : (
                <ul className="divide-y">
                  {stats.map((s) => {
                    const v = priceSource === 'ebay' ? s.avgFr : s.avgCm;
                    return (
                      <li key={s.id} className="flex items-center gap-3 px-6 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {PRODUCT_TYPE_LABELS[s.type as ProductTypeKey] ?? s.type} · {s.count}{' '}
                            ouverture{s.count > 1 ? 's' : ''} · payé {formatPrice(s.avgPrice)} en
                            moyenne
                          </p>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <p className="text-sm font-semibold">{formatPrice(v)}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.avgPrice > 0 ? `${Math.round((v / s.avgPrice) * 100)} %` : '—'}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </FitPage>
  );
}
