/** Fuseau des heures silencieuses (le site est en français, les réglages en heure de Paris). */
export const QUIET_TIMEZONE = 'Europe/Paris';

/** Minutes écoulées depuis minuit dans le fuseau donné. */
export function minutesOfDay(date: Date, timeZone = QUIET_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

/**
 * Vrai si l'heure tombe dans la plage silencieuse [start, end[ (minutes depuis minuit).
 * La plage peut passer minuit (22:00 → 08:00). Plage vide ou absente : jamais silencieux.
 */
export function inQuietHours(
  date: Date,
  start: number | null | undefined,
  end: number | null | undefined,
  timeZone = QUIET_TIMEZONE,
): boolean {
  if (start == null || end == null || start === end) return false;
  const m = minutesOfDay(date, timeZone);
  return start < end ? m >= start && m < end : m >= start || m < end;
}
