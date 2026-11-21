import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@tcgwatch/db';
import { getCurrentUser, isRegistrationOpen } from '@/lib/auth';
import { googleEnabled } from '@/lib/google-oauth';
import { LoginForm } from '../auth-forms';

const NOTICES: Record<string, string> = {
  google: 'La connexion Google n’a pas abouti : réessaie.',
  inscriptions: 'Les inscriptions sont fermées pour le moment.',
};

export const metadata: Metadata = { title: 'Connexion' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erreur?: string }>;
}) {
  if (await getCurrentUser()) redirect('/');
  // Aucun compte : on guide directement vers la création du compte propriétaire.
  if ((await prisma.user.count()) === 0) redirect('/inscription');
  const { next, erreur } = await searchParams;
  return (
    <LoginForm
      next={next}
      registrationOpen={await isRegistrationOpen()}
      google={googleEnabled()}
      notice={erreur ? NOTICES[erreur] : undefined}
    />
  );
}
