import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@tcgwatch/db';
import { getCurrentUser, isRegistrationOpen } from '@/lib/auth';
import { LoginForm } from '../auth-forms';

export const metadata: Metadata = { title: 'Connexion' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect('/');
  // Aucun compte : on guide directement vers la création du compte propriétaire.
  if ((await prisma.user.count()) === 0) redirect('/inscription');
  const { next } = await searchParams;
  return <LoginForm next={next} registrationOpen={await isRegistrationOpen()} />;
}
