import { Globe, Lock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { tcgdexAsset } from '@tcgwatch/market';
import { FitPage } from '@/components/fit-page';
import { FormError } from '@/components/form-message';
import { PageHeader } from '@/components/page-header';
import { SafeImg } from '@/components/safe-img';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getShowcases } from '@/lib/data/card-collection';
import { createShowcaseAction } from '../actions';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Vitrines' };

type Props = { searchParams: Promise<{ erreur?: string }> };

/** Vitrines : sélections de cartes à montrer, avec un lien public à partager. */
export default async function ShowcasesPage({ searchParams }: Props) {
  const { erreur } = await searchParams;
  const user = await requireUser();
  const showcases = await getShowcases(user.id);

  return (
    <FitPage>
      <PageHeader
        title="Vitrines"
        description="Compose une sélection de cartes (tes plus belles, tes dernières trouvailles…) et partage-la par un lien : la page publique ne montre que la vitrine, rien d’autre de ton TCGWatch."
      />
      <FormError message={erreur} />

      <div className={cn(fitGrid, 'lg:grid-cols-[20rem_minmax(0,1fr)]')}>
        <Card className="h-max">
          <CardHeader>
            <CardTitle>Nouvelle vitrine</CardTitle>
            <CardDescription>
              Le lien public s’active ensuite, quand la vitrine est prête.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createShowcaseAction} className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="s-title">Titre</Label>
                <Input
                  id="s-title"
                  name="title"
                  required
                  placeholder="Mes plus belles illustrations"
                />
              </div>
              <label className="flex w-full items-start gap-2 text-sm">
                <input type="checkbox" name="wanted" className="mt-1" />
                <span>
                  Liste de recherche
                  <span className="block text-xs text-muted-foreground">
                    Les cartes que tu cherches, à partager avec vendeurs et amis.
                  </span>
                </span>
              </label>
              <Button type="submit">Créer</Button>
            </form>
          </CardContent>
        </Card>

        <Card className={fitCard}>
          <CardHeader>
            <CardTitle>
              Mes vitrines{' '}
              <span className="font-sans text-sm text-muted-foreground">· {showcases.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className={fitScroll}>
            {showcases.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucune vitrine pour l’instant : crée la première à gauche.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {showcases.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/collection/cartes/vitrines/${s.id}`}
                      className="flex h-full flex-col gap-3 rounded-xl border bg-popover/40 p-4 transition-colors hover:bg-accent"
                    >
                      <div className="grid grid-cols-4 gap-1.5">
                        {Array.from({ length: 4 }, (_, i) => s.cards[i]).map((c, i) => (
                          <SafeImg
                            key={i}
                            src={
                              c
                                ? (tcgdexAsset(c.card.imageUrl ?? undefined, '/low.webp') ?? null)
                                : null
                            }
                            alt=""
                            className="aspect-[63/88] w-full rounded-md bg-muted object-cover"
                          />
                        ))}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{s.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {s._count.cards} carte{s._count.cards > 1 ? 's' : ''}
                          </p>
                        </div>
                        {s.wanted && <Badge variant="info">Je cherche</Badge>}
                        {s.public ? (
                          <Badge variant="success">
                            <Globe className="size-3" /> Publique
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Lock className="size-3" /> Privée
                          </Badge>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </FitPage>
  );
}
