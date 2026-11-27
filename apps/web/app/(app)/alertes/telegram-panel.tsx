import { BellOff, Send } from 'lucide-react';
import { formatDateTime, telegramDecision } from '@tcgwatch/shared';
import { Button } from '@/components/ui/button';
import {
  createTelegramLinkAction,
  setTelegramEnabledAction,
  unlinkTelegramAction,
} from './actions';

export interface TelegramState {
  telegramChatId: string | null;
  telegramName: string | null;
  telegramEnabled: boolean;
  telegramAdminMode: string;
  telegramPausedUntil: Date | null;
  telegramLinkToken: string | null;
  telegramLinkExpires: Date | null;
}

/**
 * Telegram personnel dans les réglages d'alertes : relier son compte au bot (lien /start à
 * usage unique), activer ou couper, délier ; et ce qu'a décidé un administrateur.
 */
export function TelegramPanel({
  user,
  bot,
  globalPause,
  now,
}: {
  user: TelegramState;
  bot: string | null;
  globalPause: Date | null;
  now: Date;
}) {
  const linked = Boolean(user.telegramChatId);
  const linkValid =
    user.telegramLinkToken && user.telegramLinkExpires && user.telegramLinkExpires > now;
  const decision = telegramDecision(user, globalPause, now);
  const adminNote = !decision.send
    ? decision.reason === 'global'
      ? `Telegram est en pause pour tous jusqu’au ${formatDateTime(globalPause!)}.`
      : decision.reason === 'off'
        ? 'Un administrateur a coupé vos alertes Telegram.'
        : decision.reason === 'paused'
          ? `Un administrateur a mis vos alertes Telegram en pause jusqu’au ${formatDateTime(user.telegramPausedUntil!)}.`
          : null
    : decision.silent
      ? 'Un administrateur a réglé vos alertes Telegram sans son.'
      : null;

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Send className="size-3.5" /> Telegram
          </p>
          <p className="text-xs text-muted-foreground">
            {linked
              ? `Relié à ${user.telegramName ?? 'votre conversation'}${user.telegramEnabled ? '' : ' · coupé'}`
              : 'Recevez vos alertes dans une conversation avec le bot TCGWatch.'}
          </p>
        </div>
        {linked ? (
          <div className="flex gap-1.5">
            <form action={setTelegramEnabledAction.bind(null, !user.telegramEnabled)}>
              <Button
                type="submit"
                size="sm"
                variant={user.telegramEnabled ? 'outline' : 'default'}
              >
                {user.telegramEnabled ? (
                  <>
                    <BellOff /> Couper
                  </>
                ) : (
                  'Activer'
                )}
              </Button>
            </form>
            <form action={unlinkTelegramAction}>
              <Button type="submit" size="sm" variant="ghost">
                Délier
              </Button>
            </form>
          </div>
        ) : bot ? (
          <form action={createTelegramLinkAction}>
            <Button type="submit" size="sm" variant="outline">
              Relier Telegram
            </Button>
          </form>
        ) : (
          <span className="text-xs text-muted-foreground">Bot non configuré</span>
        )}
      </div>
      {!linked && linkValid && bot && (
        <div className="space-y-1.5 rounded-lg bg-muted/50 p-2.5 text-xs">
          <a
            href={`https://t.me/${bot}?start=${user.telegramLinkToken}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Ouvrir @{bot} dans Telegram
          </a>
          <p className="text-muted-foreground">
            Appuyez sur « Démarrer » dans la conversation : votre compte est relié dans la minute.
            Lien valable jusqu’à {formatDateTime(user.telegramLinkExpires!).split(' ').at(-1)},
            rechargez la page ensuite.
          </p>
        </div>
      )}
      {linked && adminNote && <p className="text-xs text-warning">{adminNote}</p>}
    </div>
  );
}
