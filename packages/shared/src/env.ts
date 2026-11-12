import { z } from 'zod';

/** Booléen tolérant pour les variables d'environnement ("true", "1", "yes", "on"). */
const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) =>
      v === undefined || v === '' ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()),
    );

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Authentification
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ALLOW_REGISTRATION: bool(false),
  COOKIE_SECURE: bool(true),

  // Notifications
  NTFY_URL: optionalString,
  NTFY_TOKEN: optionalString,
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_CHAT_ID: optionalString,

  // Scraping
  DEFAULT_CHECK_INTERVAL_MIN: z.coerce.number().int().min(5).default(30),
  SCRAPER_USER_AGENT: z
    .string()
    .default(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    ),
  SCRAPER_MIN_DELAY_MS: z.coerce.number().int().min(0).default(2000),
  SCRAPER_MAX_DELAY_MS: z.coerce.number().int().min(0).default(6000),
  SCRAPER_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  PLAYWRIGHT_ENABLED: bool(true),

  // Planification (expressions cron, fuseau = TZ)
  LISTINGS_CRON: z.string().default('* * * * *'),
  TCGDEX_CRON: z.string().default('0 6 * * *'),
  MARKET_CRON: z.string().default('30 6 * * *'),
  TCGDEX_SERIES: z.string().default('me,sv'),
  /** Calendrier des sorties FR de Pokécardex (pokecardex.com/calendrier). */
  POKECARDEX_ENABLED: bool(true),
  POKECARDEX_CRON: z.string().default('15 6 * * *'),

  // Marché secondaire
  POKETRACE_API_KEY: optionalString,
  POKETRACE_API_URL: z.string().url().default('https://api.poketrace.com'),

  // Worker
  WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(3001),
  RUN_MIGRATIONS: bool(false),

  // Web
  UPLOAD_DIR: z.string().default('./uploads'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Valide et met en cache les variables d'environnement. Lève une erreur lisible si invalide. */
export function getEnv(): Env {
  if (cached) return cached;
  // Une variable définie mais vide (ex. `FOO=` dans docker-compose) vaut « non définie » :
  // la valeur par défaut s'applique.
  const source = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ''),
  );
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuration invalide :\n${details}`);
  }
  cached = parsed.data;
  return cached;
}
