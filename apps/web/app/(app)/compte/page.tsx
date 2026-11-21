import { Download, LogOut, Smartphone, Trash2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import { formatDateTime } from '@tcgwatch/shared';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth';
import { DeleteAccountForm, PasswordForm, ProfileForm } from './account-forms';
import { logoutEverywhereAction, removeDeviceAction } from './actions';

export const metadata: Metadata = { title: 'Mon compte' };

/** Profil, connexion, appareils, et droits RGPD (export, suppression). */
export default async function AccountPage() {
  const current = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: current.id },
    select: {
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      googleId: true,
      emailVerifiedAt: true,
      createdAt: true,
      pushDevices: { select: { id: true, userAgent: true, createdAt: true } },
      _count: { select: { sessions: true } },
    },
  });

  return (
    <>
      <PageHeader title="Mon compte" description={`Inscrit le ${formatDateTime(user.createdAt)}`} />
      <div className="mt-4 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Profil</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                {user.email}
                {user.emailVerifiedAt ? (
                  <Badge variant="success">Adresse confirmée</Badge>
                ) : (
                  <Badge variant="warning">À confirmer</Badge>
                )}
                {user.role === 'ADMIN' && <Badge variant="info">Administrateur</Badge>}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ProfileForm name={user.name} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Connexion</CardTitle>
              <CardDescription>
                {user.googleId ? 'Compte Google lié. ' : ''}
                {user.passwordHash ? 'Mot de passe défini.' : 'Pas encore de mot de passe.'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordForm hasPassword={Boolean(user.passwordHash)} />
            <form action={logoutEverywhereAction}>
              <Button type="submit" size="sm" variant="ghost">
                <LogOut /> Me déconnecter partout ({user._count.sessions} session
                {user._count.sessions > 1 ? 's' : ''})
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Appareils notifiés</CardTitle>
              <CardDescription>
                Navigateurs qui reçoivent tes alertes. Active-les depuis la page{' '}
                <Link href="/alertes" className="text-primary hover:underline">
                  Alertes
                </Link>
                .
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {user.pushDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun appareil pour l’instant.</p>
            ) : (
              <ul className="divide-y">
                {user.pushDevices.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                    <Smartphone className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{deviceName(d.userAgent)}</span>
                      <span className="text-xs text-muted-foreground">
                        depuis le {formatDateTime(d.createdAt)}
                      </span>
                    </span>
                    <form action={removeDeviceAction.bind(null, d.id)}>
                      <Button
                        type="submit"
                        size="icon"
                        variant="ghost"
                        aria-label="Retirer cet appareil"
                        className="size-8"
                      >
                        <Trash2 />
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Mes données</CardTitle>
              <CardDescription>
                Tes données t’appartiennent : récupère-les, ou supprime tout. Voir la{' '}
                <Link href="/confidentialite" className="text-primary hover:underline">
                  politique de confidentialité
                </Link>
                .
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href="/api/compte/export">
                  <Download /> Exporter tout (JSON)
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href="/api/collection/export">
                  <Download /> Collection (CSV)
                </a>
              </Button>
            </div>
            <div className="space-y-2 rounded-xl border border-destructive/40 p-4">
              <p className="text-sm font-semibold text-destructive">Supprimer mon compte</p>
              <p className="text-xs text-muted-foreground">
                Collection, cartes, classeurs, vitrines, suivis et alertes sont effacés
                immédiatement. C’est définitif.
              </p>
              <DeleteAccountForm email={user.email} />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** « Chrome sur Android », « Safari sur iPhone »… */
function deviceName(ua: string | null): string {
  if (!ua) return 'Navigateur';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Navigateur';
  const os = /iPhone|iPad/.test(ua)
    ? 'iPhone / iPad'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'Mac'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return os ? `${browser} sur ${os}` : browser;
}
