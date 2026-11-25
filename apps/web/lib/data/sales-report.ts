import 'server-only';
import { salesReport } from '@tcgwatch/shared';
import { getCollection } from './collection';

/**
 * Bilan des reventes d'une année (par défaut l'année en cours, ou la dernière année avec des
 * ventes s'il n'y en a pas encore cette année).
 */
export async function getSalesReport(userId: string, year?: number) {
  const { sold } = await getCollection(userId);
  const current = new Date().getUTCFullYear();
  const years = [...new Set(sold.map((s) => s.soldAt.getUTCFullYear()))];
  const wanted =
    year && Number.isInteger(year)
      ? year
      : years.includes(current) || years.length === 0
        ? current
        : Math.max(...years);
  const report = salesReport(sold, wanted);
  if (!report.years.includes(current)) report.years.unshift(current);
  report.years.sort((a, b) => b - a);
  return report;
}

export type SalesReport = Awaited<ReturnType<typeof getSalesReport>>;
