import { Check, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { formatPrice } from '@tcgwatch/shared';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { searchCards } from '@/lib/data/encyclopedia';
import { fitCard, fitGrid, fitScroll, fitSplit, fitSplit3 } from '@/lib/fit';
import { cn } from '@/lib/utils';

type Props = {
  searchParams: Promise<{ q?: string; serie?: string; rarete?: string; prix?: string; c?: string }>;
};

const PRICES = [
  { key: 'moins-10', label: '< 10 €', test: (p: number) => p < 10 },
  { key: '10-100', label: '10 – 100 €', test: (p: number) => p >= 10 && p <= 100 },
  { key: 'plus-100', label: '> 100 €', test: (p: number) => p > 100 },
] as const;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Cartes « ${q} »` : 'Cartes' };
}

/** Toutes les cartes d'un Pokémon, toutes générations confondues (encyclopédie locale). */
export default async function CardsSearchPage({ searchParams }: Props) {
  const { q = '', serie, rarete, prix, c: picked } = await searchParams;
  const { cards: found, total } = await searchCards(q);
  const price = PRICES.find((p) => p.key === prix);
  // Filtres de la colonne de gauche, appliqués aux résultats de la recherche.
  const series = countBy(
    found.map((c) => c.serie ?? 'Autres'),
    false,
  );
  const rarities = countBy(
    found.map((c) => c.rarity).filter((r): r is string => !!r),
    true,
  );
  const cards = found.filter(
    (c) =>
      (!serie || (c.serie ?? 'Autres') === serie) &&
      (!rarete || c.rarity === rarete) &&
      (!price || (c.price !== null && price.test(c.price))),
  );
  // Regroupement par série, de la plus récente à la plus ancienne (première carte vue).
  const bySerie = new Map<string, typeof cards>();
  for (const c of cards) {
    const serie = c.serie ?? 'Autres';
    bySerie.set(serie, [...(bySerie.get(serie) ?? []), c]);
  }
  const groups = [...bySerie.entries()].map(([serie, list]) => ({ serie, cards: list }));
  const preview = cards.find((c) => c.id === picked) ?? cards[0] ?? null;

  const params = { q, serie, rarete, prix, c: picked };
  const href = (change: Partial<typeof params>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...change })) if (v) sp.set(k, v);
    const qs = sp.toString();
    return qs ? `/cartes?${qs}` : '/cartes';
  };

  return (
    <FitPage>
      <PageHeader
        title={q ? `Cartes « ${q} »` : 'Cartes'}
        description={
          q
            ? `${total} carte${total > 1 ? 's' : ''} toutes générations confondues${
                total > found.length ? ` (${found.length} premières affichées)` : ''
              }.`
            : 'Recherchez toutes les cartes d’un Pokémon, de Wizards à aujourd’hui.'
        }
      />

      <div className={cn(fitGrid, preview ? fitSplit3 : fitSplit)}>
        <Card className={cn(fitCard, 'px-5')}>
          <form className="flex gap-2">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Dracaufeu, Évoli…"
              aria-label="Nom du Pokémon ou de la carte"
              className="min-w-0 flex-1"
            />
            <Button type="submit" size="icon" aria-label="Rechercher">
              <Search />
            </Button>
          </form>
          {found.length > 0 && (
            <div className={cn('space-y-4', fitScroll)}>
              <Filter label="Série">
                <Chip href={href({ serie: undefined, c: undefined })} on={!serie}>
                  Toutes
                </Chip>
                {series.map(([name, n]) => (
                  <Chip
                    key={name}
                    href={href({ serie: name === serie ? undefined : name, c: undefined })}
                    on={name === serie}
                  >
                    {name} · {n}
                  </Chip>
                ))}
              </Filter>
              {rarities.length > 0 && (
                <Filter label="Rareté">
                  {rarities.map(([name, n]) => (
                    <Chip
                      key={name}
                      href={href({ rarete: name === rarete ? undefined : name, c: undefined })}
                      on={name === rarete}
                    >
                      {name} · {n}
                    </Chip>
                  ))}
                </Filter>
              )}
              <Filter label="Cote">
                {PRICES.map((p) => (
                  <Chip
                    key={p.key}
                    href={href({ prix: p.key === prix ? undefined : p.key, c: undefined })}
                    on={p.key === prix}
                  >
                    {p.label}
                  </Chip>
                ))}
              </Filter>
            </div>
          )}
        </Card>

        <Card className={fitCard}>
          <h2 className="px-6 font-display text-base font-semibold">
            Résultats{' '}
            <span className="font-sans text-sm text-muted-foreground">
              · {cards.length} carte{cards.length > 1 ? 's' : ''}
            </span>
          </h2>
          <CardContent className={cn('space-y-6', fitScroll)}>
            {!q && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Tape le nom d’un Pokémon à gauche, ou{' '}
                <Link href="/series" className="text-primary hover:underline">
                  parcours l’encyclopédie
                </Link>
                .
              </p>
            )}
            {q && cards.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucune carte ne correspond.{' '}
                <Link href="/series" className="text-primary hover:underline">
                  Parcourir l’encyclopédie
                </Link>
              </p>
            )}
            {groups.map((g) => (
              <section key={g.serie} className="space-y-3">
                <h3 className="font-display text-sm font-semibold">
                  {g.serie}{' '}
                  <span className="font-sans font-normal text-muted-foreground">
                    {g.cards.length}
                  </span>
                </h3>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {g.cards.map((c) => (
                    <li key={c.id} className="relative">
                      {/* Sur grand écran, la carte s'affiche en aperçu à droite. */}
                      <Link
                        href={href({ c: c.id })}
                        scroll={false}
                        aria-label={`Aperçu : ${c.name}`}
                        className="absolute inset-0 z-10 hidden xl:block"
                      />
                      <Link href={`/cartes/${encodeURIComponent(c.id)}`} className="group block">
                        <div
                          className={cn(
                            'aspect-[63/88] overflow-hidden rounded-lg border bg-muted',
                            c.id === preview?.id && 'xl:ring-2 xl:ring-chart-2',
                          )}
                        >
                          {c.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              referrerPolicy="no-referrer"
                              src={c.image}
                              alt={c.name}
                              loading="lazy"
                              className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                            />
                          ) : (
                            <span className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                              Image indisponible
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm font-medium group-hover:underline">
                          {c.name}
                        </p>
                        <p className="flex justify-between gap-1 text-xs text-muted-foreground">
                          <span className="truncate">
                            {c.setName} · {c.localId}
                          </span>
                          {c.price !== null && (
                            <span className="shrink-0 font-semibold text-foreground tabular-nums">
                              {formatPrice(c.price)}
                            </span>
                          )}
                        </p>
                      </Link>
                      {c.tracked && (
                        <Badge variant="success" className="mt-1">
                          <Check /> Suivie
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </CardContent>
        </Card>

        {preview && (
          <Card className={cn(fitCard, 'holo-frame hidden px-5 xl:flex')}>
            <div className={cn('space-y-4', fitScroll)}>
              <div className="mx-auto aspect-[63/88] w-48 overflow-hidden rounded-xl border bg-muted">
                {preview.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    referrerPolicy="no-referrer"
                    src={preview.image.replace('/low.webp', '/high.webp')}
                    alt={preview.name}
                    className="size-full object-cover"
                  />
                )}
              </div>
              <div>
                <h2 className="font-display text-lg leading-tight font-semibold">{preview.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {[preview.rarity, `${preview.setName} · ${preview.localId}`, preview.serie]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="rounded-xl border bg-popover px-4 py-3">
                <p className="text-xs font-semibold text-muted-foreground">Cote du jour</p>
                <p className="font-display text-2xl font-bold text-primary tabular-nums">
                  {preview.price !== null ? formatPrice(preview.price) : '—'}
                </p>
                <p className="text-xs text-muted-foreground">tendance Cardmarket</p>
              </div>
              {preview.tracked && (
                <Badge variant="success">
                  <Check /> Suivie
                </Badge>
              )}
            </div>
            <Button asChild size="sm">
              <Link href={`/cartes/${encodeURIComponent(preview.id)}`}>
                Ouvrir la fiche (cotes, collection)
              </Link>
            </Button>
          </Card>
        )}
      </div>
    </FitPage>
  );
}

function countBy(keys: string[], byCount: boolean) {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  const entries = [...m.entries()];
  return byCount ? entries.sort((a, b) => b[1] - a[1]) : entries;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <nav aria-label={`Filtrer par ${label.toLowerCase()}`} className="flex flex-wrap gap-1.5">
        {children}
      </nav>
    </div>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? 'true' : undefined}
      className={cn(
        'flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold transition-colors hover:bg-accent',
        on && 'border-foreground bg-foreground text-background hover:bg-foreground',
      )}
    >
      {children}
    </Link>
  );
}
