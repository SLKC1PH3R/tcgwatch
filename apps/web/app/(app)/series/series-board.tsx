import { Search } from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatPrice } from '@tcgwatch/shared';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { SafeImg } from '@/components/safe-img';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getSeries, type SerieWithSets } from '@/lib/data/encyclopedia';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';

/** Vue de l'encyclopédie : par produit (onglet Produits de l'extension) ou par cartes. */
export type SeriesMode = 'produits' | 'cartes';

export async function SeriesBoard({ mode, serie: picked }: { mode: SeriesMode; serie?: string }) {
  const { main, side } = await getSeries();
  const all = [...main, ...side];
  const sets = all.reduce((n, s) => n + s.releases.length, 0);
  // Génération affichée : celle choisie dans le rail, sinon la plus récente.
  const current = all.find((s) => s.id === picked) ?? all[0];
  const base = mode === 'cartes' ? '/series/cartes' : '/series';
  const rail = (list: SerieWithSets[]) =>
    list.map((s) => {
      const on = s.id === current?.id;
      return (
        <Link
          key={s.id}
          href={`${base}?serie=${encodeURIComponent(s.id)}`}
          scroll={false}
          aria-current={on ? 'page' : undefined}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-accent lg:rounded-lg lg:border-transparent lg:py-2',
            on &&
              'border-foreground bg-foreground text-background hover:bg-foreground lg:bg-accent lg:text-foreground lg:hover:bg-accent',
          )}
        >
          <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
          <span className="hidden text-xs text-muted-foreground tabular-nums lg:inline">
            {s.releases.length}
          </span>
        </Link>
      );
    });

  return (
    <FitPage>
      <PageHeader
        title="Encyclopédie"
        description={
          mode === 'cartes'
            ? `${sets} extensions FR, de la plus récente à la plus ancienne : liste des cartes, raretés et valeur de chaque extension (somme des cotes Cardmarket du jour).`
            : `${main.length} générations et ${sets} extensions FR (TCGdex), de la plus récente à la plus ancienne : produits scellés de chaque extension.`
        }
      />

      {main.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Encyclopédie en cours d’import (TCGdex, en tâche de fond au démarrage du worker).
          </CardContent>
        </Card>
      ) : (
        <div className={cn(fitGrid, 'lg:grid-cols-[16rem_minmax(0,1fr)]')}>
          <Card className={cn(fitCard, 'px-3')}>
            <h2 className="px-2 font-display text-base font-semibold">Générations</h2>
            <nav
              aria-label="Générations"
              className={cn('flex flex-wrap gap-1.5 lg:block lg:space-y-0.5', fitScroll)}
            >
              {rail(main)}
              {side.length > 0 && (
                <>
                  <p className="w-full px-2 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Promos, kits et collections
                  </p>
                  {rail(side)}
                </>
              )}
            </nav>
          </Card>
          {current && <SerieCard serie={current} mode={mode} />}
        </div>
      )}
    </FitPage>
  );
}

function SerieCard({ serie, mode }: { serie: SerieWithSets; mode: SeriesMode }) {
  const dates = serie.releases.map((r) => r.releaseDate).filter((d): d is Date => !!d);
  const years = dates.length
    ? [
        Math.min(...dates.map((d) => d.getUTCFullYear())),
        Math.max(...dates.map((d) => d.getUTCFullYear())),
      ]
    : null;
  return (
    <Card id={`serie-${serie.id}`} className={fitCard}>
      <CardHeader className="items-center">
        <CardTitle className="flex items-center gap-3">
          {serie.logoUrl && (
            <SafeImg src={serie.logoUrl} alt="" className="h-8 max-w-28 object-contain" />
          )}
          {serie.name}
        </CardTitle>
        <span className="text-sm text-muted-foreground">
          {serie.releases.length} extension{serie.releases.length > 1 ? 's' : ''}
          {years && ` · ${years[0] === years[1] ? years[0] : `${years[0]}–${years[1]}`}`}
        </span>
        <div className="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto">
          <nav aria-label="Vue" className="flex rounded-full border bg-popover p-0.5">
            {(
              [
                ['produits', 'Par produit', '/series'],
                ['cartes', 'Par cartes', '/series/cartes'],
              ] as const
            ).map(([key, label, href]) => (
              <Link
                key={key}
                href={`${href}?serie=${encodeURIComponent(serie.id)}`}
                aria-current={mode === key ? 'page' : undefined}
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-semibold text-muted-foreground hover:text-foreground',
                  mode === key && 'bg-foreground text-background hover:text-background',
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <form action="/cartes" className="flex min-w-0 flex-1 gap-2 sm:flex-none">
            <Input
              name="q"
              placeholder="Un Pokémon : Dracaufeu, Évoli…"
              aria-label="Rechercher les cartes d’un Pokémon"
              className="h-8 min-w-0 flex-1 sm:w-56 sm:flex-none"
            />
            <Button type="submit" variant="outline" size="sm">
              <Search /> Cartes
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardContent className={fitScroll}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {serie.releases.map((r) => (
            <li key={r.id}>
              <Link
                href={`/extensions/${encodeURIComponent(r.tcgdexId!)}${mode === 'cartes' ? '?onglet=cartes' : ''}`}
                className="flex h-full flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors hover:bg-accent/50"
              >
                <span className="flex h-14 w-full items-center justify-center">
                  {r.imageUrl ? (
                    <SafeImg
                      src={r.imageUrl}
                      alt=""
                      className="max-h-14 max-w-full object-contain"
                    />
                  ) : r.symbolUrl ? (
                    <SafeImg src={r.symbolUrl} alt="" className="size-10 object-contain" />
                  ) : r.coverUrl ? (
                    <SafeImg
                      src={r.coverUrl}
                      alt=""
                      className="max-h-14 max-w-full rounded object-contain"
                    />
                  ) : serie.logoUrl ? (
                    <SafeImg
                      src={serie.logoUrl}
                      alt=""
                      className="max-h-10 max-w-full object-contain opacity-40 grayscale"
                    />
                  ) : null}
                </span>
                <span className="line-clamp-2 text-sm font-medium">{r.nameFr}</span>
                <span className="text-xs text-muted-foreground">
                  {[
                    r.setCode,
                    r.releaseDate ? formatDate(r.releaseDate) : null,
                    r.cardCountTotal ? `${r.cardCountTotal} cartes` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {mode === 'cartes' ? (
                  r.cardsValue ? (
                    <span className="text-xs text-primary">Valeur {formatPrice(r.cardsValue)}</span>
                  ) : null
                ) : (
                  r._count.extensionProducts > 0 && (
                    <span className="text-xs text-primary">
                      {r._count.extensionProducts} produit
                      {r._count.extensionProducts > 1 ? 's' : ''} scellé
                      {r._count.extensionProducts > 1 ? 's' : ''}
                    </span>
                  )
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
