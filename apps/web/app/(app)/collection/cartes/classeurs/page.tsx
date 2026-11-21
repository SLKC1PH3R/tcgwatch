import { BookOpen } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FitPage } from '@/components/fit-page';
import { FormError } from '@/components/form-message';
import { PageHeader } from '@/components/page-header';
import { SafeImg } from '@/components/safe-img';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getBinders, getCardReleases } from '@/lib/data/card-collection';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';
import { createBinderAction } from '../actions';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Classeurs' };

type Props = { searchParams: Promise<{ erreur?: string }> };

/** Classeurs : un par extension (toutes ses cartes, manquantes grisées) ou personnels. */
export default async function BindersPage({ searchParams }: Props) {
  const { erreur } = await searchParams;
  const user = await requireUser();
  const [binders, releases] = await Promise.all([getBinders(user.id), getCardReleases()]);

  return (
    <FitPage>
      <PageHeader
        title="Classeurs"
        description="Range tes cartes comme dans un vrai classeur, 9 par page : un classeur par extension (les cartes manquantes apparaissent en gris) ou des classeurs personnels avec les cartes de ton choix."
      />
      <FormError message={erreur} />

      <div className={cn(fitGrid, 'lg:grid-cols-[20rem_minmax(0,1fr)]')}>
        <div className={cn(fitColumn, 'md:grid md:grid-cols-2 lg:flex')}>
          <Card className="shrink-0">
            <CardHeader>
              <CardTitle>Classeur d’une extension</CardTitle>
              <CardDescription>
                Toutes les cartes de l’extension, dans l’ordre des numéros.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createBinderAction} className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="b-release">Extension</Label>
                  <NativeSelect id="b-release" name="release" required defaultValue="">
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {releases.map((r) => (
                      <option key={r.id} value={r.tcgdexId!}>
                        {r.nameFr}
                        {r.serieRef ? ` · ${r.serieRef.name}` : ''}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <Button type="submit">Créer</Button>
              </form>
            </CardContent>
          </Card>
          <Card className="shrink-0">
            <CardHeader>
              <CardTitle>Classeur personnel</CardTitle>
              <CardDescription>
                Tes plus belles cartes, un Pokémon, un illustrateur…
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createBinderAction} className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="b-name">Nom</Label>
                  <Input id="b-name" name="name" required placeholder="Mes Dracaufeu" />
                </div>
                <Button type="submit">Créer</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className={fitCard}>
          <CardHeader>
            <CardTitle>
              Mes classeurs{' '}
              <span className="font-sans text-sm text-muted-foreground">· {binders.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className={fitScroll}>
            {binders.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucun classeur pour l’instant : crée le premier à gauche.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {binders.map((b) => {
                  const pct = b.total ? Math.round((b.owned / b.total) * 100) : 0;
                  return (
                    <li key={b.id}>
                      <Link
                        href={`/collection/cartes/classeurs/${b.id}`}
                        className="flex h-full flex-col gap-3 rounded-xl border bg-popover/40 p-4 transition-colors hover:bg-accent"
                      >
                        <div className="flex items-center gap-3">
                          {b.release?.imageUrl ? (
                            <SafeImg
                              src={b.release.imageUrl}
                              alt=""
                              className="h-9 w-20 object-contain"
                            />
                          ) : (
                            <BookOpen className="size-8 text-primary" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{b.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {b.release ? 'Classeur d’extension' : 'Classeur personnel'}
                              {b.description ? ` · ${b.description}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {b.owned}/{b.total} cartes possédées
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </FitPage>
  );
}
