import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import {
  formatDateTime,
  parsePausedUntil,
  parseTelegramMode,
  TELEGRAM_ADMIN_MODES,
  TELEGRAM_SETTINGS,
  type TelegramAdminMode,
} from '@tcgwatch/shared';
import { FormError } from '@/components/form-message';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  pauseTelegramAction,
  setGlobalTelegramPauseAction,
  setRoleAction,
  setTelegramModeAction,
} from './actions';

export const metadata: Metadata = { title: 'Membres' };

/** Heure de la requête (pauses en cours). */
const currentTime = () => new Date();

/** Durées de pause proposées (heures). */
const PAUSES = [
  { hours: 1, label: '1 h' },
  { hours: 8, label: '8 h' },
  { hours: 24, label: '24 h' },
  { hours: 24 * 7, label: '7 j' },
];

type Props = { searchParams: Promise<{ erreur?: string }> };

/**
 * Membres (administrateurs) : rôles, et Telegram de chaque compte (actif, sans son, coupé,
 * pause), plus une pause de Telegram pour tout le monde.
 */
export default async function MembersPage({ searchParams }: Props) {
  const me = await requireAdmin();
  const { erreur } = await searchParams;
  const now = currentTime();
  const [users, pauseRow] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        telegramChatId: true,
        telegramName: true,
        telegramEnabled: true,
        telegramAdminMode: true,
        telegramPausedUntil: true,
        _count: { select: { follows: true, alerts: true } },
      },
    }),
    prisma.appSetting.findUnique({ where: { key: TELEGRAM_SETTINGS.pausedUntil } }),
  ]);
  const globalPause = parsePausedUntil(pauseRow?.value);
  const globalPaused = globalPause !== null && globalPause > now;
  const linked = users.filter((u) => u.telegramChatId).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Membres"
        description="Les comptes du site : administrateurs, et alertes Telegram de chacun (actives, sans son, coupées ou en pause)."
        actions={
          <Button asChild variant="outline">
            <Link href="/sources/erreurs">Erreurs du worker</Link>
          </Button>
        }
      />
      <FormError message={erreur} />

      <Card className={cn(globalPaused && 'border-warning/60')}>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Telegram pour tous</CardTitle>
            <CardDescription>
              {globalPaused
                ? `En pause jusqu’au ${formatDateTime(globalPause)} : aucune alerte ne part sur Telegram, conversation du serveur comprise.`
                : `Actif. ${linked} compte${linked > 1 ? 's' : ''} relié${linked > 1 ? 's' : ''} au bot.`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <PauseButtons action={setGlobalTelegramPauseAction} paused={globalPaused} />
        </CardContent>
      </Card>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="label-mono text-muted-foreground">
              <tr className="border-b">
                <th className="px-5 py-3 text-left font-medium">Compte</th>
                <th className="px-3 py-3 text-left font-medium">Rôle</th>
                <th className="px-3 py-3 text-left font-medium">Telegram</th>
                <th className="px-3 py-3 text-left font-medium">Réglage</th>
                <th className="px-5 py-3 text-left font-medium">Pause</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => {
                const admin = u.role === 'ADMIN';
                const mode = parseTelegramMode(u.telegramAdminMode);
                const paused = u.telegramPausedUntil !== null && u.telegramPausedUntil > now;
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
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1.5">
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
                    <td className="px-3 py-3">
                      {u.telegramChatId ? (
                        <>
                          <p className="font-medium">{u.telegramName ?? 'Relié'}</p>
                          <p
                            className={cn(
                              'text-xs',
                              u.telegramEnabled ? 'text-success' : 'text-muted-foreground',
                            )}
                          >
                            {u.telegramEnabled ? 'Activé par le membre' : 'Coupé par le membre'}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Non relié</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <form
                        action={setTelegramModeAction.bind(null, u.id)}
                        className="flex items-center gap-1.5"
                      >
                        <select
                          name="mode"
                          defaultValue={mode}
                          aria-label={`Telegram de ${u.name ?? u.email}`}
                          className="h-8 rounded-md border border-input bg-card px-2 text-sm"
                        >
                          {(Object.keys(TELEGRAM_ADMIN_MODES) as TelegramAdminMode[]).map((m) => (
                            <option key={m} value={m}>
                              {TELEGRAM_ADMIN_MODES[m]}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" size="sm" variant="outline" className="h-8">
                          OK
                        </Button>
                      </form>
                    </td>
                    <td className="px-5 py-3">
                      {paused && (
                        <p className="mb-1.5 text-xs text-warning">
                          Jusqu’au {formatDateTime(u.telegramPausedUntil)}
                        </p>
                      )}
                      <PauseButtons
                        action={pauseTelegramAction.bind(null, u.id)}
                        paused={paused}
                        small
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">
        Chaque membre relie son Telegram depuis la page Alertes (« Relier Telegram ») et peut le
        couper lui-même, ou envoyer /stop au bot. Vos réglages ici passent avant les siens.
      </p>
    </div>
  );
}

function PauseButtons({
  action,
  paused,
  small,
}: {
  action: (formData: FormData) => Promise<void>;
  paused: boolean;
  small?: boolean;
}) {
  return (
    <form action={action} className="flex flex-wrap gap-1.5">
      {PAUSES.map((p) => (
        <Button
          key={p.hours}
          type="submit"
          name="heures"
          value={p.hours}
          size="sm"
          variant="outline"
          className={cn(small && 'h-7 px-2 text-xs')}
        >
          {small ? p.label : `Pause ${p.label}`}
        </Button>
      ))}
      {paused && (
        <Button
          type="submit"
          name="heures"
          value={0}
          size="sm"
          className={cn(small && 'h-7 px-2 text-xs')}
        >
          Reprendre
        </Button>
      )}
    </form>
  );
}
