import { Check, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { formatPrice } from '@tcgwatch/shared';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { searchCards } from '@/lib/data/encyclopedia';

type Props = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Cartes « ${q} »` : 'Cartes' };
}

/** Toutes les cartes d'un Pokémon, toutes générations confondues (encyclopédie locale). */
export default async function CardsSearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams;
  const { cards, total } = await searchCards(q);
  // Regroupement par série, de la plus récente à la plus ancienne (première carte vue).
  const bySerie = new Map<string, typeof cards>();
  for (const c of cards) {
    const serie = c.serie ?? 'Autres';
    bySerie.set(serie, [...(bySerie.get(serie) ?? []), c]);
  }
  const groups = [...bySerie.entries()].map(([serie, list]) => ({ serie, cards: list }));

  return (
    <>
      <PageHeader
        title={q ? `Cartes « ${q} »` : 'Cartes'}
        description={
          q
            ? `${total} carte${total > 1 ? 's' : ''} toutes générations confondues${
                total > cards.length ? ` (${cards.length} premières affichées)` : ''
              }.`
            : 'Recherchez toutes les cartes d’un Pokémon, de Wizards à aujourd’hui.'
        }
        actions={
          <form className="flex gap-2">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Dracaufeu, Évoli…"
              aria-label="Nom du Pokémon ou de la carte"
              className="w-56"
            />
            <Button type="submit">
              <Search /> Rechercher
            </Button>
          </form>
        }
      />

      {q && cards.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune carte ne correspond.{' '}
            <Link href="/series" className="text-primary hover:underline">
              Parcourir l’encyclopédie
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.serie} className="space-y-3">
            <h2 className="font-display text-lg font-semibold">
              {g.serie}{' '}
              <span className="text-sm font-normal text-muted-foreground">{g.cards.length}</span>
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {g.cards.map((c) => (
                <li key={c.id}>
                  <Link href={`/cartes/${encodeURIComponent(c.id)}`} className="group block">
                    <div className="aspect-[63/88] overflow-hidden rounded-lg border bg-muted">
                      {c.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
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
      </div>
    </>
  );
}
