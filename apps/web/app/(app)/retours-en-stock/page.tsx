import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AVAILABILITY_LABELS,
  formatPercent,
  formatPrice,
  isBuyable,
  PRODUCT_TYPE_LABELS,
  type ProductTypeKey,
} from '@tcgwatch/shared';
import { AvailabilityBadge } from '@/components/availability-badge';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getRestocks, type RestockKind, type RestockRow } from '@/lib/data/restocks';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Retours en stock' };

const PERIODS = [
  { key: '1', label: '24 h', days: 1 },
  { key: '7', label: '7 j', days: 7 },
  { key: '30', label: '30 j', days: 30 },
  { key: '90', label: '90 j', days: 90 },
] as const;
const KINDS: { key: RestockKind; label: string }[] = [
  { key: 'stock', label: 'Retours en stock' },
  { key: 'precommandes', label: 'Précommandes ouvertes' },
  { key: 'tout', label: 'Les deux' },
];

const dayKey = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const time = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  hour: '2-digit',
  minute: '2-digit',
});

type Props = {
  searchParams: Promise<{ periode?: string; type?: string; dispo?: string }>;
};

export default async function RestocksPage({ searchParams }: Props) {
  const q = await searchParams;
  const period = PERIODS.find((p) => p.key === q.periode) ?? PERIODS[1];
  const kind = KINDS.find((k) => k.key === q.type)?.key ?? 'stock';
  const available = q.dispo === '1';
  const rows = await getRestocks({ days: period.days, kind, available });

  const href = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    const all = {
      periode: period.key === '7' ? undefined : period.key,
      type: kind === 'stock' ? undefined : kind,
      dispo: available ? '1' : undefined,
      ...params,
    };
    for (const [k, v] of Object.entries(all)) if (v) s.set(k, v);
    const qs = s.toString();
    return qs ? `/retours-en-stock?${qs}` : '/retours-en-stock';
  };
  const chip = (label: string, to: string, active: boolean) => (
    <Link
      key={label}
      href={to}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent',
        active && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {label}
    </Link>
  );

  // Regroupement par jour (heure de Paris), du plus récent au plus ancien.
  const days = new Map<string, RestockRow[]>();
  for (const r of rows) {
    const k = dayKey.format(r.at);
    days.set(k, [...(days.get(k) ?? []), r]);
  }

  return (
    <>
      <PageHeader
        title="Retours en stock"
        description={`${rows.length} ${
          kind === 'precommandes' ? 'ouverture(s) de précommande' : 'retour(s) en stock'
        } relevé(s) sur ${period.label}, avec la disponibilité actuelle sur les autres sites suivis.`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <nav aria-label="Période" className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => chip(p.label, href({ periode: p.key }), p.key === period.key))}
        </nav>
        <nav aria-label="Événements" className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => chip(k.label, href({ type: k.key }), k.key === kind))}
        </nav>
        {chip(
          'Encore disponibles seulement',
          href({ dispo: available ? undefined : '1' }),
          available,
        )}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun {kind === 'precommandes' ? 'ouverture de précommande' : 'retour en stock'} relevé
            sur cette période{available ? ' parmi les fiches encore disponibles' : ''}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {[...days.entries()].map(([day, list]) => (
            <section key={day} className="space-y-3">
              <h2 className="font-display text-lg font-semibold first-letter:uppercase">
                {day}{' '}
                <span className="text-sm font-normal text-muted-foreground">{list.length}</span>
              </h2>
              <ul className="space-y-3">
                {list.map((r) => (
                  <RestockItem key={r.id} row={r} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

type PriceTier = 'best' | 'mid' | 'worst' | 'off';
/** Moins cher : vert ; plus cher : rouge ; entre les deux : orange ; non achetable : gris. */
const TIER_PILL: Record<PriceTier, string> = {
  best: 'border-success/60 bg-success/15 text-success font-semibold',
  mid: 'border-orange-400/50 bg-orange-400/10 text-orange-300',
  worst: 'border-destructive/50 bg-destructive/10 text-destructive',
  off: 'text-muted-foreground',
};
const TIER_BUTTON: Record<PriceTier, string> = {
  best: 'bg-success text-black hover:bg-success/90',
  mid: 'bg-orange-400 text-black hover:bg-orange-400/90',
  worst: 'bg-destructive text-white hover:bg-destructive/90',
  off: '',
};
const TIER_LABEL: Partial<Record<PriceTier, string>> = {
  best: ' · meilleur prix',
  worst: ' · le plus cher',
};

function RestockItem({ row: r }: { row: RestockRow }) {
  const l = r.listing;
  const stillBuyable = l ? isBuyable(l.availability) : false;
  const current = l?.delivered ?? l?.price ?? null;
  const buyable = r.others
    .filter((o) => isBuyable(o.availability))
    .sort((a, b) => (a.delivered ?? a.price ?? Infinity) - (b.delivered ?? b.price ?? Infinity));
  const rest = r.others.filter((o) => !isBuyable(o.availability));
  // Comparaison des offres achetables (fiche du retour en stock comprise) : la moins chère en
  // vert, la plus chère en rouge, les autres en orange.
  const offers = [
    ...(stillBuyable && current !== null ? [current] : []),
    ...buyable.map((o) => o.delivered ?? o.price).filter((v): v is number => v !== null),
  ];
  const min = offers.length ? Math.min(...offers) : null;
  const max = offers.length ? Math.max(...offers) : null;
  const tier = (price: number | null, available: boolean): PriceTier =>
    !available || price === null || min === null
      ? 'off'
      : price <= min
        ? 'best'
        : price >= max! && max! > min
          ? 'worst'
          : 'mid';

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-4">
        <Thumb src={r.product.image} className="size-16" />
        <div className="min-w-0 flex-1 basis-64 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{time.format(r.at)}</span>
            <Badge variant={r.type === 'BACK_IN_STOCK' ? 'success' : 'info'}>
              {r.type === 'BACK_IN_STOCK' ? 'Retour en stock' : 'Précommande ouverte'}
            </Badge>
            <span>{PRODUCT_TYPE_LABELS[r.product.type as ProductTypeKey] ?? r.product.type}</span>
          </div>
          <Link
            href={`/produits/${r.product.id}`}
            className="line-clamp-2 font-semibold hover:underline"
          >
            {r.product.name}
          </Link>
          <p className="text-sm">
            <span className="font-medium">{l?.retailerName ?? 'Fiche supprimée'}</span>
            {' · '}
            <span className="font-semibold tabular-nums">{formatPrice(r.price)}</span>
            {r.product.msrp && r.price ? (
              <span className="text-muted-foreground">
                {' '}
                ({formatPercent(r.price / r.product.msrp - 1)} vs prix public)
              </span>
            ) : null}
          </p>
          {l && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Aujourd’hui : <AvailabilityBadge availability={l.availability} />
              {current !== null && current !== r.price && (
                <span className="tabular-nums">
                  {formatPrice(current)}
                  {l.delivered !== null ? ' livré' : ''}
                </span>
              )}
            </p>
          )}
        </div>
        {l && (
          <Button
            asChild
            variant="secondary"
            className={cn('shrink-0', TIER_BUTTON[tier(current, stillBuyable)])}
          >
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              Acheter chez {l.retailerName} <ExternalLink />
            </a>
          </Button>
        )}
      </div>

      {r.others.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Ailleurs : {buyable.length} site{buyable.length > 1 ? 's' : ''} achetable
            {buyable.length > 1 ? 's' : ''} sur {r.others.length}
            {offers.length > 1 && (
              <span className="ml-2 inline-flex flex-wrap gap-x-2 font-normal">
                <span className="text-success">● moins cher</span>
                <span className="text-orange-300">● plus cher</span>
                <span className="text-destructive">● le plus cher</span>
              </span>
            )}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {[...buyable, ...rest].map((o) => (
              <li key={o.listingId}>
                <a
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${AVAILABILITY_LABELS[o.availability]}${
                    TIER_LABEL[tier(o.delivered ?? o.price, isBuyable(o.availability))] ?? ''
                  }`}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity hover:opacity-80',
                    TIER_PILL[tier(o.delivered ?? o.price, isBuyable(o.availability))],
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-1.5 rounded-full',
                      o.availability === 'IN_STOCK'
                        ? 'bg-success'
                        : o.availability === 'PREORDER'
                          ? 'bg-info'
                          : 'bg-muted-foreground/50',
                    )}
                  />
                  <span className="font-medium">{o.retailerName}</span>
                  <span className="tabular-nums">
                    {o.price !== null ? formatPrice(o.delivered ?? o.price) : '—'}
                  </span>
                  {tier(o.delivered ?? o.price, isBuyable(o.availability)) === 'best' && (
                    <span className="text-[10px] uppercase">moins cher</span>
                  )}
                  <span className="sr-only">{AVAILABILITY_LABELS[o.availability]}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
