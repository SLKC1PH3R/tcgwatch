/**
 * Habitudes de réassort d'une boutique : à partir des dates de retour en stock relevées, le jour
 * de la semaine et la plage horaire les plus fréquents (heure de Paris) et l'écart habituel
 * entre deux retours.
 */
export interface RestockPattern {
  count: number;
  /** Nombre de retours par jour de la semaine (0 = lundi). */
  byDay: number[];
  /** Jour le plus fréquent (0 = lundi) et sa part des retours. */
  topDay: { day: number; share: number } | null;
  /** Plage de trois heures la plus fréquente (début inclus, fin exclue) et sa part. */
  topHours: { from: number; to: number; share: number } | null;
  /** Écart médian entre deux retours, en jours. */
  medianGapDays: number | null;
}

export const WEEKDAYS_FR = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
];

const parisParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
});
const DAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function parisDayHour(d: Date) {
  const parts = parisParts.formatToParts(d);
  const day = DAY_INDEX[parts.find((p) => p.type === 'weekday')!.value]!;
  const hour = Number(parts.find((p) => p.type === 'hour')!.value);
  return { day, hour };
}

/** Moins de `minCount` retours : pas d'habitude affichée (`topDay` et `topHours` nuls). */
export function restockPattern(dates: Date[], minCount = 4): RestockPattern {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const byDay = Array.from({ length: 7 }, () => 0);
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const d of sorted) {
    const { day, hour } = parisDayHour(d);
    byDay[day]!++;
    byHour[hour]!++;
  }
  const count = sorted.length;
  // Écarts de plus de 6 h : plusieurs fiches remises en même temps comptent pour un réassort.
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const g = (sorted[i]!.getTime() - sorted[i - 1]!.getTime()) / 86_400_000;
    if (g > 0.25) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const medianGapDays = gaps.length
    ? Math.round(gaps[Math.floor((gaps.length - 1) / 2)]! * 10) / 10
    : null;
  if (count < minCount) return { count, byDay, topDay: null, topHours: null, medianGapDays };

  const bestDay = byDay.reduce((best, n, i) => (n > byDay[best]! ? i : best), 0);
  let bestFrom = 0;
  let bestN = -1;
  for (let h = 0; h < 24; h++) {
    const n = byHour[h]! + byHour[(h + 1) % 24]! + byHour[(h + 2) % 24]!;
    if (n > bestN) {
      bestN = n;
      bestFrom = h;
    }
  }
  return {
    count,
    byDay,
    topDay: { day: bestDay, share: byDay[bestDay]! / count },
    topHours: { from: bestFrom, to: (bestFrom + 3) % 24, share: bestN / count },
    medianGapDays,
  };
}

/** Phrase courte : « surtout le mardi (40 %), entre 9 h et 12 h, tous les 8 jours environ ». */
export function describeRestockPattern(p: RestockPattern): string | null {
  if (!p.topDay || !p.topHours) return null;
  const parts: string[] = [];
  // Un jour ne ressort que s'il pèse nettement plus que la moyenne (1/7 ≈ 14 %).
  if (p.topDay.share >= 0.3) {
    parts.push(`surtout le ${WEEKDAYS_FR[p.topDay.day]} (${Math.round(p.topDay.share * 100)} %)`);
  } else parts.push('sans jour particulier');
  if (p.topHours.share >= 0.4) {
    parts.push(`entre ${p.topHours.from} h et ${p.topHours.to} h`);
  }
  if (p.medianGapDays !== null) {
    parts.push(
      p.medianGapDays < 1.5
        ? 'presque tous les jours'
        : `tous les ${Math.round(p.medianGapDays)} jours environ`,
    );
  }
  return parts.join(', ');
}
