import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import {
  formatDateTime,
  parseNotifyTestResult,
  parsePausedUntil,
  parseTelegramInvite,
  TELEGRAM_SETTINGS,
} from '@tcgwatch/shared';
import { Send } from 'lucide-react';
import { AutoRefresh } from '@/components/auto-refresh';
import { FormError } from '@/components/form-message';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ago } from '@/lib/alerts';
import { requireAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  requestNotifyTestAction,
  setGlobalTelegramPauseAction,
  setRoleAction,
  setTelegramInviteAction,
} from './actions';

export const metadata: Metadata = { title: 'Membres' };

/** Heure de la requête (pause en cours). */
const currentTime = () => new Date();

/** Durées de pause proposées (heures). */
const PAUSES = [
  { hours: 1, label: '1 h' },
  { hours: 8, label: '8 h' },
  { hours: 24, label: '24 h' },
  { hours: 24 * 7, label: '7 j' },
];

type Props = { searchParams: Promise<{ erreur?: string }> };

/** Membres (administrateurs) : rôles, et bot Telegram du groupe (pause, lien d'invitation). */
export default async function MembersPage({ searchParams }: Props) {
  const me = await requireAdmin();
  const { erreur } = await searchParams;
  const now = currentTime();
  const [users, settings] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: { select: { follows: true, alerts: true } },
      },
    }),
    prisma.appSetting.findMany({
      where: {
        key: {
          in: [
            TELEGRAM_SETTINGS.pausedUntil,
            TELEGRAM_SETTINGS.inviteUrl,
            TELEGRAM_SETTINGS.testRequestedAt,
            TELEGRAM_SETTINGS.testResult,
          ],
        },
      },
    }),
  ]);
  const setting = (key: string) => settings.find((s) => s.key === key)?.value ?? null;
  const pause = parsePausedUntil(setting(TELEGRAM_SETTINGS.pausedUntil));
  const paused = pause !== null && pause > now;
  const invite = parseTelegramInvite(setting(TELEGRAM_SETTINGS.inviteUrl));
  const testPending = setting(TELEGRAM_SETTINGS.testRequestedAt) !== null;
  const lastTest = parseNotifyTestResult(setting(TELEGRAM_SETTINGS.testResult));
  const mark = (ok: boolean) => (ok ? '✓' : '✗');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Membres"
        description="Les comptes du site et leurs rôles, et le bot Telegram du groupe."
        actions={
          <Button asChild variant="outline">
            <Link href="/sources/erreurs">Erreurs du worker</Link>
          </Button>
        }
      />
      <FormError message={erreur} />

      <Card className={cn(paused && 'border-warning/60')}>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Bot Telegram</CardTitle>
            <CardDescription>
              {paused
                ? `En pause jusqu’au ${formatDateTime(pause)} : rien n’est envoyé au groupe.`
                : 'Actif : les alertes partent dans le groupe Telegram.'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <form action={requestNotifyTestAction}>
              <Button type="submit" size="sm" disabled={testPending}>
                <Send /> {testPending ? 'Test en cours…' : 'Envoyer un test'}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {testPending ? (
                <>
                  Le worker l’envoie dans la minute (ntfy et groupe Telegram).
                  <AutoRefresh seconds={8} />
                </>
              ) : lastTest ? (
                <>
                  Dernier test {ago(new Date(lastTest.at))} :{' '}
                  <span className={lastTest.ntfy ? 'text-success' : 'text-destructive'}>
                    ntfy {mark(lastTest.ntfy)}
                  </span>{' '}
                  ·{' '}
                  <span
                    className={
                      lastTest.paused
                        ? 'text-warning'
                        : lastTest.telegram
                          ? 'text-success'
                          : 'text-destructive'
                    }
                  >
                    Telegram {lastTest.paused ? '(bot en pause)' : mark(lastTest.telegram)}
                  </span>
                </>
              ) : (
                'Même message que la commande notify-test du worker.'
              )}
            </p>
          </div>
          <form action={setGlobalTelegramPauseAction} className="flex flex-wrap gap-1.5">
            {PAUSES.map((p) => (
              <Button
                key={p.hours}
                type="submit"
                name="heures"
                value={p.hours}
                size="sm"
                variant="outline"
              >
                Pause {p.label}
              </Button>
            ))}
            {paused && (
              <Button type="submit" name="heures" value={0} size="sm">
                Reprendre
              </Button>
            )}
          </form>
          <form
            action={setTelegramInviteAction}
            className="flex flex-wrap items-center gap-2 border-t pt-4"
          >
            <label htmlFor="tg-invite" className="text-sm font-medium">
              Lien d’invitation du groupe
            </label>
            <Input
              id="tg-invite"
              name="lien"
              defaultValue={invite ?? ''}
              placeholder="https://t.me/+…"
              className="h-8 min-w-0 flex-1 sm:max-w-sm"
            />
            <Button type="submit" size="sm" variant="outline">
              Enregistrer
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Affiché aux membres dans la page Alertes (« Rejoindre le groupe »). Laissez vide pour
              le masquer.
            </p>
          </form>
        </CardContent>
      </Card>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="label-mono text-muted-foreground">
              <tr className="border-b">
                <th className="px-5 py-3 text-left font-medium">Compte</th>
                <th className="px-5 py-3 text-left font-medium">Rôle</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => {
                const admin = u.role === 'ADMIN';
                return (
                  <tr key={u.id} className="align-top">
                    <td className="px-5 py-3">
                      <p className="font-semibold">
                        {u.name ?? u.email}
                        {u.id === me.id && (
                          <span className="font-normal text-muted-foreground"> (vous)</span>
                        )}
                      </p>
                      {u.name && <p className="text-xs text-muted-foreground">{u.email}</p>}
                      <p className="text-xs text-muted-foreground">
                        inscrit le {u.createdAt.toLocaleDateString('fr-FR')} · {u._count.follows}{' '}
                        suivi{u._count.follows > 1 ? 's' : ''} · {u._count.alerts} alerte
                        {u._count.alerts > 1 ? 's' : ''}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant={admin ? 'default' : 'secondary'}>
                          {admin ? 'Administrateur' : 'Membre'}
                        </Badge>
                        <form action={setRoleAction.bind(null, u.id, !admin)}>
                          <button type="submit" className="text-xs text-primary hover:underline">
                            {admin ? 'Retirer l’accès admin' : 'Nommer administrateur'}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
