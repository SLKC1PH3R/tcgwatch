import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@tcgwatch/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser, isRegistrationOpen } from '@/lib/auth';
import { googleEnabled } from '@/lib/google-oauth';
import { RegisterForm } from '../auth-forms';

export const metadata: Metadata = { title: 'Inscription' };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/');
  if (!(await isRegistrationOpen())) {
    return (
      <Card>
        <CardHeader className="flex-col">
          <CardTitle>Inscriptions fermées</CardTitle>
          <CardDescription>
            Cette instance est privée. Pour ouvrir les inscriptions, définissez{' '}
            <code className="rounded bg-muted px-1">ALLOW_REGISTRATION=true</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/connexion" className="text-sm font-medium text-primary hover:underline">
            ← Retour à la connexion
          </Link>
        </CardContent>
      </Card>
    );
  }
  const firstUser = (await prisma.user.count()) === 0;
  return <RegisterForm firstUser={firstUser} google={googleEnabled()} />;
}
