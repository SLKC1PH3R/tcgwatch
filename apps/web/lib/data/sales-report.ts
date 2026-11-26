import 'server-only';
import { prisma } from '@tcgwatch/db';
import { salesReport, toNumber, type SaleLine } from '@tcgwatch/shared';
import { getCollection } from './collection';

const round = (n: number) => Math.round(n * 100) / 100;

const VARIANTS: Record<string, string> = {
  normal: 'normale',
  reverse: 'reverse',
  holo: 'holo',
  firstEdition: '1ʳᵉ édition',
};

/** Ligne du bilan : revente de scellé ou de carte à l'unité. */
export interface ReportLine extends SaleLine {
  id: string;
  kind: 'scelle' | 'carte';
  name: string;
  /** Type de produit, ou « Carte ». */
  type: string;
  href: string;
  purchaseDate: Date | null;
  /** Précision sous le nom : date et lieu d'achat, variante, coût inconnu… */
  detail: string;
}

/**
 * Bilan des reventes d'une année (par défaut l'année en cours, ou la dernière année avec des
 * ventes s'il n'y en a pas encore cette année) : scellé et cartes à l'unité.
 */
export async function getSalesReport(userId: string, year?: number) {
  const [{ sold }, cardSales] = await Promise.all([
    getCollection(userId),
    prisma.cardSale.findMany({
      where: { userId },
      include: {
        card: { select: { name: true, localId: true, release: { select: { nameFr: true } } } },
      },
    }),
  ]);
  const day = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  const lines: ReportLine[] = [
    ...sold.map((s) => ({
      ...s,
      kind: 'scelle' as const,
      name: s.product.name,
      type: s.product.type,
      href: `/produits/${s.product.id}`,
      detail: `acheté le ${day(s.purchaseDate)}${s.store ? ` · ${s.store}` : ''}`,
    })),
    ...cardSales.map((c) => {
      const salePrice = toNumber(c.salePrice)!;
      const saleFees = toNumber(c.saleFees) ?? 0;
      const unitCost = toNumber(c.unitCost);
      const cost = round((unitCost ?? 0) * c.quantity);
      const proceeds = round(salePrice * c.quantity - saleFees);
      return {
        id: c.id,
        kind: 'carte' as const,
        name: `${c.card.name} (${c.card.release.nameFr} ${c.card.localId})`,
        type: 'Carte',
        href: `/cartes/${encodeURIComponent(c.cardId)}`,
        purchaseDate: c.purchasedAt,
        detail: `carte ${VARIANTS[c.variant] ?? c.variant} · ${
          unitCost === null
            ? 'prix d’achat inconnu (booster ou lot)'
            : c.purchasedAt
              ? `achetée le ${day(c.purchasedAt)}`
              : 'achetée à l’unité'
        }`,
        soldAt: c.soldAt,
        quantity: c.quantity,
        salePrice,
        saleFees,
        saleChannel: c.saleChannel,
        cost,
        proceeds,
        gain: round(proceeds - cost),
      };
    }),
  ];
  const current = new Date().getUTCFullYear();
  const years = [...new Set(lines.map((s) => s.soldAt.getUTCFullYear()))];
  const wanted =
    year && Number.isInteger(year)
      ? year
      : years.includes(current) || years.length === 0
        ? current
        : Math.max(...years);
  const report = salesReport(lines, wanted);
  if (!report.years.includes(current)) report.years.unshift(current);
  report.years.sort((a, b) => b - a);
  return report;
}

export type SalesReport = Awaited<ReturnType<typeof getSalesReport>>;
