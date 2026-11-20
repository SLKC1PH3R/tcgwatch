import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import type { RetailerAccess, RetailerKind } from '@tcgwatch/adapters';
import { prisma } from '@tcgwatch/db';
import { formatPrice, toNumber } from '@tcgwatch/shared';
import { AvailabilityBadge } from '@/components/availability-badge';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fitCard, fitGrid, fitScroll, fitSplit3 } from '@/lib/fit';
import { EXCLUDED_SITES, getRetailers, type RetailerRow } from '@/lib/data/retailers';
import { cn } from '@/lib/utils';
import { resetRetailerShippingAction } from './actions';
import { ShippingForm } from './shipping-form';

export const metadata: Metadata = { title: 'Revendeurs' };

const KIND_ORDER: RetailerKind[] = ['SPECIALIST', 'CULTURE', 'TOYS', 'SUPERMARKET', 'OTHER'];
const ACCESS_ORDER: RetailerAccess[] = ['OK', 'BROWSER', 'LIMITED', 'UNTESTED'];
const KIND_TITLE: Record<RetailerKind, string> = {
  SPECIALIST: 'Spécialisées',
  CULTURE: 'Culturelles',
  TOYS: 'Jouets',
  SUPERMARKET: 'Grandes surfaces',
  OTHER: 'Autres sites',
};
const ACCESS_LABEL: Record<RetailerAccess, string> = {
  OK: 'Fiable',
  BROWSER: 'Via Chromium',
  LIMITED: 'Bloqué',
  UNTESTED: 'Non testé',
};

/** Statut de relevé : pastille et badge (Fiable, Via Chromium, Bloqué, Non testé). */
const ACCESS_STYLE: Record<RetailerAccess, { dot: string; badge: string }> = {
  OK: { dot: 'bg-success', badge: 'bg-success/15 text-success' },
  BROWSER: { dot: 'bg-info', badge: 'bg-info/15 text-info' },
  LIMITED: { dot: 'bg-chart-5', badge: 'bg-chart-5/15 text-chart-5' },
  UNTESTED: { dot: 'bg-muted-foreground', badge: 'bg-secondary text-muted-foreground' },
};

const ACCESS_HELP: Record<RetailerAccess, string> = {
  OK: 'Relevé HTTP simple vérifié sur une vraie fiche produit.',
  BROWSER: 'Site rendu en JavaScript ou protégé : relevé via Chromium, sans garantie.',
  LIMITED: 'Le site bloque les requêtes automatisées : suivez-le via ses liens et alertes.',
  UNTESTED: 'Adaptateur générique (JSON-LD / PrestaShop), non vérifié sur ce site.',
};

interface Props {
  searchParams: Promise<{
    q?: string;
    cat?: string;
    statut?: string;
    suivies?: string;
    port?: string;
    r?: string;
  }>;
}

export default async function RetailersPage({ searchParams }: Props) {
  const { q = '', cat, statut, suivies, port, r: picked } = await searchParams;
  const retailers = await getRetailers();
  const kind = KIND_ORDER.find((k) => k.toLowerCase() === cat);
  const access = ACCESS_ORDER.find((a) => a.toLowerCase() === statut);
  const followedOnly = suivies === '1';
  const needle = q.trim().toLocaleLowerCase('fr');
  const shown = retailers.filter(
    (r) =>
      (!kind || r.kind === kind) &&
      (!access || r.access === access) &&
      (!followedOnly || r.listings > 0) &&
      (port !== 'connu' || r.shippingCost !== null) &&
      (port !== 'inconnu' || r.shippingCost === null) &&
      (!needle || r.name.toLocaleLowerCase('fr').includes(needle) || r.domain.includes(needle)),
  );
  const byAccess = Object.fromEntries(
    ACCESS_ORDER.map((a) => [a, retailers.filter((r) => r.access === a).length]),
  ) as Record<RetailerAccess, number>;
  const selected = shown.find((r) => r.slug === picked) ?? shown[0] ?? null;
  const listings = selected?.id
    ? await prisma.listing.findMany({
        where: { retailerId: selected.id, state: 'ACTIVE' },
        orderBy: [{ lastInStockAt: { sort: 'desc', nulls: 'last' } }],
        take: 40,
        select: {
          id: true,
          lastPrice: true,
          lastAvailability: true,
          product: { select: { id: true, name: true, imageUrl: true } },
        },
      })
    : [];

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { q: q || undefined, cat, statut, suivies, port, r: picked, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/revendeurs?${qs}` : '/revendeurs';
  };
  const filterLink = (label: string, count: number, on: boolean, to: string) => (
    <Link
      key={label}
      href={to}
      scroll={false}
      aria-current={on ? 'true' : undefined}
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent',
        on && 'bg-accent font-semibold',
      )}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </Link>
  );

  return (
    <FitPage>
      <PageHeader
        title="Revendeurs"
        description={`${retailers.length} sites français vendant du Pokémon TCG, dont ${byAccess.OK} relevés de façon fiable. ${EXCLUDED_SITES.join(', ').replace(/, ([^,]*)$/, ' et $1')} sont volontairement exclus.`}
        actions={
          <Button asChild variant="outline">
            <Link href="/revendeurs/etat">État des relevés</Link>
          </Button>
        }
      />

      <div className={cn(fitGrid, fitSplit3)}>
        <Card className={fitCard}>
          <CardContent className={cn('space-y-5', fitScroll)}>
            <form action="/revendeurs" className="flex gap-2">
              {cat && <input type="hidden" name="cat" value={cat} />}
              {statut && <input type="hidden" name="statut" value={statut} />}
              {followedOnly && <input type="hidden" name="suivies" value="1" />}
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Chercher une boutique"
                aria-label="Chercher une boutique"
                className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm"
              />
            </form>
            <section className="space-y-1">
              <h2 className="px-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Catégorie
              </h2>
              {filterLink(
                'Toutes',
                retailers.length,
                !kind,
                href({ cat: undefined, r: undefined }),
              )}
              {KIND_ORDER.map((k) => {
                const n = retailers.filter((r) => r.kind === k).length;
                return n === 0
                  ? null
                  : filterLink(
                      KIND_TITLE[k],
                      n,
                      kind === k,
                      href({ cat: k.toLowerCase(), r: undefined }),
                    );
              })}
            </section>
            <section className="space-y-1">
              <h2 className="px-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Relevé des prix
              </h2>
              {filterLink(
                'Tous',
                retailers.length,
                !access,
                href({ statut: undefined, r: undefined }),
              )}
              {ACCESS_ORDER.map((a) => (
                <Link
                  key={a}
                  href={href({ statut: a.toLowerCase(), r: undefined })}
                  scroll={false}
                  title={ACCESS_HELP[a]}
                  aria-current={access === a ? 'true' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent',
                    access === a && 'bg-accent font-semibold',
                  )}
                >
                  <span aria-hidden className={cn('size-1.5 rounded-full', ACCESS_STYLE[a].dot)} />
                  <span className="flex-1 truncate">{ACCESS_LABEL[a]}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{byAccess[a]}</span>
                </Link>
              ))}
            </section>
            <section className="space-y-1">
              <h2 className="px-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Frais de port
              </h2>
              {filterLink('Tous', retailers.length, !port, href({ port: undefined, r: undefined }))}
              {filterLink(
                'Connus',
                retailers.filter((r) => r.shippingCost !== null).length,
                port === 'connu',
                href({ port: 'connu', r: undefined }),
              )}
              {filterLink(
                'À renseigner',
                retailers.filter((r) => r.shippingCost === null).length,
                port === 'inconnu',
                href({ port: 'inconnu', r: undefined }),
              )}
            </section>
            <Link
              href={href({ suivies: followedOnly ? undefined : '1', r: undefined })}
              scroll={false}
              aria-pressed={followedOnly}
              className="flex items-center gap-2 px-2.5 text-sm"
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-4 items-center justify-center rounded border text-[10px]',
                  followedOnly && 'border-primary bg-primary text-primary-foreground',
                )}
              >
                {followedOnly ? '✓' : ''}
              </span>
              Avec des fiches suivies
            </Link>
          </CardContent>
        </Card>

        <Card className={fitCard}>
          <CardHeader className="shrink-0">
            <CardTitle>
              Boutiques{' '}
              <span className="text-sm font-normal text-muted-foreground">· {shown.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className={cn('px-2', fitScroll)}>
            {shown.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Aucune boutique ne correspond à ces filtres.
              </p>
            ) : (
              <ul className="divide-y">
                {shown.map((r) => (
                  <RetailerRowItem
                    key={r.domain}
                    retailer={r}
                    active={r.slug === selected?.slug}
                    href={href({ r: r.slug })}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {selected && (
          <Card className={cn(fitCard, 'hidden xl:flex')}>
            <CardHeader className="shrink-0">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-bold"
                >
                  {initials(selected.name)}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <CardTitle className="truncate">{selected.name}</CardTitle>
                  <CardDescription className="truncate">
                    {KIND_TITLE[selected.kind]} · {selected.domain}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 fit:min-h-0 fit:flex-1">
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <AccessBadge access={selected.access} />
                {selected.pokescam && (
                  <a
                    href="https://pokescam.com/sites-fiables/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`PokéScam : ${selected.pokescam}`}
                    className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success hover:underline"
                  >
                    <ShieldCheck className="size-3" aria-hidden /> Vérifiée par PokéScam
                  </a>
                )}
                {!selected.enabled && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    Relevés désactivés
                  </span>
                )}
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">
                {selected.notes ?? ACCESS_HELP[selected.access]}
              </p>
              <div className="grid shrink-0 grid-cols-2 gap-2">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Fiches suivies</p>
                  <p className="font-display text-xl font-bold tabular-nums">{selected.listings}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Achetables</p>
                  <p className="font-display text-xl font-bold tabular-nums">{selected.buyable}</p>
                </div>
              </div>
              <section className="shrink-0 space-y-2 rounded-xl border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Frais de port
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    {selected.shippingManual ? 'saisis par toi' : 'annuaire'}
                  </span>
                </div>
                <p className="text-sm font-semibold">{shippingLabel(selected)}</p>
                {selected.id ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-primary">Modifier</summary>
                    <div className="mt-2 space-y-2">
                      <ShippingForm
                        key={selected.slug}
                        id={selected.id}
                        cost={selected.shippingCost}
                        freeFrom={selected.freeShippingFrom}
                      />
                      {selected.shippingManual && (
                        <form action={resetRetailerShippingAction.bind(null, selected.id)}>
                          <button
                            type="submit"
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            Revenir aux valeurs de l’annuaire
                          </button>
                        </form>
                      )}
                    </div>
                  </details>
                ) : null}
                <p className="text-[11px] text-muted-foreground">
                  Sert à comparer les prix livrés (colis standard, France métropolitaine).
                </p>
              </section>
              <h3 className="shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Fiches suivies
              </h3>
              {listings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune fiche suivie chez ce revendeur pour l’instant.
                </p>
              ) : (
                <ul className={cn('divide-y', fitScroll)}>
                  {listings.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/produits/${l.product.id}`}
                        className="flex items-center gap-3 py-2 text-sm hover:underline"
                      >
                        <Thumb src={l.product.imageUrl} className="size-9" />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 font-medium">{l.product.name}</span>
                          <AvailabilityBadge availability={l.lastAvailability} />
                        </span>
                        <span className="font-semibold tabular-nums">
                          {l.lastPrice ? formatPrice(toNumber(l.lastPrice)) : '—'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex shrink-0 flex-wrap gap-2">
                {selected.pokemonUrl && (
                  <Button asChild size="sm" className="rounded-full">
                    <a href={selected.pokemonUrl} target="_blank" rel="noopener noreferrer">
                      Rayon Pokémon
                    </a>
                  </Button>
                )}
                {selected.listings > 0 && (
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <Link href={`/produits?site=${encodeURIComponent(selected.slug)}`}>
                      Voir les fiches
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </FitPage>
  );
}

/** « Play-In » → « P », « BCD Jeux » → « BJ », « Le Coin des Barons » → « LC ». */
function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 1) return words[0]![0]!.toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function AccessBadge({ access }: { access: RetailerAccess }) {
  const style = ACCESS_STYLE[access];
  return (
    <span
      title={ACCESS_HELP[access]}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        style.badge,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', style.dot)} />
      {ACCESS_LABEL[access]}
    </span>
  );
}

function RetailerRowItem({
  retailer: r,
  active,
  href,
}: {
  retailer: RetailerRow;
  active: boolean;
  href: string;
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5',
        active && 'xl:bg-accent/60',
        !r.enabled && 'opacity-60',
      )}
    >
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold"
      >
        {initials(r.name)}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          scroll={false}
          aria-current={active ? 'true' : undefined}
          className="hidden truncate font-semibold hover:underline xl:block"
        >
          {r.name}
        </Link>
        <a
          href={r.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={r.notes ?? r.domain}
          className="block truncate font-semibold hover:underline xl:hidden"
        >
          {r.name}
        </a>
        <p className="truncate text-xs text-muted-foreground">
          {KIND_TITLE[r.kind]} ·{' '}
          {r.listings === 0
            ? 'aucune fiche suivie'
            : `${r.listings} fiche${r.listings > 1 ? 's' : ''} · ${r.buyable} achetable${r.buyable > 1 ? 's' : ''}`}
          {` · ${shippingLabel(r)}`}
          {r.pokescam && (
            <ShieldCheck
              className="ml-1 inline size-3 text-success"
              aria-label="Vérifiée par PokéScam"
            />
          )}
        </p>
      </div>
      <AccessBadge access={r.access} />
      {r.pokemonUrl && (
        <Button asChild size="sm" variant="outline" className="hidden rounded-full sm:inline-flex">
          <a href={r.pokemonUrl} target="_blank" rel="noopener noreferrer">
            Rayon Pokémon
          </a>
        </Button>
      )}
    </li>
  );
}

/** « port 1,90 € · offert dès 50 € », « port offert », « port inconnu »… */
function shippingLabel(r: Pick<RetailerRow, 'shippingCost' | 'freeShippingFrom'>): string {
  const free = r.freeShippingFrom !== null ? `offert dès ${formatPrice(r.freeShippingFrom)}` : null;
  if (r.shippingCost === 0) return 'port offert';
  if (r.shippingCost === null) return free ? `port ${free}, inconnu en dessous` : 'port inconnu';
  return [`port ${formatPrice(r.shippingCost)}`, free].filter(Boolean).join(' · ');
}
