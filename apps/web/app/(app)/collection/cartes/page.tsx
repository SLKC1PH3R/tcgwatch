import { BookOpen, Plus, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { formatPrice } from '@tcgwatch/shared';
import { CollectionCardTile } from '@/components/collection-card';
import { PageHeader } from '@/components/page-header';
import { SafeImg } from '@/components/safe-img';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getCardCollection } from '@/lib/data/card-collection';

export const metadata: Metadata = { title: 'Mes cartes' };

/** Vue d'ensemble des cartes : valeur, avancement par extension, derniers ajouts. */
export default async function MyCardsPage() {
  const { releases, latest, distinct, copies, value } = await getCardCollection();

  return (
    <>
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
            <Button asChild>
              <Link href="/collection/cartes/ajout-rapide">
                <Plus /> Ajout rapide
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Tile label="Valeur estimée" value={formatPrice(value)} hint="cote tendance Cardmarket" />
        <Tile label="Cartes différentes" value={distinct.toLocaleString('fr-FR')} />
        <Tile label="Exemplaires" value={copies.toLocaleString('fr-FR')} />
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
        <>
          <section className="mb-10 space-y-3">
            <h2 className="font-display text-xl font-bold">Par extension</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {releases.map((r) => {
                const pct = r.total ? Math.round((r.owned / r.total) * 100) : 0;
                return (
                  <li key={r.code}>
                    <Link
                      href={`/collection/cartes/ajout-rapide?extension=${encodeURIComponent(r.code)}`}
                      className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
                    >
                      <div className="flex items-center gap-3">
                        <SafeImg src={r.logo} alt="" className="h-9 w-20 shrink-0 object-contain" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{r.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.serie}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="flex justify-between text-xs text-muted-foreground tabular-nums">
                          <span>
                            {r.owned}/{r.total} cartes · {pct} %
                          </span>
                          <span>{formatPrice(r.value)}</span>
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold">Derniers ajouts</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {latest.map((c) => (
                <CollectionCardTile key={c.id} card={c} />
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
