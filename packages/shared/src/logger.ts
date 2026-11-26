import { pino, stdTimeFunctions, type Logger } from 'pino';

/**
 * Logger JSON structuré (pino). En développement : `pnpm dev | pnpm exec pino-pretty`.
 */
export function createLogger(
  name: string,
  /** Appelé pour chaque avertissement ou erreur (journal des erreurs du worker). */
  onProblem?: (level: 'warn' | 'error', obj: Record<string, unknown>, msg: string) => void,
): Logger {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service: name },
    timestamp: stdTimeFunctions.isoTime,
    redact: {
      paths: ['*.password', '*.token', '*.apiKey', 'headers.authorization', 'headers.cookie'],
      censor: '[masqué]',
    },
    hooks: onProblem
      ? {
          logMethod(args, method, level) {
            if (level >= 40) {
              try {
                const [first, second] = args as unknown[];
                const obj =
                  first && typeof first === 'object' ? (first as Record<string, unknown>) : {};
                const msg =
                  typeof first === 'string' ? first : typeof second === 'string' ? second : '';
                onProblem(level >= 50 ? 'error' : 'warn', obj, msg);
              } catch {
                // Le journal ne doit jamais casser un log.
              }
            }
            return method.apply(this, args);
          },
        }
      : undefined,
  });
}

export type { Logger };
