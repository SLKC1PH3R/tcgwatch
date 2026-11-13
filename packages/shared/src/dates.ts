const MONTHS: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  février: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  août: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
  décembre: 11,
};

function utcDate(y: number, mo: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, mo, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

/**
 * Parse une date française ("27/11/2026", "1er décembre 2026") ou ISO ("2026-11-27")
 * en Date UTC à minuit.
 */
export function parseFrenchDate(raw: string): Date | null {
  const s = raw.trim().toLowerCase();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return utcDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return utcDate(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = s.match(/(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})/);
  if (m && m[2] && MONTHS[m[2]] !== undefined) {
    return utcDate(Number(m[3]), MONTHS[m[2]]!, Number(m[1]));
  }
  return null;
}

const parisDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Jour calendaire à Paris d'un instant, au format AAAA-MM-JJ. */
export function parisDayKey(at = new Date()): string {
  return parisDay.format(at);
}

/**
 * Jour du calendrier de Paris (minuit UTC de cette date) : clé des relevés quotidiens et des
 * colonnes « date ». Un relevé fait à 0 h 30 heure de Paris compte pour ce jour, pas la veille.
 */
export function todayUtc(now = new Date()): Date {
  return new Date(`${parisDayKey(now)}T00:00:00Z`);
}

/** Instant réel du début de la journée de Paris qui contient `at` (minuit heure de Paris). */
export function parisDayStart(at = new Date()): Date {
  const key = parisDayKey(at);
  const base = Date.parse(`${key}T00:00:00Z`);
  // Minuit à Paris = 22 h ou 23 h UTC la veille (UTC+2 l'été, UTC+1 l'hiver).
  for (const h of [2, 1, 0]) {
    const t = new Date(base - h * 3_600_000);
    if (parisDayKey(t) === key) return t;
  }
  return new Date(base);
}

/** Nombre de jours entiers entre aujourd'hui et la date donnée (négatif si passée). */
export function daysUntil(date: Date, now = new Date()): number {
  const a = todayUtc(now).getTime();
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

const frDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });
const frDateTime = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

export function formatDate(d: Date | null | undefined): string {
  return d ? frDate.format(d) : '—';
}

export function formatDateTime(d: Date | null | undefined): string {
  return d ? frDateTime.format(d) : '—';
}
