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

/** Date du jour (minuit UTC, selon le calendrier local) — clé des relevés quotidiens. */
export function todayUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
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
