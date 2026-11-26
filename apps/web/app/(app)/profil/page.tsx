import { ExternalLink, Globe, Lock, MapPin, Heart } from 'lucide-react';
import type { Metadata } from 'next';
import { prisma } from '@tcgwatch/db';
import { getEnv } from '@tcgwatch/shared/env';
import { CopyButton } from '@/components/copy-button';
import { FitPage } from '@/components/fit-page';
import { FormError, FormSuccess } from '@/components/form-message';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requireUser } from '@/lib/auth';
import { getAvatarChoices, getProfileSettings } from '@/lib/data/profile';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { accentColor, PROFILE_ACCENTS } from '@/lib/profile-accents';
import { cn } from '@/lib/utils';
import { saveProfileAction } from './actions';

export const metadata: Metadata = { title: 'Mon profil' };

type Props = { searchParams: Promise<{ erreur?: string; enregistre?: string }> };

/** Profil de collectionneur : personnalisation et page publique. */
export default async function ProfilePage({ searchParams }: Props) {
  const { erreur, enregistre } = await searchParams;
  const user = await requireUser();
  const profile = await getProfileSettings(user.id);
  const [avatars, showcases] = await Promise.all([
    getAvatarChoices(user.id, profile.profileAvatarCardId),
    prisma.showcase.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, public: true, wanted: true },
    }),
  ]);
  const accent = accentColor(profile.profileAccent);
  const avatar = avatars.find((a) => a.id === profile.profileAvatarCardId) ?? null;
  const url = profile.profileSlug
    ? `${getEnv().APP_URL.replace(/\/$/, '')}/collectionneur/${profile.profileSlug}`
    : null;
  const live = profile.profilePublic && url;
  const check = (name: string, checked: boolean, label: string, hint?: string) => (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 size-4" />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );

  return (
    <FitPage>
      <PageHeader
        title="Mon profil"
        description="Personnalisez votre page de collectionneur : avatar, couleur, présentation, et ce que les visiteurs peuvent voir."
        actions={
          live ? (
            <Button asChild variant="outline">
              <a href={url} target="_blank" rel="noopener">
                <ExternalLink /> Voir ma page
              </a>
            </Button>
          ) : undefined
        }
      />
      <FormError message={erreur} />
      <FormSuccess message={enregistre ? 'Profil enregistré.' : undefined} />

      {/* Aperçu de l'en-tête de la page publique (valeurs enregistrées). */}
      <div
        className="flex shrink-0 items-center gap-4 rounded-2xl border p-4"
        style={{ background: `linear-gradient(120deg, ${accent}33, transparent 60%)` }}
      >
        <div
          className="size-16 shrink-0 overflow-hidden rounded-2xl border-2 bg-muted"
          style={{ borderColor: accent }}
        >
          {avatar?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar.image}
              alt=""
              referrerPolicy="no-referrer"
              className="size-full scale-150 object-cover object-[50%_30%]"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-bold">
            {profile.profileName || 'Collectionneur'}
          </p>
          <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            {profile.profileFavorite && (
              <span className="inline-flex items-center gap-1">
                <Heart className="size-3.5" /> {profile.profileFavorite}
              </span>
            )}
            {profile.profileLocation && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {profile.profileLocation}
              </span>
            )}
            {!profile.profileFavorite && !profile.profileLocation && (
              <span>{profile.profileBio ?? 'Ajoutez une présentation ci-dessous.'}</span>
            )}
          </p>
        </div>
        {live ? (
          <Badge variant="success">
            <Globe className="size-3" /> Publique
          </Badge>
        ) : (
          <Badge variant="secondary">
            <Lock className="size-3" /> Privée
          </Badge>
        )}
      </div>

      <form
        action={saveProfileAction}
        className={cn(fitGrid, 'lg:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr]')}
      >
        <Card className={fitCard}>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
            <CardDescription>Votre e-mail n’apparaît jamais sur la page.</CardDescription>
          </CardHeader>
          <CardContent className={cn('space-y-3', fitScroll)}>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-fav">Pokémon préféré</Label>
                <Input
                  id="p-fav"
                  name="profileFavorite"
                  defaultValue={profile.profileFavorite ?? ''}
                  maxLength={40}
                  placeholder="Dracaufeu"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-loc">Région</Label>
                <Input
                  id="p-loc"
                  name="profileLocation"
                  defaultValue={profile.profileLocation ?? ''}
                  maxLength={60}
                  placeholder="Île-de-France"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-contact">Contact pour les échanges</Label>
              <Input
                id="p-contact"
                name="profileContact"
                defaultValue={profile.profileContact ?? ''}
                maxLength={120}
                placeholder="Discord : sacha#0001, ou https://…"
              />
              <p className="text-xs text-muted-foreground">
                Visible par tous : un pseudo ou un lien, jamais votre adresse e-mail perso de
                préférence.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={fitCard}>
          <CardHeader>
            <CardTitle>Apparence</CardTitle>
            <CardDescription>Une couleur et une de vos cartes comme avatar.</CardDescription>
          </CardHeader>
          <CardContent className={cn('space-y-4', fitScroll)}>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Couleur</legend>
              <div className="flex flex-wrap gap-2">
                {PROFILE_ACCENTS.map((a) => (
                  <label key={a.key} title={a.label} className="cursor-pointer">
                    <input
                      type="radio"
                      name="profileAccent"
                      value={a.key}
                      defaultChecked={(profile.profileAccent ?? 'jaune') === a.key}
                      className="peer sr-only"
                    />
                    <span
                      className="block size-8 rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                      style={{ background: a.color }}
                    />
                    <span className="sr-only">{a.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Avatar</legend>
              {avatars.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ajoutez des cartes à votre collection pour en choisir une comme avatar.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-4 xl:grid-cols-6">
                  <label className="cursor-pointer" title="Pas d’avatar">
                    <input
                      type="radio"
                      name="profileAvatarCardId"
                      value=""
                      defaultChecked={!profile.profileAvatarCardId}
                      className="peer sr-only"
                    />
                    <span className="grid aspect-[63/88] place-items-center rounded-md border border-dashed text-xs text-muted-foreground peer-checked:ring-2 peer-checked:ring-primary">
                      Aucun
                    </span>
                  </label>
                  {avatars.map((a) => (
                    <label key={a.id} className="cursor-pointer" title={a.name}>
                      <input
                        type="radio"
                        name="profileAvatarCardId"
                        value={a.id}
                        defaultChecked={profile.profileAvatarCardId === a.id}
                        className="peer sr-only"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.image ?? undefined}
                        alt={a.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="aspect-[63/88] w-full rounded-md bg-muted object-cover opacity-70 transition peer-checked:opacity-100 peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:opacity-100"
                      />
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          </CardContent>
        </Card>

        <Card className={cn(fitCard, 'lg:col-span-2 xl:col-span-1')}>
          <CardHeader>
            <CardTitle>Page publique</CardTitle>
            <CardDescription>
              {live
                ? 'Visible par toute personne qui a le lien (non référencée par les moteurs de recherche).'
                : 'Désactivée : personne ne peut la voir.'}
            </CardDescription>
          </CardHeader>
          <CardContent className={cn('space-y-4', fitScroll)}>
            {check('profilePublic', profile.profilePublic, 'Page publique activée')}
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
              {live && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <code className="min-w-0 flex-1 truncate">{url}</code>
                  <CopyButton text={url} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-featured">Vitrine mise en avant</Label>
              <NativeSelect
                id="p-featured"
                name="profileFeaturedId"
                defaultValue={profile.profileFeaturedId ?? ''}
                className="w-full"
              >
                <option value="">Aucune</option>
                {showcases.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.public}>
                    {s.title}
                    {s.wanted ? ' (recherche)' : ''}
                    {s.public ? '' : ' — privée'}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                Affichée en grand en haut de votre page. Seules les vitrines publiques sont
                possibles.
              </p>
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Sections affichées</legend>
              {check(
                'profileBinders',
                profile.profileBinders,
                'Classeurs d’extension',
                'Avec leur avancement, consultables carte par carte',
              )}
              {check('profileShowcases', profile.profileShowcases, 'Vitrines publiques')}
              {check('profileWanted', profile.profileWanted, 'Listes de recherche publiques')}
              {check('profileDoubles', profile.profileDoubles, 'Doubles à l’échange')}
              {check('profilePrices', profile.profilePrices, 'Cote des cartes')}
            </fieldset>
            <Button type="submit" className="w-full">
              Enregistrer
            </Button>
          </CardContent>
        </Card>
      </form>
    </FitPage>
  );
}
