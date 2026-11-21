import { ExternalLink, MapPin, Trash2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import {
  formatPercent,
  formatPrice,
  marketSearchQuery,
  PRODUCT_TYPE_LABELS,
  type ProductTypeKey,
} from '@tcgwatch/shared';
import { FitPage } from '@/components/fit-page';
import { FormError } from '@/components/form-message';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getMyProducts,
  type MyListing,
  type MyProduct,
  type Verdict,
} from '@/lib/data/my-products';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { ago } from '@/lib/time';
import { cn } from '@/lib/utils';
import { removeMyProductAction, saveMyProductAction } from './actions';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Mes produits' };

const VERDICT: Record<Verdict, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  shop: { label: 'Bon prix en boutique', variant: 'success' },
  cardmarket: { label: 'Bon prix sur Cardmarket', variant: 'success' },
  close: { label: 'Proche du bon prix', variant: 'warning' },
  above: { label: 'Au-dessus du bon prix', variant: 'secondary' },
  unknown: { label: 'Pas encore de prix', variant: 'secondary' },
};

const fmtInput = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));

type Props = { searchParams: Promise<{ erreur?: string; ajouter?: string; ebay?: string }> };

/**
 * Mes produits : les produits à acheter au « bon prix » choisi (ex. ETB à 55 € de prix public,
 * bon prix sous 130 €). Pour chacun : meilleure offre en boutique, cote Cardmarket, annonces
 * eBay récentes (API officielle) et recherches préremplies Leboncoin / Vinted / eBay /
 * Cardmarket. Alertes dès qu'une source passe sous le bon prix.
 */
export default async function MyProductsPage({ searchParams }: Props) {
  const { erreur, ajouter, ebay: ebayFilter } = await searchParams;
  const user = await requireUser();
  const [{ products, listings }, options] = await Promise.all([
    getMyProducts(user.id),
    prisma.product.findMany({
      where: { targetPrice: null },
      select: {
        id: true,
        name: true,
        type: true,
        marketQuery: true,
        extension: { select: { nameFr: true, setCode: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);
  // Venu du bouton « Ajouter aux suivis » d'une fiche : produit présélectionné, nom de
  // recherche prérempli (modifiable), curseur sur le bon prix.
  const preselected = options.find((o) => o.id === ajouter);
  const ebay = Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
  const good = products.filter((p) => p.verdict === 'shop' || p.verdict === 'cardmarket');
  const fresh = listings.filter((l) => !l.auction && l.total <= l.target);
  const underOnly = ebayFilter === 'sous';
  const below = listings.filter((l) => l.total <= l.target);
  const shownListings = underOnly ? below : listings;
  const byType = new Map<string, typeof options>();
  for (const o of options) byType.set(o.type, [...(byType.get(o.type) ?? []), o]);

  return (
    <FitPage>
      <PageHeader
        title="Mes produits"
        description="Les produits que tu veux acheter, avec ton « bon prix » : TCGWatch compare les boutiques, la cote Cardmarket et les annonces eBay, et t’alerte dès que l’un d’eux passe dessous."
      />
      <FormError message={erreur} />

      <div className="grid shrink-0 gap-3 sm:grid-cols-3">
        <Tile label="Produits suivis" value={String(products.length)} />
        <Tile
          label="Sous ton bon prix maintenant"
          value={String(good.length)}
          valueClass={good.length ? 'text-success' : undefined}
          hint={good.map((p) => p.name).join(' · ') || 'aucun pour le moment'}
        />
        <Tile
          label="Annonces eBay sous le bon prix"
          value={ebay ? String(fresh.length) : '—'}
          hint={ebay ? 'achat immédiat, port compris' : 'clés eBay non configurées'}
        />
      </div>

      <div className={cn(fitGrid, 'lg:grid-cols-[minmax(0,1fr)_26rem]')}>
        {/* Ma liste : ajout en haut, produits qui défilent dessous */}
        <Card
          id="ajouter"
          className={cn(
            fitCard,
            'scroll-mt-24',
            preselected && 'border-primary ring-1 ring-primary',
          )}
        >
          <CardHeader>
            <CardTitle>
              Ma liste{' '}
              <span className="font-sans text-sm text-muted-foreground">· {products.length}</span>
            </CardTitle>
            <CardDescription className="w-full">
              Exemple : un ETB à 55 € de prix public est un bon achat sous 130 €. Les mots-clés
              servent aux recherches d’annonces (sinon « ETB Nuit Noire », d’après le produit).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              key={preselected?.id ?? 'new'}
              action={saveMyProductAction}
              className="grid gap-3 md:grid-cols-[minmax(0,2fr)_7rem_minmax(0,1fr)_auto] md:items-end"
            >
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="mp-product">Ajouter un produit</Label>
                <NativeSelect
                  id="mp-product"
                  name="productId"
                  required
                  defaultValue={preselected?.id ?? ''}
                >
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {[...byType].map(([type, list]) => (
                    <optgroup
                      key={type}
                      label={PRODUCT_TYPE_LABELS[type as ProductTypeKey] ?? type}
                    >
                      {list.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mp-target">Bon prix (€)</Label>
                <Input
                  id="mp-target"
                  name="targetPrice"
                  inputMode="decimal"
                  required
                  placeholder="130"
                  autoFocus={Boolean(preselected)}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="mp-query">Nom de recherche (facultatif)</Label>
                <Input
                  id="mp-query"
                  name="marketQuery"
                  placeholder="ETB Nuit Noire"
                  defaultValue={preselected ? marketSearchQuery(preselected) : undefined}
                />
              </div>
              <Button type="submit">Ajouter</Button>
            </form>
          </CardContent>
          <CardContent className={fitScroll}>
            {products.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucun produit pour l’instant : choisis-en un ci-dessus avec ton bon prix.
              </p>
            ) : (
              <ul className="space-y-3">
                {products.map((p) => (
                  <ProductRow key={p.id} p={p} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Annonces eBay */}
        <div className={fitColumn}>
          <Card className={cn(fitCard, 'fit:flex-1')}>
            <CardHeader>
              <CardTitle>Dernières annonces eBay</CardTitle>
              <CardDescription className="w-full">
                Annonces neuves en France, jusqu’à 25 % au-dessus du bon prix, relevées toutes les
                20 minutes par l’API officielle d’eBay{ebay ? '' : ' (pas encore active)'}.
              </CardDescription>
              {ebay && listings.length > 0 && (
                <nav aria-label="Filtrer les annonces" className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { label: 'Tous', count: listings.length, on: !underOnly, to: '' },
                    { label: 'Sous le prix', count: below.length, on: underOnly, to: '?ebay=sous' },
                  ].map((f) => (
                    <Link
                      key={f.label}
                      href={`/produits/mes-produits${f.to}`}
                      scroll={false}
                      aria-current={f.on ? 'true' : undefined}
                      className={cn(
                        'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors hover:bg-accent',
                        f.on &&
                          'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
                      )}
                    >
                      {f.label}
                      <span className="tabular-nums opacity-70">{f.count}</span>
                    </Link>
                  ))}
                </nav>
              )}
            </CardHeader>
            <CardContent className={cn('space-y-4', fitScroll)}>
              {!ebay ? (
                <p className="text-sm text-muted-foreground">
                  Pour l’activer : crée une application gratuite sur{' '}
                  <a
                    href="https://developer.ebay.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    developer.ebay.com
                  </a>
                  , puis renseigne <code>EBAY_CLIENT_ID</code> et <code>EBAY_CLIENT_SECRET</code>{' '}
                  (clés « Production ») dans les variables d’environnement du web et du worker.
                  Facultatif : <code>EBAY_PICKUP_POSTCODE</code> pour les remises en main propre
                  autour de chez toi.
                </p>
              ) : shownListings.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {underOnly
                    ? 'Aucune annonce sous ton bon prix pour l’instant.'
                    : 'Aucune annonce trouvée pour l’instant.'}
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {shownListings.map((l) => (
                    <ListingRow key={l.id} l={l} />
                  ))}
                </ul>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                Leboncoin et Vinted n’ont pas d’accès ouvert et interdisent la lecture automatique
                de leurs annonces : TCGWatch ouvre leurs recherches préremplies (les plus récentes
                d’abord, jusqu’à ton bon prix). Pour être prévenu en quelques minutes, ouvre le lien
                puis « Sauvegarder la recherche » (Leboncoin) ou « Sauvegarder » (Vinted) avec les
                notifications activées. La cote Cardmarket vient du guide des prix quotidien (« à
                partir de », toutes langues).
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </FitPage>
  );
}

function ProductRow({ p }: { p: MyProduct }) {
  const v = VERDICT[p.verdict];
  const gap = (price: number | null) =>
    price === null ? null : (
      <span className={cn('text-xs', price <= p.target ? 'text-success' : 'text-muted-foreground')}>
        {formatPercent(price / p.target - 1)} vs bon prix
      </span>
    );
  return (
    <li id={`p-${p.id}`} className="scroll-mt-24 rounded-xl border bg-popover/40 p-4">
      <div className="flex flex-wrap gap-4">
        <Thumb src={p.image} className="size-16 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={v.variant}>{v.label}</Badge>
            {p.category && <Badge variant="outline">{p.category.label}</Badge>}
          </div>
          <Link href={`/produits/${p.id}`} className="block font-semibold hover:underline">
            {p.name}
          </Link>
          <p className="text-xs text-muted-foreground">Recherche d’annonces : « {p.query} »</p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm xl:grid-cols-4">
        <Stat label="Ton bon prix">
          <span className="font-display text-lg font-bold text-primary">
            {formatPrice(p.target)}
          </span>
          <span className="text-xs text-muted-foreground">
            {p.msrp !== null
              ? `prix public ${formatPrice(p.msrp)} · ×${p.targetVsMsrp!.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`
              : 'prix public inconnu'}
          </span>
        </Stat>
        <Stat label="Meilleure boutique">
          <span className="font-display text-lg font-bold">{formatPrice(p.bestOffer)}</span>
          <span className="text-xs text-muted-foreground">
            {p.bestRetailer ? (
              <a
                href={p.bestUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {p.bestRetailer}
              </a>
            ) : (
              'pas en vente'
            )}
          </span>
          {gap(p.bestOffer)}
        </Stat>
        <Stat label="Cardmarket, à partir de">
          <span className="font-display text-lg font-bold">{formatPrice(p.cardmarketLow)}</span>
          <span className="text-xs text-muted-foreground">
            {p.market !== null ? `tendance ${formatPrice(p.market)}` : 'pas de cote'}
          </span>
          {gap(p.cardmarketLow)}
        </Stat>
        <Stat label="Annonces eBay">
          <span className="font-display text-lg font-bold">{p.listings}</span>
          <span className="text-xs text-muted-foreground">relevées récemment</span>
        </Stat>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {p.links.map((l) => (
          <Button key={l.key} asChild variant="secondary" size="sm">
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              {l.label} <ExternalLink />
            </a>
          </Button>
        ))}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Modifier le bon prix ou les mots-clés
        </summary>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <form action={saveMyProductAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="productId" value={p.id} />
            <div className="space-y-1.5">
              <Label htmlFor={`t-${p.id}`}>Bon prix (€)</Label>
              <Input
                id={`t-${p.id}`}
                name="targetPrice"
                inputMode="decimal"
                defaultValue={fmtInput(p.target)}
                className="w-28"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`q-${p.id}`}>Mots-clés</Label>
              <Input
                id={`q-${p.id}`}
                name="marketQuery"
                defaultValue={p.customQuery ?? ''}
                placeholder={p.query}
                className="w-64 max-w-full"
              />
            </div>
            <Button type="submit" size="sm">
              Enregistrer
            </Button>
          </form>
          <form action={removeMyProductAction.bind(null, p.id)}>
            <Button type="submit" size="sm" variant="ghost" className="text-destructive">
              <Trash2 /> Retirer
            </Button>
          </form>
        </div>
      </details>
    </li>
  );
}

function ListingRow({ l }: { l: MyListing }) {
  const under = !l.auction && l.total <= l.target;
  return (
    <li
      className={cn('flex gap-3 rounded-xl border bg-popover/40 p-3', under && 'border-success/50')}
    >
      <Thumb src={l.imageUrl} className="size-14 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <a
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-sm font-medium hover:underline"
        >
          {l.title}
        </a>
        <p className="truncate text-xs text-muted-foreground">
          {l.productName} · bon prix {formatPrice(l.target)}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="font-display text-base font-bold tabular-nums">
            {formatPrice(l.price)}
          </span>
          {l.auction ? (
            <Badge variant="info">Enchère</Badge>
          ) : l.localPickup ? (
            <Badge variant="info">Main propre</Badge>
          ) : (
            l.shipping !== null && (
              <span className="text-muted-foreground">+ {formatPrice(l.shipping)} port</span>
            )
          )}
          {under && <Badge variant="success">Sous le bon prix</Badge>}
          {l.location && (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              <MapPin className="size-3" /> {l.location}
            </span>
          )}
          <span className="text-muted-foreground">{ago(l.listedAt ?? l.firstSeenAt)}</span>
        </div>
      </div>
    </li>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted/40 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-0.5">{children}</dd>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('font-display text-2xl font-bold tabular-nums', valueClass)}>{value}</p>
      {hint && <p className="line-clamp-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
