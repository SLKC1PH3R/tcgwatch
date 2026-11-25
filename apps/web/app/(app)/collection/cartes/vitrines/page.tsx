import { ExternalLink, Globe, Lock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { tcgdexAsset } from '@tcgwatch/market';
import { FitPage } from '@/components/fit-page';
import { FormError, FormSuccess } from '@/components/form-message';
import { PageHeader } from '@/components/page-header';
import { SafeImg } from '@/components/safe-img';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getShowcases } from '@/lib/data/card-collection';
import { getProfileSettings } from '@/lib/data/profile';
import { createShowcaseAction, saveProfileAction } from '../actions';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Vitrines' };

type Props = { searchParams: Promise<{ erreur?: string; profil?: string }> };

/** Vitrines : sélections de cartes à montrer, avec un lien public à partager. */
export default async function ShowcasesPage({ searchParams }: Props) {
  const { erreur, profil } = await searchParams;
  const user = await requireUser();
  const [showcases, profile] = await Promise.all([
    getShowcases(user.id),
    getProfileSettings(user.id),
  ]);

  return (
    <FitPage>
      <PageHeader
        title="Vitrines"
        description="Compose une sélection de cartes (tes plus belles, tes dernières trouvailles…) et partage-la par un lien : la page publique ne montre que la vitrine, rien d’autre de ton TCGWatch."
      />
      <FormError message={erreur} />
      <FormSuccess message={profil ? 'Page de collectionneur enregistrée.' : undefined} />

      <div className={cn(fitGrid, 'lg:grid-cols-[20rem_minmax(0,1fr)]')}>
        <div className={fitColumn}>
          <Card className="shrink-0">
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

          <Card className={cn(fitCard, 'shrink-0 fit:overflow-y-auto')}>
            <CardHeader>
              <CardTitle>Ma page de collectionneur</CardTitle>
              <CardDescription>
                Une page publique qui regroupe tes classeurs, tes vitrines publiques, tes listes de
                recherche et tes doubles à l’échange. Ni ton e-mail ni tes prix d’achat n’y
                figurent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveProfileAction} className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    name="profilePublic"
                    defaultChecked={profile.profilePublic}
                  />
                  Page publique activée
                </label>
                <div className="space-y-1.5">
                  <Label htmlFor="p-slug">Adresse</Label>
                  <div className="flex h-10 items-center rounded-md border bg-transparent text-sm focus-within:ring-2 focus-within:ring-ring">
                    <span className="pl-3 text-muted-foreground">/collectionneur/</span>
                    <input
                      id="p-slug"
                      name="profileSlug"
                      defaultValue={profile.profileSlug ?? ''}
                      placeholder="sacha-du-bourg"
                      maxLength={30}
                      className="h-full min-w-0 flex-1 bg-transparent pr-3 outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-name">Pseudo</Label>
                  <Input
                    id="p-name"
                    name="profileName"
                    defaultValue={profile.profileName ?? ''}
                    maxLength={40}
                    placeholder="Sacha"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-bio">Présentation</Label>
                  <Textarea
                    id="p-bio"
                    name="profileBio"
                    defaultValue={profile.profileBio ?? ''}
                    maxLength={300}
                    rows={3}
                    placeholder="Je complète les extensions EX, échanges bienvenus."
                  />
                </div>
                <fieldset className="space-y-1.5 text-sm">
                  <legend className="mb-1 font-medium">Afficher</legend>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="profileBinders"
                      defaultChecked={profile.profileBinders}
                    />
                    Mes classeurs d’extension et leur avancement
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="profileDoubles"
                      defaultChecked={profile.profileDoubles}
                    />
                    Mes doubles à l’échange
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="profilePrices"
                      defaultChecked={profile.profilePrices}
                    />
                    La cote des cartes
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Seules les vitrines et listes de recherche marquées « publiques » apparaissent.
                  </p>
                </fieldset>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit">Enregistrer</Button>
                  {profile.profilePublic && profile.profileSlug && (
                    <Button asChild variant="outline">
                      <a
                        href={`/collectionneur/${profile.profileSlug}`}
                        target="_blank"
                        rel="noopener"
                      >
                        <ExternalLink /> Voir ma page
                      </a>
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

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
