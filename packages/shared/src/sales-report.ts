/** Une revente enregistrée (ligne de « Mon scellé » marquée vendue). */
export interface SaleLine {
  soldAt: Date;
  quantity: number;
  /** Prix de vente unitaire. */
  salePrice: number;
  /** Frais de vente pour toute la ligne (commission, port à sa charge). */
  saleFees: number;
  /** Coût d'achat de toute la ligne, port d'achat compris. */
  cost: number;
  /** Montant encaissé : prix de vente × quantité − frais. */
  proceeds: number;
  gain: number;
  saleChannel: string | null;
}

export interface SalesTotals {
  /** Nombre d'objets vendus. */
  count: number;
  /** Nombre de ventes (lignes). */
  sales: number;
  gross: number;
  fees: number;
  proceeds: number;
  cost: number;
  gain: number;
  /** Somme des plus-values positives et des moins-values. */
  gains: number;
  losses: number;
}

/** Ventes en ligne (hors main propre) : seuils de déclaration des plateformes (DAC7). */
export const PLATFORM_REPORT_SALES = 30;
export const PLATFORM_REPORT_AMOUNT = 2000;
/** Prix de cession par objet sous lequel la plus-value d'un bien meuble est exonérée. */
export const MOVABLE_EXEMPTION_PRICE = 5000;

const round = (n: number) => Math.round(n * 100) / 100;

export function saleTotals(lines: SaleLine[]): SalesTotals {
  const t: SalesTotals = {
    count: 0,
    sales: lines.length,
    gross: 0,
    fees: 0,
    proceeds: 0,
    cost: 0,
    gain: 0,
    gains: 0,
    losses: 0,
  };
  for (const l of lines) {
    t.count += l.quantity;
    t.gross += l.salePrice * l.quantity;
    t.fees += l.saleFees;
    t.proceeds += l.proceeds;
    t.cost += l.cost;
    t.gain += l.gain;
    if (l.gain >= 0) t.gains += l.gain;
    else t.losses += l.gain;
  }
  for (const k of ['gross', 'fees', 'proceeds', 'cost', 'gain', 'gains', 'losses'] as const) {
    t[k] = round(t[k]);
  }
  return t;
}

/** Vente sur une plateforme en ligne (tout canal sauf la main propre ou un canal inconnu). */
export function isPlatformSale(channel: string | null): boolean {
  if (!channel?.trim()) return false;
  return !/main propre|en personne|direct|ami|bourse|salon|convention/i.test(channel);
}

/**
 * Bilan des reventes d'une année : totaux, détail par mois et par canal, ventes en ligne
 * (comparées aux seuils de déclaration des plateformes) et ventes au-dessus du seuil
 * d'exonération des biens meubles.
 */
export function salesReport<T extends SaleLine>(all: T[], year: number) {
  // Dates de vente au jour près (colonne date, minuit UTC).
  const yearOf = (d: Date) => d.getUTCFullYear();
  const monthOf = (d: Date) => d.getUTCMonth();
  const years = [...new Set(all.map((l) => yearOf(l.soldAt)))].sort((a, b) => b - a);
  const lines = all
    .filter((l) => yearOf(l.soldAt) === year)
    .sort((a, b) => a.soldAt.getTime() - b.soldAt.getTime());
  const months = Array.from({ length: 12 }, (_, m) =>
    saleTotals(lines.filter((l) => monthOf(l.soldAt) === m)),
  );
  const channels = new Map<string, T[]>();
  for (const l of lines) {
    const key = l.saleChannel?.trim() || 'Non précisé';
    channels.set(key, [...(channels.get(key) ?? []), l]);
  }
  const platform = saleTotals(lines.filter((l) => isPlatformSale(l.saleChannel)));
  return {
    year,
    years,
    lines,
    totals: saleTotals(lines),
    months,
    channels: [...channels.entries()]
      .map(([channel, ls]) => ({ channel, ...saleTotals(ls) }))
      .sort((a, b) => b.gross - a.gross),
    platform: {
      ...platform,
      reportable:
        platform.sales >= PLATFORM_REPORT_SALES || platform.gross >= PLATFORM_REPORT_AMOUNT,
    },
    aboveExemption: lines.filter((l) => l.salePrice > MOVABLE_EXEMPTION_PRICE),
  };
}
