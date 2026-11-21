import { BookOpen, Plus, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { after } from 'next/server';
import { formatPrice } from '@tcgwatch/shared';
import { CollectionCardTile } from '@/components/collection-card';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { SafeImg } from '@/components/safe-img';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCardCollection } from '@/lib/data/card-collection';
import { refreshOwnedCardPrices } from '@/lib/data/extensions';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Mes cartes' };

/** Vue d'ensemble des cartes : valeur, avancement par extension, derniers ajouts. */
export default async function MyCardsPage() {
  const user = await requireUser();
  const { releases, latest, distinct, copies, value } = await getCardCollection(user.id);
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
            <Button asChild>
              <Link href="/collection/cartes/ajout-rapide">
                <Plus /> Ajout rapide
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid shrink-0 gap-3 sm:grid-cols-3">
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
        <div className={cn(fitGrid, 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')}>
          <Card className={fitCard}>
            <CardHeader>
              <CardTitle>
                Avancement par extension{' '}
                <span className="font-sans text-sm text-muted-foreground">· {releases.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className={fitScroll}>
              <ul className="divide-y">
                {releases.map((r) => {
                  const pct = r.total ? Math.round((r.owned / r.total) * 100) : 0;
                  return (
                    <li key={r.code}>
                      <Link
                        href={`/collection/cartes/ajout-rapide?extension=${encodeURIComponent(r.code)}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent"
                      >
                        <SafeImg src={r.logo} alt="" className="h-8 w-16 shrink-0 object-contain" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="flex justify-between gap-2 text-sm">
                            <span className="truncate font-semibold">{r.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {r.owned}/{r.total} · {pct} %
                            </span>
                          </p>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                          {formatPrice(r.value)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card className={fitCard}>
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
      )}
    </FitPage>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
