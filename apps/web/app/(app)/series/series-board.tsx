import { Search } from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatPrice } from '@tcgwatch/shared';
import { PageHeader } from '@/components/page-header';
import { SafeImg } from '@/components/safe-img';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getSeries, type SerieWithSets } from '@/lib/data/encyclopedia';

/** Vue de l'encyclopédie : par produit (onglet Produits de l'extension) ou par cartes. */
export type SeriesMode = 'produits' | 'cartes';

export async function SeriesBoard({ mode }: { mode: SeriesMode }) {
  const { main, side } = await getSeries();
  const sets = [...main, ...side].reduce((n, s) => n + s.releases.length, 0);

  return (
    <>
      <PageHeader
        title="Encyclopédie"
        description={
          mode === 'cartes'
            ? `${sets} extensions FR, de la plus récente à la plus ancienne : liste des cartes, raretés et valeur de chaque extension (somme des cotes Cardmarket du jour).`
            : `${main.length} générations et ${sets} extensions FR (TCGdex), de la plus récente à la plus ancienne : produits scellés de chaque extension.`
        }
        actions={
          <form action="/cartes" className="flex gap-2">
            <Input
              name="q"
              placeholder="Un Pokémon : Dracaufeu, Évoli…"
              aria-label="Rechercher les cartes d’un Pokémon"
              className="w-56"
            />
            <Button type="submit" variant="outline">
              <Search /> Cartes
            </Button>
          </form>
        }
      />

      {main.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Encyclopédie en cours d’import (TCGdex, en tâche de fond au démarrage du worker).
          </CardContent>
        </Card>
      )}

      <nav aria-label="Générations" className="mb-6 flex flex-wrap gap-1.5">
        {[...main, ...side].map((s) => (
          <a
            key={s.id}
            href={`#serie-${s.id}`}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent"
          >
            {s.name}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        {main.map((s) => (
          <SerieCard key={s.id} serie={s} mode={mode} />
        ))}
        {side.length > 0 && (
          <>
            <h2 className="pt-4 font-display text-xl font-semibold">Promos, kits et collections</h2>
            {side.map((s) => (
              <SerieCard key={s.id} serie={s} mode={mode} />
            ))}
          </>
        )}
      </div>
    </>
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
    <Card id={`serie-${serie.id}`} className="scroll-mt-24">
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
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
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
