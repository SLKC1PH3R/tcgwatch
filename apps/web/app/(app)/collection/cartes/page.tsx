import { BookOpen, Plus, ScanLine, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { after } from 'next/server';
import { formatPrice } from '@tcgwatch/shared';
import { CollectionCardTile } from '@/components/collection-card';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { SafeImg } from '@/components/safe-img';
import { PriceSourceToggle } from '@/components/price-source-toggle';
import { SetProgressBars } from '@/components/set-progress-bars';
import { PRICE_COOKIE, parsePriceSource } from '@/lib/price-source';
import { percent } from '@/lib/card-sets';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCardCollection } from '@/lib/data/card-collection';
import { getCardInvestment, getCardValueHistory } from '@/lib/data/card-investment';
import { CollectionChart } from '@/components/collection-chart';
import { refreshOwnedCardPrices } from '@/lib/data/extensions';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Mes cartes' };

/** Vue d'ensemble des cartes : valeur, avancement par extension, derniers ajouts. */
export default async function MyCardsPage() {
  const user = await requireUser();
  const [{ releases, latest, distinct, copies, value, fr }, jar, inv, history] = await Promise.all([
    getCardCollection(user.id),
    cookies(),
    getCardInvestment(user.id),
    getCardValueHistory(user.id),
  ]);
  const lotOf = new Map(inv.lots.flatMap((l) => l.releases.map((c) => [c, l] as const)));
  const priceSource = parsePriceSource(jar.get(PRICE_COOKIE)?.value);
  after(() => refreshOwnedCardPrices().then(() => undefined));

  return (
    <FitPage>
      <PageHeader
        title="Mes cartes"
        description="Ta collection de cartes : valeur à la cote Cardmarket du jour, avancement de chaque extension et derniers ajouts."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/collection/cartes/classeurs">
                <BookOpen /> Classeurs
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/collection/cartes/vitrines">Vitrines</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/collection/cartes/manquantes">Ce qu’il me manque</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/collection/cartes/achats">Achats</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/collection/cartes/scanner">
                <ScanLine /> Scanner
              </Link>
            </Button>
            <Button asChild>
              <Link href="/collection/cartes/ajout-rapide">
                <Plus /> Ajout rapide
              </Link>
            </Button>
          </>
        }
      />

      <div className="card-frame grid shrink-0 overflow-hidden rounded-[1.375rem] border bg-card sm:grid-cols-2 xl:grid-cols-4 [&>*]:border-border max-sm:[&>*+*]:border-t xl:[&>*+*]:border-l sm:[&>*:nth-child(even)]:border-l sm:[&>*:nth-child(n+3)]:border-t xl:[&>*:nth-child(n+3)]:border-t-0">
        <Tile
          label="Valeur estimée"
          value={formatPrice(value)}
          hint="cote tendance Cardmarket, toutes langues"
        />
        <Tile
          label="Valeur FR (eBay)"
          value={fr.copies ? formatPrice(fr.value) : '—'}
          hint={
            fr.copies
              ? `médiane des annonces en français · ${fr.copies}/${copies} exemplaires cotés`
              : 'prix français en cours de relevé (annonces eBay)'
          }
        />
        <Link
          href="/collection/cartes/achats"
          className="min-w-0 px-5 py-4 transition-colors hover:bg-accent/50"
        >
          <p className="label-mono text-muted-foreground">Investi</p>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">
            {inv.covered.paid > 0 ? formatPrice(inv.covered.paid) : '—'}
          </p>
          {inv.covered.paid > 0 ? (
            (() => {
              const now = priceSource === 'ebay' ? inv.covered.fr : inv.covered.cm;
              const gain = now - inv.covered.paid;
              return (
                <p className={cn('text-xs', gain >= 0 ? 'text-success' : 'text-destructive')}>
                  vaut {formatPrice(now)} · {gain >= 0 ? '+' : ''}
                  {formatPrice(gain)}
                </p>
              );
            })()
          ) : (
            <p className="text-xs text-muted-foreground">ajoute tes lots et achats à l’unité</p>
          )}
        </Link>
        <Tile
          label="Cartes différentes"
          value={distinct.toLocaleString('fr-FR')}
          hint={`${copies.toLocaleString('fr-FR')} exemplaire${copies > 1 ? 's' : ''}`}
        />
      </div>

      {releases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Sparkles className="size-8 text-primary" />
            <p className="max-w-md text-sm text-muted-foreground">
              Aucune carte pour l’instant. L’ajout rapide affiche toutes les cartes d’une extension
              : touche celles que tu as, c’est enregistré en une fois.
            </p>
            <Button asChild>
              <Link href="/collection/cartes/ajout-rapide">Commencer par une extension</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(fitGrid, 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')}>
          <Card className={fitCard}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle>
                Avancement par extension{' '}
                <span className="font-sans text-sm text-muted-foreground">· {releases.length}</span>
              </CardTitle>
              <PriceSourceToggle current={priceSource} className="shrink-0" />
            </CardHeader>
            <CardContent className={fitScroll}>
              <ul className="divide-y">
                {releases.map((r) => (
                  <li key={r.code}>
                    <Link
                      href={`/collection/cartes/ajout-rapide?extension=${encodeURIComponent(r.code)}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent"
                    >
                      <SafeImg src={r.logo} alt="" className="h-8 w-16 shrink-0 object-contain" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="flex justify-between gap-2 text-sm">
                          <span className="truncate font-semibold">{r.name}</span>
                          {!r.progress.master && (
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {r.progress.full.owned}/{r.progress.full.total} ·{' '}
                              {percent(r.progress.full)} %
                            </span>
                          )}
                        </p>
                        <SetProgressBars progress={r.progress} />
                        {lotOf.get(r.code) && (
                          <p className="truncate text-[11px] text-muted-foreground">
                            Lot « {lotOf.get(r.code)!.name} » ·{' '}
                            {formatPrice(lotOf.get(r.code)!.paid)}
                          </p>
                        )}
                        {r.progress.full.owned < r.progress.full.total && (
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            Il manque {r.progress.full.total - r.progress.full.owned} cartes · ≈{' '}
                            {formatPrice(priceSource === 'ebay' ? r.missing.fr : r.missing.cm)}{' '}
                            {priceSource === 'ebay' ? 'en FR' : 'Cardmarket'}
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          'w-20 shrink-0 text-right text-sm font-semibold tabular-nums',
                          priceSource === 'ebay' && 'text-info',
                        )}
                      >
                        {formatPrice(priceSource === 'ebay' ? r.frValue : r.value)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className={cn(fitColumn, 'gap-4')}>
            <Card className="shrink-0 gap-3 py-5">
              <CardHeader>
                <CardTitle>Valeur dans le temps</CardTitle>
                <CardDescription>
                  Cote {priceSource === 'ebay' ? 'eBay FR' : 'Cardmarket'} de chaque jour face à
                  l’investi (lots et achats à l’unité).
                </CardDescription>
              </CardHeader>
              <CardContent className="flex h-72 flex-col">
                <CollectionChart
                  history={history.map((p) => ({
                    day: p.day,
                    value: priceSource === 'ebay' ? p.fr : p.cm,
                    invested: p.invested,
                  }))}
                />
              </CardContent>
            </Card>
            <Card className={cn(fitCard, 'fit:flex-1')}>
              <CardHeader>
                <CardTitle>Derniers ajouts</CardTitle>
              </CardHeader>
              <CardContent className={fitScroll}>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 2xl:grid-cols-5">
                  {latest.map((c) => (
                    <CollectionCardTile key={c.id} card={c} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </FitPage>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="label-mono text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
