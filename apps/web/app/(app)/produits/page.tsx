import { Search, TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AVAILABILITY_LABELS,
  formatPercent,
  formatPrice,
  matchScore,
  PRODUCT_TYPE_LABELS,
  queryWords,
  type ProductTypeKey,
} from '@tcgwatch/shared';
import { AvailabilityBadge } from '@/components/availability-badge';
import { FitPage } from '@/components/fit-page';
import { MiniLines } from '@/components/mini-lines';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { BEST_SERIES, getLowSinceBadges, getPriceHistory, MARKET_SERIES } from '@/lib/data/history';
import { getProducts, type ListingDTO, type ProductDTO } from '@/lib/data/products';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Produits suivis' };

type Dispo = 'tous' | 'stock' | 'precommande' | 'indisponible';
const DISPOS: { key: Dispo; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'stock', label: 'En stock' },
  { key: 'precommande', label: 'Précommande' },
  { key: 'indisponible', label: 'Indisponible' },
];

/** Disponibilité d'un produit : la meilleure de ses fiches actives. */
function productDispo(p: ProductDTO): Exclude<Dispo, 'tous'> {
  const active = p.listings.filter((l) => l.state !== 'PAUSED');
  if (active.some((l) => l.availability === 'IN_STOCK')) return 'stock';
  if (active.some((l) => l.availability === 'PREORDER')) return 'precommande';
  return 'indisponible';
}

type Props = {
  searchParams: Promise<{ q?: string; dispo?: string; site?: string; type?: string; p?: string }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const { q = '', dispo: rawDispo, site, type, p: picked } = await searchParams;
  const dispo = DISPOS.find((d) => d.key === rawDispo)?.key ?? 'tous';
  const all = await getProducts();

  const words = queryWords(q);
  // « Voir les fiches » d'un revendeur : produits suivis sur ce site.
  const onSite = site ? all.filter((p) => p.listings.some((l) => l.retailerSlug === site)) : all;
  const siteName = site
    ? (all.flatMap((p) => p.listings).find((l) => l.retailerSlug === site)?.retailerName ?? site)
    : null;
  const searched = words.length
    ? onSite.filter(
        (p) =>
          matchScore(
            [p.name, p.release?.nameFr, p.release?.setCode, p.ean, p.type].join(' '),
            words,
          ) > 0,
      )
    : onSite;
  const counts = { tous: searched.length, stock: 0, precommande: 0, indisponible: 0 };
  for (const p of searched) counts[productDispo(p)]++;
  const byDispo = dispo === 'tous' ? searched : searched.filter((p) => productDispo(p) === dispo);
  // Types et revendeurs présents dans la sélection, pour les filtres de la colonne de gauche.
  const typeCounts = countBy(byDispo.map((p) => p.type));
  const products = type ? byDispo.filter((p) => p.type === type) : byDispo;
  const siteCounts = countBy(
    searched.flatMap((p) => [...new Set(p.listings.map((l) => l.retailerSlug))]),
  );
  const siteNames = new Map(
    searched.flatMap((p) => p.listings.map((l) => [l.retailerSlug, l.retailerName])),
  );
  const lows = await getLowSinceBadges(
    products.map((p) => ({ id: p.id, best: p.best?.price ?? null })),
  );
  // Aperçu à droite (grand écran) : le produit choisi, sinon le premier de la liste.
  const preview = products.find((p) => p.id === picked) ?? products[0] ?? null;
  const history = preview ? await getPriceHistory(preview.id, 30) : null;

  const params = { q, site, dispo: dispo === 'tous' ? undefined : dispo, type, p: picked };
  const href = (change: Partial<typeof params>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...change })) if (v) s.set(k, v);
    const qs = s.toString();
    return qs ? `/produits?${qs}` : '/produits';
  };

  return (
    <FitPage>
      <PageHeader
        title="Produits suivis"
        description="Catalogue et fiches revendeurs mis à jour automatiquement. Les liens ouvrent la fiche du site : aucun achat automatique."
      />

      <div
        className={cn(
          fitGrid,
          'lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_22rem]',
        )}
      >
        {/* Filtres */}
        <Card className={cn(fitCard, 'px-5')}>
          <form className="space-y-1.5">
            <label
              htmlFor="q"
              className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Rechercher
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Nom, extension, EAN…"
                className="pl-9"
              />
              {dispo !== 'tous' && <input type="hidden" name="dispo" value={dispo} />}
              {site && <input type="hidden" name="site" value={site} />}
              {type && <input type="hidden" name="type" value={type} />}
            </div>
          </form>
          <div className={cn('space-y-4', fitScroll)}>
            <FilterGroup label="Disponibilité">
              {DISPOS.map((d) => (
                <FilterLink
                  key={d.key}
                  href={href({ dispo: d.key === 'tous' ? undefined : d.key, p: undefined })}
                  on={dispo === d.key}
                >
                  {d.label} · {counts[d.key]}
                </FilterLink>
              ))}
            </FilterGroup>
            {typeCounts.length > 1 && (
              <FilterGroup label="Type">
                <FilterLink href={href({ type: undefined, p: undefined })} on={!type}>
                  Tous
                </FilterLink>
                {typeCounts.map(([t, n]) => (
                  <FilterLink
                    key={t}
                    href={href({ type: t === type ? undefined : t, p: undefined })}
                    on={t === type}
                  >
                    {PRODUCT_TYPE_LABELS[t as ProductTypeKey] ?? t} · {n}
                  </FilterLink>
                ))}
              </FilterGroup>
            )}
            {siteCounts.length > 0 && (
              <FilterGroup label="Revendeur">
                {siteName && !siteCounts.some(([slug]) => slug === site) && (
                  <FilterLink href={href({ site: undefined, p: undefined })} on>
                    {siteName} ×
                  </FilterLink>
                )}
                {siteCounts.map(([slug, n]) => (
                  <FilterLink
                    key={slug}
                    href={href({ site: slug === site ? undefined : slug, p: undefined })}
                    on={slug === site}
                    title={slug === site ? 'Retirer le filtre' : undefined}
                  >
                    {siteNames.get(slug) ?? slug} · {n}
                    {slug === site && ' ×'}
                  </FilterLink>
                ))}
              </FilterGroup>
            )}
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <Legend className="bg-success" label="En stock" />
              <Legend className="bg-info" label="Précommande" />
              <Legend className="bg-muted-foreground" label="Indisponible" />
              <Legend className="border border-muted-foreground bg-transparent" label="En pause" />
            </p>
          </div>
        </Card>

        {/* Liste */}
        <Card className={cn(fitCard, 'pb-0')}>
          <h2 className="px-5 font-display text-base font-semibold">
            Produits suivis{' '}
            <span className="font-sans text-sm font-semibold text-muted-foreground">
              · {products.length}
            </span>
          </h2>
          {products.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {all.length === 0
                ? 'Catalogue en cours d’import (calendrier Pokécardex et rayons des boutiques).'
                : 'Aucun produit pour cette recherche.'}
            </p>
          ) : (
            <div className={cn('relative overflow-x-auto', fitScroll)}>
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-xs tracking-wide text-muted-foreground uppercase fit:sticky fit:top-0 fit:z-10 fit:bg-card">
                  <tr className="border-b">
                    <th className="px-5 py-2.5 text-left font-semibold">Produit</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Meilleur prix</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Disponibilité par site</th>
                    <th className="px-5 py-2.5 text-right font-semibold whitespace-nowrap">
                      Prix cible
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                    <ProductRow
                      key={p.id}
                      p={p}
                      low={lows.get(p.id)}
                      selected={p.id === preview?.id}
                      previewHref={href({ p: p.id })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Aperçu du produit choisi (grand écran) */}
        {preview && history && <Preview p={preview} history={history} />}
      </div>
    </FitPage>
  );
}

function countBy(keys: string[]) {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <nav aria-label={`Filtrer par ${label.toLowerCase()}`} className="flex flex-wrap gap-1.5">
        {children}
      </nav>
    </div>
  );
}

function FilterLink({
  href,
  on,
  title,
  children,
}: {
  href: string;
  on: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      title={title}
      aria-current={on ? 'true' : undefined}
      className={cn(
        'flex h-8 items-center rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-colors hover:bg-accent',
        on && 'border-foreground bg-foreground text-background hover:bg-foreground',
      )}
    >
      {children}
    </Link>
  );
}

function Preview({
  p,
  history,
}: {
  p: ProductDTO;
  history: Awaited<ReturnType<typeof getPriceHistory>>;
}) {
  const type = PRODUCT_TYPE_LABELS[p.type as ProductTypeKey] ?? p.type;
  const best = p.best;
  const price = best ? (best.delivered ?? best.price) : null;
  const gap = best && p.msrp ? best.price / p.msrp - 1 : null;
  const bestLine = history.data.map((d) => (d[BEST_SERIES] as number | undefined) ?? null);
  const marketLine = history.data.map((d) => (d[MARKET_SERIES] as number | undefined) ?? null);
  const listings = [...p.listings].sort(
    (a, b) => rank(a) - rank(b) || (a.price ?? Infinity) - (b.price ?? Infinity),
  );
  return (
    <Card className={cn(fitCard, 'holo-frame hidden px-5 xl:flex')}>
      <div className={cn('space-y-4', fitScroll)}>
        <Thumb src={p.displayImage} className="aspect-[2/1] h-auto w-full rounded-xl p-3" />
        <div>
          <p className="text-xs text-muted-foreground">
            {type}
            {p.release ? ` · ${p.release.nameFr}` : ''}
          </p>
          <h2 className="mt-1 font-display text-lg leading-tight font-semibold">{p.name}</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Meilleur prix" value={formatPrice(price)} note={best?.retailerName} />
          <Stat
            label="Marché"
            value={history.lastMarket !== null ? formatPrice(history.lastMarket) : '—'}
            note={history.lastMarketSource === 'cardmarket' ? 'Cardmarket' : 'cote du marché'}
            tone="text-primary"
          />
        </div>
        {(bestLine.some((v) => v !== null) || marketLine.some((v) => v !== null)) && (
          <div className="space-y-1.5">
            <p className="flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Prix · 30 j
              {gap !== null && (
                <span className={cn('normal-case', gap > 0.005 ? 'text-chart-5' : 'text-success')}>
                  {formatPercent(gap)} vs conseillé
                </span>
              )}
            </p>
            <MiniLines
              label="Meilleur prix et prix du marché sur 30 jours"
              height={80}
              series={[
                { values: marketLine, color: 'var(--primary)', dashed: true },
                { values: bestLine, color: 'var(--chart-2)' },
              ]}
            />
          </div>
        )}
        {listings.length > 0 && (
          <ul className="divide-y text-sm">
            {listings.slice(0, 6).map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-2">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate font-semibold hover:underline"
                >
                  {l.retailerName}
                </a>
                <AvailabilityBadge availability={l.availability} />
                <span className="ml-auto font-semibold tabular-nums">
                  {l.price !== null ? formatPrice(l.price) : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2 px-0">
        {best && (
          <a
            href={best.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: 'sm' })}
          >
            Acheter chez {best.retailerName} ↗
          </a>
        )}
        <Link
          href={`/produits/${p.id}`}
          className={buttonVariants({ size: 'sm', variant: 'outline' })}
        >
          Ouvrir la fiche
        </Link>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-popover px-3 py-2.5">
      <p className="truncate text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={cn('mt-1 truncate font-display text-lg font-semibold tabular-nums', tone)}>
        {value}
      </p>
      {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function ProductRow({
  p,
  low,
  selected,
  previewHref,
}: {
  p: ProductDTO;
  low?: { days: number; allTime: boolean };
  selected: boolean;
  previewHref: string;
}) {
  const type = PRODUCT_TYPE_LABELS[p.type as ProductTypeKey] ?? p.type;
  const price = p.best ? (p.best.delivered ?? p.best.price) : null;
  const gap = price !== null && p.msrp ? p.best!.price / p.msrp - 1 : null;
  const listings = [...p.listings].sort(
    (a, b) => rank(a) - rank(b) || a.retailerName.localeCompare(b.retailerName, 'fr'),
  );
  return (
    <tr
      className={cn(
        'align-middle',
        selected && 'xl:bg-chart-2/10 xl:shadow-[inset_3px_0_0_var(--chart-2)]',
      )}
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          {p.displayImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              referrerPolicy="no-referrer"
              src={p.displayImage}
              alt=""
              className="size-12 shrink-0 rounded-lg border bg-white object-contain"
              loading="lazy"
            />
          ) : (
            <div className="size-12 shrink-0 rounded-lg border bg-muted" />
          )}
          <div className="min-w-0">
            {/* Sur grand écran, le nom affiche l'aperçu à droite ; ailleurs, il ouvre la fiche. */}
            <Link
              href={`/produits/${p.id}`}
              className="line-clamp-2 font-semibold hover:underline xl:hidden"
            >
              {p.name}
            </Link>
            <Link
              href={previewHref}
              scroll={false}
              aria-current={selected ? 'true' : undefined}
              className="hidden font-semibold hover:underline xl:line-clamp-2"
            >
              {p.name}
            </Link>
            <p className="text-xs text-muted-foreground">
              {type}
              {p.msrp !== null ? ` · conseillé ${formatPrice(p.msrp)}` : ''}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap">
        {p.best ? (
          <a href={p.best.url} target="_blank" rel="noopener noreferrer" className="group block">
            <span className="font-display text-base font-bold tabular-nums group-hover:underline">
              {formatPrice(price)}
            </span>
            {gap !== null && (
              <span
                className={cn(
                  'block text-xs tabular-nums',
                  gap > 0.005 ? 'text-chart-5' : 'text-success',
                )}
              >
                {formatPercent(gap)} vs conseillé
              </span>
            )}
            {low && (
              <span className="block text-xs text-success">
                {low.allTime ? 'plus bas jamais vu' : `plus bas depuis ${low.days} j`}
              </span>
            )}
          </a>
        ) : (
          <>
            <span className="font-display text-base font-bold">—</span>
            <span className="block text-xs text-muted-foreground">Aucune offre</span>
          </>
        )}
      </td>
      <td className="px-3 py-3">
        {listings.length === 0 ? (
          <span className="text-xs text-muted-foreground">Aucune fiche suivie</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {listings.map((l) => (
              <li key={l.id}>
                <SitePill l={l} />
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-5 py-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">
        {p.targetPrice !== null ? formatPrice(p.targetPrice) : '—'}
      </td>
    </tr>
  );
}

/** Ordre des pastilles : achetable d'abord, puis indisponible, puis en pause. */
function rank(l: ListingDTO) {
  if (l.state === 'PAUSED') return 3;
  if (l.availability === 'IN_STOCK') return 0;
  if (l.availability === 'PREORDER') return 1;
  return 2;
}

function SitePill({ l }: { l: ListingDTO }) {
  const paused = l.state === 'PAUSED';
  const broken = l.state === 'ERROR' || l.state === 'BLOCKED_BY_ROBOTS';
  const tone = paused
    ? 'bg-transparent border text-muted-foreground'
    : l.availability === 'IN_STOCK'
      ? 'bg-success/15 text-success'
      : l.availability === 'PREORDER'
        ? 'bg-info/15 text-info'
        : 'bg-secondary text-muted-foreground';
  const dot = paused
    ? 'border border-muted-foreground bg-transparent'
    : l.availability === 'IN_STOCK'
      ? 'bg-success'
      : l.availability === 'PREORDER'
        ? 'bg-info'
        : 'bg-muted-foreground';
  const title = [
    paused ? 'En pause' : AVAILABILITY_LABELS[l.availability],
    l.price !== null ? formatPrice(l.price) : null,
    l.delivered !== null && l.delivered !== l.price ? `livré ${formatPrice(l.delivered)}` : null,
    broken ? (l.lastError ?? 'Relevé en erreur') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <a
      href={l.url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80',
        tone,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', dot)} />
      {l.retailerName}
      {broken && (
        <TriangleAlert className="size-3 text-destructive" aria-label="Relevé en erreur" />
      )}
      <span className="sr-only">{title}</span>
    </a>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn('size-1.5 rounded-full', className)} />
      {label}
    </span>
  );
}
