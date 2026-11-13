/** Calculs sur les séries de prix quotidiennes (jours au format AAAA-MM-JJ, triés). */

export interface DailyBest {
  day: string;
  /** Meilleur prix achetable du jour, null si rien n'était achetable. */
  best: number | null;
}

const DAY_MS = 86_400_000;
const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** Périodes consécutives sans aucune offre achetable (à griser sur le graphique). */
export function outOfStockRanges(series: DailyBest[]): { from: string; to: string }[] {
  const ranges: { from: string; to: string }[] = [];
  let start: string | null = null;
  let last: string | null = null;
  for (const { day, best } of series) {
    if (best === null) {
      start ??= day;
      last = day;
    } else if (start) {
      ranges.push({ from: start, to: last! });
      start = last = null;
    }
  }
  if (start) ranges.push({ from: start, to: last! });
  return ranges;
}

/** Plus bas prix achetable de la série, éventuellement limité aux `days` derniers jours. */
export function lowestBest(series: DailyBest[], days?: number, today = new Date()): number | null {
  const since = days ? today.getTime() - days * DAY_MS : -Infinity;
  let low: number | null = null;
  for (const { day, best } of series) {
    if (best === null || toTime(day) < since) continue;
    if (low === null || best < low) low = best;
  }
  return low;
}

/**
 * « Plus bas depuis X jours » : nombre de jours depuis le dernier jour où le meilleur prix
 * achetable était strictement inférieur au prix actuel. Si le prix actuel n'a jamais été
 * battu, renvoie l'ancienneté de l'historique (et `allTime` = true).
 * null si pas de prix actuel ou moins de 2 jours d'historique.
 */
export function lowSince(
  series: DailyBest[],
  current: number | null,
  today = new Date(),
): { days: number; allTime: boolean } | null {
  if (current === null) return null;
  const priced = series.filter((s) => s.best !== null);
  if (priced.length < 2) return null;
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  for (let i = priced.length - 1; i >= 0; i--) {
    const s = priced[i]!;
    if (s.best! < current - 0.005) {
      return { days: Math.round((now - toTime(s.day)) / DAY_MS), allTime: false };
    }
  }
  return { days: Math.round((now - toTime(priced[0]!.day)) / DAY_MS), allTime: true };
}

/** Variation relative entre la première et la dernière valeur d'une fenêtre (0,1 = +10 %). */
export function relativeChange(before: number, after: number): number | null {
  if (!(before > 0)) return null;
  return after / before - 1;
}
