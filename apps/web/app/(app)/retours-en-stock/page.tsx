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
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRestocks, type RestockKind, type RestockRow } from '@/lib/data/restocks';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
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
const shortDay = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  weekday: 'short',
});
const dayMonth = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: 'numeric',
  month: 'short',
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
        'inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-accent',
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

  // Résumé de la période : nombre d'événements, encore achetables, rythme et boutiques.
  const stillAvailable = rows.filter((r) => r.listing && isBuyable(r.listing.availability)).length;
  const bars = rhythm(rows, period.days);
  const maxBar = Math.max(1, ...bars.map((b) => b.count));
  const shops = [
    ...countBy(rows.map((r) => r.listing?.retailerName).filter((n): n is string => !!n)),
  ];
  const maxShop = Math.max(1, ...shops.map(([, n]) => n));
  const noun =
    kind === 'precommandes' ? 'Précommandes' : kind === 'tout' ? 'Événements' : 'Retours';

  return (
    <FitPage>
      <PageHeader
        title="Retours en stock"
        description={`${rows.length} ${
          kind === 'precommandes' ? 'ouverture(s) de précommande' : 'retour(s) en stock'
        } relevé(s) sur ${period.label}, avec la disponibilité actuelle sur les autres sites suivis.`}
      />

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
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

      <div className={cn(fitGrid, 'lg:grid-cols-[minmax(0,1fr)_24rem]')}>
        <Card className={fitCard}>
          <CardHeader>
            <CardTitle>
              Fil des {noun.toLowerCase()}{' '}
              <span className="font-sans text-sm text-muted-foreground">· {rows.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className={fitScroll}>
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucun {kind === 'precommandes' ? 'ouverture de précommande' : 'retour en stock'}{' '}
                relevé sur cette période{available ? ' parmi les fiches encore disponibles' : ''}.
              </p>
            ) : (
              <div className="space-y-6">
                {[...days.entries()].map(([day, list]) => (
                  <section key={day} className="space-y-3">
                    <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {day} · {list.length}
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
          </CardContent>
        </Card>

        <div className={fitColumn}>
          <Card className={cn(fitCard, 'shrink-0')}>
            <CardHeader>
              <CardTitle>Sur {period.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Stat label={noun} value={String(rows.length)} />
                <Stat
                  label="Encore disponibles"
                  value={String(stillAvailable)}
                  tone={stillAvailable ? 'text-success' : undefined}
                />
              </div>
              {rows.length > 0 && (
                <div
                  className="flex h-28 items-end gap-1.5"
                  role="img"
                  aria-label={`Répartition : ${bars.map((b) => `${b.label} ${b.count}`).join(', ')}`}
                >
                  {bars.map((b, i) => (
                    <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {b.count || ''}
                      </span>
                      <span
                        className={cn(
                          'w-full rounded-md',
                          i === bars.length - 1 ? 'bg-success' : 'bg-success/35',
                        )}
                        style={{ height: `${Math.max(2, (b.count / maxBar) * 64)}px` }}
                      />
                      <span className="truncate text-[10px] text-muted-foreground">{b.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className={cn(fitCard, 'fit:flex-1')}>
            <CardHeader>
              <CardTitle>Boutiques les plus actives</CardTitle>
            </CardHeader>
            <CardContent className={fitScroll}>
              {shops.length === 0 ? (
                <p className="text-sm text-muted-foreground">Rien sur cette période.</p>
              ) : (
                <ul className="space-y-2.5">
                  {shops.map(([name, n]) => (
                    <li key={name} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 truncate font-semibold">{name}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-success"
                          style={{ width: `${(n / maxShop) * 100}%` }}
                        />
                      </span>
                      <span className="w-6 text-right text-muted-foreground tabular-nums">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </FitPage>
  );
}

function countBy(keys: string[]) {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));
}

/**
 * Rythme des événements : une barre par jour jusqu'à deux semaines, une par semaine au-delà
 * (la dernière barre est la plus récente).
 */
function rhythm(rows: RestockRow[], days: number) {
  const DAY = 86_400_000;
  const now = Date.now();
  if (days <= 1) {
    // 24 h : par tranches de 3 heures.
    return Array.from({ length: 8 }, (_, i) => {
      const end = now - (7 - i) * 3 * 3_600_000;
      const start = end - 3 * 3_600_000;
      return {
        label: time.format(new Date(start)).slice(0, 2) + 'h',
        count: rows.filter((r) => +r.at > start && +r.at <= end).length,
      };
    });
  }
  const step = days <= 14 ? 1 : 7;
  const n = Math.ceil(days / step);
  const counts = new Map<string, number>();
  for (const r of rows) {
    const age = Math.floor((now - +r.at) / (DAY * step));
    const k = String(age);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from({ length: n }, (_, i) => {
    const age = n - 1 - i;
    const d = new Date(now - age * step * DAY);
    return {
      label: step === 1 ? shortDay.format(d).replace('.', '') : dayMonth.format(d).replace('.', ''),
      count: counts.get(String(age)) ?? 0,
    };
  });
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-popover px-3 py-2.5">
      <p className="truncate text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-display text-xl font-semibold tabular-nums', tone)}>{value}</p>
    </div>
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
    <li className="rounded-xl border bg-popover/40 p-4">
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
