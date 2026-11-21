import { PoliteFetcher, type BrowserRenderer } from '@tcgwatch/adapters';
import { PlaywrightRenderer } from '@tcgwatch/adapters/browser';
import { getEnv, type Env } from '@tcgwatch/shared/env';
import { createLogger, type Logger } from '@tcgwatch/shared/logger';
import { Notifier } from './notify';
import { PushSender } from './push';

export interface WorkerContext {
  env: Env;
  logger: Logger;
  fetcher: PoliteFetcher;
  browser?: BrowserRenderer;
  notifier: Notifier;
  /** Notifications du navigateur (absent sans clés VAPID). */
  push?: Pick<PushSender, 'sendToUser'>;
  /** Horodatages des dernières exécutions (exposés par le healthcheck). */
  status: {
    startedAt: Date;
    lastListingsTick?: Date;
    lastTcgdexImport?: Date;
    lastPokecardexImport?: Date;
    lastMarketRun?: Date;
    lastError?: string;
  };
}

export function createContext(): WorkerContext {
  const env = getEnv();
  const logger = createLogger('worker');
  const browser = env.PLAYWRIGHT_ENABLED ? new PlaywrightRenderer() : undefined;
  const fetcher = new PoliteFetcher({
    userAgent: env.SCRAPER_USER_AGENT,
    timeoutMs: env.SCRAPER_TIMEOUT_MS,
    minDelayMs: env.SCRAPER_MIN_DELAY_MS,
    maxDelayMs: env.SCRAPER_MAX_DELAY_MS,
    browser,
    onRequest: ({ url, via, waitedMs }) =>
      logger.debug({ url, via, waitedMs }, 'Requête revendeur'),
  });
  const notifier = new Notifier(
    {
      ntfyUrl: env.NTFY_URL,
      ntfyToken: env.NTFY_TOKEN,
      telegramBotToken: env.TELEGRAM_BOT_TOKEN,
      telegramChatId: env.TELEGRAM_CHAT_ID,
    },
    logger,
  );
  const push = PushSender.fromEnv(env, logger);
  return { env, logger, fetcher, browser, notifier, push, status: { startedAt: new Date() } };
}
