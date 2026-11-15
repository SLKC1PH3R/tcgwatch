import { formatDate } from '@tcgwatch/shared';

const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'Europe/Paris' });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' });

/** « à l'instant », « il y a 12 min », « il y a 3 h », « hier », « lun. », puis la date. */
export function ago(date: Date, now = new Date()): string {
  const min = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60 && dayKey.format(date) === dayKey.format(now)) {
    return `il y a ${Math.round(min / 60)} h`;
  }
  const days = Math.round(
    (Date.parse(dayKey.format(now)) - Date.parse(dayKey.format(date))) / 86_400_000,
  );
  if (days === 1) return 'hier';
  if (days < 7) return weekday.format(date);
  return formatDate(date);
}
