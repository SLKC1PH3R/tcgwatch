import { prisma } from '@tcgwatch/db';
import { TELEGRAM_SETTINGS } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';

interface Update {
  update_id: number;
  message?: {
    text?: string;
    chat: { id: number; type: string; username?: string; first_name?: string; last_name?: string };
  };
}

/** Commande reçue par le bot : /start <jeton>, /stop, /start seul… */
export function parseCommand(text: string): { cmd: string; arg: string } | null {
  const m = /^\/(\w+)(?:@\w+)?(?:\s+(\S+))?/.exec(text.trim());
  return m ? { cmd: m[1]!.toLowerCase(), arg: m[2] ?? '' } : null;
}

async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/**
 * Lit les messages reçus par le bot (toutes les minutes) :
 * - /start <jeton> : relie la conversation au compte qui a demandé le lien ;
 * - /stop : coupe les alertes Telegram du compte relié ; /start les remet ;
 * - relève aussi le nom du bot, affiché par le site pour le lien de liaison.
 */
export async function runTelegramBot(ctx: WorkerContext): Promise<number> {
  const bot = ctx.notifier;
  if (!bot.hasBot) return 0;

  const known = await prisma.appSetting.findUnique({
    where: { key: TELEGRAM_SETTINGS.botUsername },
  });
  if (!known) {
    const me = await bot.botApi<{ username?: string }>('getMe');
    if (me?.username) await setSetting(TELEGRAM_SETTINGS.botUsername, me.username);
  }

  const offsetRow = await prisma.appSetting.findUnique({
    where: { key: TELEGRAM_SETTINGS.updateOffset },
  });
  const offset = Number(offsetRow?.value ?? 0) || 0;
  const updates = await bot.botApi<Update[]>('getUpdates', {
    offset,
    timeout: 0,
    allowed_updates: ['message'],
  });
  if (!updates?.length) return 0;

  const appUrl = ctx.env.APP_URL.replace(/\/$/, '');
  const reply = (chatId: string, text: string) =>
    bot.botApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
  let handled = 0;
  for (const u of updates) {
    const msg = u.message;
    const command = msg?.text ? parseCommand(msg.text) : null;
    if (!msg || !command || msg.chat.type !== 'private') continue;
    const chatId = String(msg.chat.id);
    const name =
      (msg.chat.username ? `@${msg.chat.username}` : '') ||
      [msg.chat.first_name, msg.chat.last_name].filter(Boolean).join(' ') ||
      chatId;
    handled++;

    if (command.cmd === 'start' && command.arg) {
      const user = await prisma.user.findFirst({
        where: { telegramLinkToken: command.arg, telegramLinkExpires: { gt: new Date() } },
        select: { id: true },
      });
      if (!user) {
        await reply(
          chatId,
          'Ce lien a expiré ou a déjà servi. Générez-en un nouveau depuis la page Alertes de TCGWatch.',
        );
        continue;
      }
      // Une conversation n'est reliée qu'à un compte : on la retire d'un éventuel autre compte.
      await prisma.$transaction([
        prisma.user.updateMany({
          where: { telegramChatId: chatId, NOT: { id: user.id } },
          data: { telegramChatId: null, telegramName: null },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            telegramChatId: chatId,
            telegramName: name,
            telegramEnabled: true,
            telegramLinkToken: null,
            telegramLinkExpires: null,
          },
        }),
      ]);
      await reply(
        chatId,
        `✅ <b>Compte TCGWatch relié.</b>\nVos alertes arriveront ici. Envoyez /stop pour les couper, /start pour les remettre.\n<a href="${appUrl}/alertes">Régler mes alertes</a>`,
      );
      continue;
    }

    const linked = await prisma.user.findUnique({
      where: { telegramChatId: chatId },
      select: { id: true },
    });
    if (!linked) {
      await reply(
        chatId,
        `Cette conversation n’est reliée à aucun compte TCGWatch. Ouvrez la page <a href="${appUrl}/alertes">Alertes</a> et utilisez « Relier Telegram ».`,
      );
      continue;
    }
    if (command.cmd === 'stop') {
      await prisma.user.update({ where: { id: linked.id }, data: { telegramEnabled: false } });
      await reply(chatId, '🔕 Alertes Telegram coupées. Envoyez /start pour les remettre.');
    } else if (command.cmd === 'start') {
      await prisma.user.update({ where: { id: linked.id }, data: { telegramEnabled: true } });
      await reply(chatId, '🔔 Alertes Telegram activées.');
    } else {
      await reply(chatId, 'Commandes : /start (activer les alertes), /stop (les couper).');
    }
  }
  await setSetting(TELEGRAM_SETTINGS.updateOffset, String(updates.at(-1)!.update_id + 1));
  return handled;
}
