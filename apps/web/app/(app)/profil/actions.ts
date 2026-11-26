'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@tcgwatch/db';
import { requireUser } from '@/lib/auth';
import { firstIssue, formToObject } from '@/lib/form';
import { PROFILE_ACCENTS } from '@/lib/profile-accents';

const RESERVED_SLUGS = new Set(['admin', 'tcgwatch', 'moderation', 'support', 'contact']);
const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} : ${max} caractères au plus`).optional();

const profileSchema = z.object({
  profileSlug: z
    .string()
    .trim()
    .toLowerCase()
    .transform((s) =>
      s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[\s_]+/g, '-'),
    )
    .pipe(
      z
        .string()
        .regex(
          /^(|[a-z0-9][a-z0-9-]{1,28}[a-z0-9])$/,
          'Adresse : 3 à 30 caractères, lettres, chiffres et tirets',
        ),
    ),
  profileName: text(40, 'Pseudo'),
  profileBio: text(300, 'Présentation'),
  profileFavorite: text(40, 'Pokémon préféré'),
  profileLocation: text(60, 'Région'),
  profileContact: text(120, 'Contact').refine(
    (v) => !v || !/^[a-z][a-z0-9+.-]*:/i.test(v) || /^https:\/\//i.test(v),
    'Contact : un pseudo, ou un lien qui commence par https://',
  ),
  profileAccent: z
    .enum(PROFILE_ACCENTS.map((a) => a.key) as [string, ...string[]])
    .optional()
    .catch(undefined),
  profileAvatarCardId: z.string().optional(),
  profileFeaturedId: z.string().optional(),
});

/** Enregistre la page publique de collectionneur et sa personnalisation. */
export async function saveProfileAction(formData: FormData) {
  const user = await requireUser();
  const data = formToObject(formData);
  const parsed = profileSchema.safeParse(data);
  const back = (q: string): never => redirect(`/profil?${q}`);
  if (!parsed.success) back(`erreur=${encodeURIComponent(firstIssue(parsed.error))}`);
  const p = parsed.data!;
  const publish = data.profilePublic === 'on';
  if (publish && !p.profileSlug)
    back(`erreur=${encodeURIComponent('Choisissez une adresse pour votre page')}`);
  if (RESERVED_SLUGS.has(p.profileSlug)) {
    back(`erreur=${encodeURIComponent('Cette adresse est réservée')}`);
  }
  if (
    p.profileSlug &&
    (await prisma.user.count({ where: { profileSlug: p.profileSlug, id: { not: user.id } } })) > 0
  ) {
    back(`erreur=${encodeURIComponent('Cette adresse est déjà prise')}`);
  }
  // L'avatar doit être une carte possédée, la vitrine mise en avant une des siennes.
  const avatar =
    p.profileAvatarCardId &&
    (await prisma.ownedCard.count({
      where: { userId: user.id, cardId: p.profileAvatarCardId, quantity: { gt: 0 } },
    }))
      ? p.profileAvatarCardId
      : null;
  const featured =
    p.profileFeaturedId &&
    (await prisma.showcase.count({ where: { id: p.profileFeaturedId, userId: user.id } }))
      ? p.profileFeaturedId
      : null;
  const before = await prisma.user.findUnique({
    where: { id: user.id },
    select: { profileSlug: true },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: {
      profilePublic: publish,
      profileSlug: p.profileSlug || null,
      profileName: p.profileName || null,
      profileBio: p.profileBio || null,
      profileFavorite: p.profileFavorite || null,
      profileLocation: p.profileLocation || null,
      profileContact: p.profileContact || null,
      profileAccent: p.profileAccent ?? null,
      profileAvatarCardId: avatar,
      profileFeaturedId: featured,
      profileBinders: data.profileBinders === 'on',
      profileShowcases: data.profileShowcases === 'on',
      profileWanted: data.profileWanted === 'on',
      profileDoubles: data.profileDoubles === 'on',
      profilePrices: data.profilePrices === 'on',
    },
  });
  revalidatePath('/profil');
  for (const slug of [before?.profileSlug, p.profileSlug]) {
    if (slug) revalidatePath(`/collectionneur/${slug}`, 'layout');
  }
  back('enregistre=1');
}
