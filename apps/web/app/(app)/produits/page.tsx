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
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getLowSinceBadges } from '@/lib/data/history';
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

type Props = { searchParams: Promise<{ q?: string; dispo?: string; site?: string }> };

export default async function ProductsPage({ searchParams }: Props) {
  const { q = '', dispo: rawDispo, site } = await searchParams;
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
  const products = dispo === 'tous' ? searched : searched.filter((p) => productDispo(p) === dispo);
  const lows = await getLowSinceBadges(
    products.map((p) => ({ id: p.id, best: p.best?.price ?? null })),
  );
  const href = (d: Dispo) => {
    const s = new URLSearchParams();
    if (q) s.set('q', q);
    if (site) s.set('site', site);
    if (d !== 'tous') s.set('dispo', d);
    const qs = s.toString();
    return qs ? `/produits?${qs}` : '/produits';
  };

  return (
    <>
      <PageHeader
        title="Produits suivis"
        description="Catalogue et fiches revendeurs mis à jour automatiquement. Les liens ouvrent la fiche du site : aucun achat automatique."
      />

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <form className="min-w-0 flex-1 basis-72 space-y-1.5">
          <label htmlFor="q" className="text-sm text-muted-foreground">
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
          </div>
        </form>
        {siteName && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Revendeur</p>
            <Link
              href={`/produits${q || dispo !== 'tous' ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(dispo !== 'tous' ? { dispo } : {}) })}` : ''}`}
              className="flex h-9 items-center gap-2 rounded-lg border border-primary px-3 text-sm font-semibold text-primary hover:bg-primary/10"
              title="Retirer le filtre"
            >
              {siteName} ×
            </Link>
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">Disponibilité</p>
          <nav aria-label="Filtrer par disponibilité" className="flex flex-wrap gap-1.5">
            {DISPOS.map((d) => (
              <Link
                key={d.key}
                href={href(d.key)}
                aria-current={dispo === d.key ? 'true' : undefined}
                className={cn(
                  'flex h-9 items-center rounded-lg border px-3 text-sm font-semibold transition-colors hover:bg-accent',
                  dispo === d.key &&
                    'border-foreground bg-foreground text-background hover:bg-foreground',
                )}
              >
                {d.label} · {counts[d.key]}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <Card className="overflow-hidden py-0">
        {products.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {all.length === 0
              ? 'Catalogue en cours d’import (calendrier Pokécardex et rayons des boutiques).'
              : 'Aucun produit pour cette recherche.'}
          </p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                <tr className="border-b">
                  <th className="px-5 py-3 text-left font-semibold">Produit</th>
                  <th className="px-3 py-3 text-right font-semibold">Meilleur prix</th>
                  <th className="px-3 py-3 text-left font-semibold">Disponibilité par site</th>
                  <th className="px-5 py-3 text-right font-semibold whitespace-nowrap">
                    Prix cible
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <ProductRow key={p.id} p={p} low={lows.get(p.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <Legend className="bg-success" label="En stock" />
        <Legend className="bg-info" label="Précommande" />
        <Legend className="bg-muted-foreground" label="Indisponible" />
        <Legend className="border border-muted-foreground bg-transparent" label="En pause" />
      </p>
    </>
  );
}

function ProductRow({ p, low }: { p: ProductDTO; low?: { days: number; allTime: boolean } }) {
  const type = PRODUCT_TYPE_LABELS[p.type as ProductTypeKey] ?? p.type;
  const price = p.best ? (p.best.delivered ?? p.best.price) : null;
  const gap = price !== null && p.msrp ? p.best!.price / p.msrp - 1 : null;
  const listings = [...p.listings].sort(
    (a, b) => rank(a) - rank(b) || a.retailerName.localeCompare(b.retailerName, 'fr'),
  );
  return (
    <tr className="align-middle">
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
            <Link href={`/produits/${p.id}`} className="line-clamp-2 font-semibold hover:underline">
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
