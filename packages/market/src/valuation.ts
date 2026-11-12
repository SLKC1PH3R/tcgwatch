/**
 * Calculs de valorisation de la collection (purs, testés).
 */
export interface CollectionLine {
  productId: string;
  quantity: number;
  purchasePrice: number;
}

export interface ValuationInput {
  lines: CollectionLine[];
  /** Dernier prix marché connu par produit. */
  marketPrice: Map<string, number>;
  /** Meilleur prix boutique actuel par produit (repli si pas de prix marché). */
  retailPrice: Map<string, number>;
}

export interface Valuation {
  totalCost: number;
  estimatedValue: number;
  unrealizedGain: number;
  /** Ratio valeur / coût (1 = à l'équilibre). */
  ratio: number | null;
  /** Part de la valeur estimée à partir de prix boutique (pas de prix marché). */
  estimatedFromRetail: number;
  /** Quantité de produits sans aucune estimation (comptés au prix d'achat). */
  unpricedQuantity: number;
}

export function valueCollection({ lines, marketPrice, retailPrice }: ValuationInput): Valuation {
  let totalCost = 0;
  let estimatedValue = 0;
  let estimatedFromRetail = 0;
  let unpricedQuantity = 0;
  for (const line of lines) {
    const cost = line.quantity * line.purchasePrice;
    totalCost += cost;
    const market = marketPrice.get(line.productId);
    const retail = retailPrice.get(line.productId);
    if (market !== undefined) {
      estimatedValue += line.quantity * market;
    } else if (retail !== undefined) {
      const v = line.quantity * retail;
      estimatedValue += v;
      estimatedFromRetail += v;
    } else {
      estimatedValue += cost;
      unpricedQuantity += line.quantity;
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    totalCost: round(totalCost),
    estimatedValue: round(estimatedValue),
    unrealizedGain: round(estimatedValue - totalCost),
    ratio: totalCost > 0 ? estimatedValue / totalCost : null,
    estimatedFromRetail: round(estimatedFromRetail),
    unpricedQuantity,
  };
}

/** Variation relative entre deux prix (null si incalculable). */
export function priceChange(before: number | null | undefined, after: number | null | undefined) {
  if (!before || after === null || after === undefined) return null;
  return (after - before) / before;
}
