import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AVAILABILITY_LABELS, formatPrice, PRICE_CATEGORIES } from '@tcgwatch/shared';
import { FitPage } from '@/components/fit-page';
import { MiniLines } from '@/components/mini-lines';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { findDeals, MIN_DISCOUNT, type Deal } from '@/lib/data/deals';
import { BEST_SERIES, getPriceHistory, MARKET_SERIES } from '@/lib/data/history';
import { getSealedPrices } from '@/lib/data/prices';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Bons plans' };

const FILTERS = [
  { key: 'tous', label: 'Tous' },
  { key: 'cote', label: 'Sous la cote du marché' },
  { key: 'public', label: 'Sous le prix public' },
  { key: 'moins-30', label: 'Moins de 30 €' },
] as const;
const SORTS = [
  { key: 'remise', label: 'Plus grosse remise' },
  { key: 'prix-croissant', label: 'Prix croissant' },
  { key: 'prix-decroissant', label: 'Prix décroissant' },
  { key: 'recents', label: 'Plus récents' },
] as const;

type Props = { searchParams: Promise<{ filtre?: string; tri?: string; categorie?: string }> };

/**
 * Bons plans du moment : offres achetables chez les revendeurs suivis, moins chères que la cote
 * du marché du jour ou que le prix public conseillé. Aucune offre saisie à la main : tout vient
 * des relevés automatiques.
 */
export default async function DealsPage({ searchParams }: Props) {
  const q = await searchParams;
  const filter = FILTERS.find((f) => f.key === q.filtre)?.key ?? 'tous';
  const sort = SORTS.find((s) => s.key === q.tri)?.key ?? 'remise';
  const category = PRICE_CATEGORIES.find((c) => c.key === q.categorie);

  const deals = findDeals(await getSealedPrices());

  const shown = deals
    .filter((d) => !category || d.p.category?.key === category.key)
    .filter((d) =>
      filter === 'cote'
        ? (d.vsMarket ?? 0) >= MIN_DISCOUNT
        : filter === 'public'
          ? (d.vsMsrp ?? 0) >= MIN_DISCOUNT
          : filter === 'moins-30'
            ? d.offer < 30
            : true,
    )
    .sort((a, b) =>
      sort === 'prix-croissant'
        ? a.offer - b.offer
        : sort === 'prix-decroissant'
          ? b.offer - a.offer
          : sort === 'recents'
            ? (b.p.releaseDate?.getTime() ?? 0) - (a.p.releaseDate?.getTime() ?? 0)
            : b.discount - a.discount,
    );
  const hero = [...deals].sort((a, b) => b.discount - a.discount)[0];
  const cheapest = [...deals].sort((a, b) => a.offer - b.offer)[0];
  const categories = PRICE_CATEGORIES.filter((c) => deals.some((d) => d.p.category?.key === c.key));
  const heroHistory = hero ? await getPriceHistory(hero.p.id, 30) : null;

  const href = (params: { filtre?: string; tri?: string; categorie?: string }) => {
    const s = new URLSearchParams();
    const all = {
      filtre: filter === 'tous' ? undefined : filter,
      tri: sort === 'remise' ? undefined : sort,
      categorie: category?.key,
      ...params,
    };
    for (const [k, v] of Object.entries(all)) if (v && v !== 'tous' && v !== 'remise') s.set(k, v);
    const qs = s.toString();
    return qs ? `/produits/bons-plans?${qs}` : '/produits/bons-plans';
  };
  const chip = (label: string, to: string, active: boolean) => (
    <Link
      key={to + label}
      href={to}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-accent',
        active && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {label}
    </Link>
  );

  return (
    <FitPage>
      <PageHeader
        title="Bons plans du moment"
        description="Offres en stock ou en précommande chez les revendeurs suivis, moins chères que la cote du marché du jour ou que le prix public. Uniquement des boutiques de l’annuaire, prix relevés automatiquement."
      />

      <div className={cn(fitGrid, 'lg:grid-cols-[22rem_minmax(0,1fr)]')}>
        <div className={fitColumn}>
          {hero && (
            <Card className={cn(fitCard, 'holo-frame shrink-0 px-5')}>
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                Le bon plan du moment
              </p>
              <div className="flex items-center gap-3">
                <Thumb src={hero.p.image} className="size-16" />
                <Link
                  href={`/produits/${hero.p.id}`}
                  className="line-clamp-2 font-display font-semibold hover:underline"
                >
                  {hero.p.name}
                </Link>
              </div>
              <DealPrice d={hero} big />
              {heroHistory && (
                <MiniLines
                  label="Prix de l’offre et cote du marché sur 30 jours"
                  height={84}
                  series={[
                    {
                      values: heroHistory.data.map(
                        (d) => (d[MARKET_SERIES] as number | undefined) ?? null,
                      ),
                      color: 'var(--primary)',
                      dashed: true,
                    },
                    {
                      values: heroHistory.data.map(
                        (d) => (d[BEST_SERIES] as number | undefined) ?? null,
                      ),
                      color: 'var(--success)',
                    },
                  ]}
                />
              )}
              <Button asChild className="bg-success text-black hover:bg-success/90">
                <a href={hero.p.bestUrl!} target="_blank" rel="noopener noreferrer">
                  Voir l’offre chez {hero.p.bestRetailer} <ExternalLink />
                </a>
              </Button>
            </Card>
          )}
          <div className="grid shrink-0 grid-cols-3 gap-2">
            <Tile label="Bons plans en ligne" value={String(deals.length)} />
            <Tile
              label="Plus grosse remise"
              value={hero ? `−${Math.round(hero.discount * 100)} %` : '—'}
              hint={hero?.p.name}
            />
            <Tile
              label="Prix le plus bas"
              value={cheapest ? formatPrice(cheapest.offer) : '—'}
              hint={cheapest?.p.name}
            />
          </div>
        </div>

        <Card className={fitCard}>
          <CardHeader>
            <CardTitle>
              Toutes les offres{' '}
              <span className="font-sans text-sm text-muted-foreground">· {shown.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <nav aria-label="Filtres" className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => chip(f.label, href({ filtre: f.key }), f.key === filter))}
            </nav>
            <nav aria-label="Tri" className="flex flex-wrap gap-1.5">
              {SORTS.map((s) => chip(s.label, href({ tri: s.key }), s.key === sort))}
            </nav>
            <nav aria-label="Catégories" className="flex flex-wrap gap-1.5">
              {chip('Toutes catégories', href({ categorie: undefined }), !category)}
              {categories.map((c) =>
                chip(c.label, href({ categorie: c.key }), category?.key === c.key),
              )}
            </nav>
          </CardContent>
          <CardContent className={fitScroll}>
            {shown.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucun bon plan pour ces critères aujourd’hui.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((d) => (
                  <li
                    key={d.p.id}
                    className="flex flex-col gap-3 rounded-xl border bg-popover/40 p-4"
                  >
                    <div className="flex gap-3">
                      <Thumb src={d.p.image} className="size-14 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap gap-1.5">
                          {d.p.category && <Badge variant="secondary">{d.p.category.label}</Badge>}
                          {d.p.bestAvailability === 'PREORDER' && (
                            <Badge variant="info">{AVAILABILITY_LABELS.PREORDER}</Badge>
                          )}
                        </div>
                        <Link
                          href={`/produits/${d.p.id}`}
                          className="line-clamp-2 text-sm font-semibold hover:underline"
                        >
                          {d.p.name}
                        </Link>
                      </div>
                    </div>
                    <DealPrice d={d} />
                    <Button asChild variant="secondary" size="sm" className="mt-auto">
                      <a href={d.p.bestUrl!} target="_blank" rel="noopener noreferrer">
                        Voir chez {d.p.bestRetailer} <ExternalLink />
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Prix livré quand le port de la boutique est connu. Cote : tendance du guide des prix
              Cardmarket. Remise affichée : la plus forte des deux références (cote ou prix public),
              à partir de {Math.round(MIN_DISCOUNT * 100)} %.
            </p>
          </CardContent>
        </Card>
      </div>
    </FitPage>
  );
}

function DealPrice({ d, big }: { d: Deal; big?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={cn('font-display font-bold tabular-nums', big ? 'text-3xl' : 'text-xl')}>
        {formatPrice(d.offer)}
      </span>
      <Badge variant="success">−{Math.round(d.discount * 100)} %</Badge>
      {d.p.market !== null && (
        <span className="text-xs text-muted-foreground">
          cote{' '}
          <span className={cn((d.vsMarket ?? 0) >= MIN_DISCOUNT && 'line-through')}>
            {formatPrice(d.p.market)}
          </span>
        </span>
      )}
      {d.p.msrp !== null && (
        <span className="text-xs text-muted-foreground">
          prix public{' '}
          <span className={cn((d.vsMsrp ?? 0) >= MIN_DISCOUNT && 'line-through')}>
            {formatPrice(d.p.msrp)}
          </span>
        </span>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="line-clamp-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
