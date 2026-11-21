import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { consumeToken } from '@/lib/auth-tokens';

export const metadata: Metadata = { title: 'Confirmation de l’adresse' };

/** Lien reçu par e-mail : confirme l'adresse du compte. */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string }>;
}) {
  const { jeton } = await searchParams;
  const userId = jeton ? await consumeToken(jeton, 'VERIFY_EMAIL') : null;
  if (userId) {
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  }
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle className="text-2xl">
          {userId ? 'Adresse confirmée' : 'Lien expiré ou déjà utilisé'}
        </CardTitle>
        <CardDescription>
          {userId
            ? 'Merci ! Tes alertes peuvent maintenant t’être envoyées.'
            : 'Connecte-toi : un bandeau te permettra de recevoir un nouveau lien.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full">
          <Link href="/">Aller au tableau de bord</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
