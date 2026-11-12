import { pino, stdTimeFunctions, type Logger } from 'pino';

/**
 * Logger JSON structuré (pino). En développement : `pnpm dev | pnpm exec pino-pretty`.
 */
export function createLogger(name: string): Logger {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service: name },
    timestamp: stdTimeFunctions.isoTime,
    redact: {
      paths: ['*.password', '*.token', '*.apiKey', 'headers.authorization', 'headers.cookie'],
      censor: '[masqué]',
    },
  });
}

export type { Logger };
