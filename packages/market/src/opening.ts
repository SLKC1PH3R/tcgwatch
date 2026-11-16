/**
 * Valeur d'une ouverture de boosters (ère Écarlate et Violet / Méga-Évolution) : espérance
 * exacte carte par carte et simulation de Monte-Carlo pour la dispersion.
 *
 * Booster de 10 cartes : 4 communes, 3 peu communes, 1 emplacement rare (Rare, Double rare ou
 * Ultra Rare), 2 emplacements reverse dont l'un peut révéler une illustration rare, spéciale,
 * hyper rare… Taux de tirage : estimations communautaires moyennes (non officielles), qui
 * varient d'une extension à l'autre.
 */

/** Cartes par booster, en moyenne, pour chaque rareté « tirée au sort ». */
export const RARE_SLOT: Record<string, number> = {
  'Double rare': 1 / 6,
  'Ultra Rare': 1 / 15,
};
/** Raretés qui remplacent un reverse (probabilité par booster). */
export const HIT_SLOT: Record<string, number> = {
  'Illustration rare': 1 / 13,
  'Illustration spéciale rare': 1 / 32,
  'Hyper rare': 1 / 55,
  'Méga Hyper Rare': 1 / 200,
  'ACE SPEC Rare': 1 / 20,
  'HIGH-TECH rare': 1 / 20,
  'Mega Attack Rare': 1 / 20,
  'Chromatique rare': 1 / 6,
  'Chromatique ultra rare': 1 / 20,
};
const BASE = { Commune: 4, 'Peu Commune': 3 } as const;
/** Raretés possibles dans un booster : une autre rareté = extension non prise en charge. */
export const KNOWN_RARITIES = new Set([
  'Commune',
  'Peu Commune',
  'Rare',
  ...Object.keys(RARE_SLOT),
  ...Object.keys(HIT_SLOT),
]);

export interface OpeningCard {
  id: string;
  name: string;
  localId: string;
  rarity: string;
  price: number;
}

export interface OpeningOptions {
  boosters: number;
  /** Cartes sous ce prix comptées à 0 € (invendables). */
  minValue: number;
  /** Commission de vente déduite (0,05 = 5 %). */
  commission: number;
}

interface Pool {
  cards: OpeningCard[];
  values: number[];
  mean: number;
}

function pools(cards: OpeningCard[], minValue: number) {
  const by = new Map<string, Pool>();
  for (const c of cards) {
    const p = by.get(c.rarity) ?? { cards: [], values: [], mean: 0 };
    p.cards.push(c);
    p.values.push(c.price >= minValue ? c.price : 0);
    by.set(c.rarity, p);
  }
  for (const p of by.values()) p.mean = p.values.reduce((s, v) => s + v, 0) / p.values.length;
  return by;
}

/**
 * Cartes attendues par booster pour chaque rareté présente dans l'extension, et nombre de
 * reverses ordinaires (communes, peu communes et rares en version reverse).
 */
export function ratesFor(rarities: Set<string>): { rates: Map<string, number>; reverse: number } {
  const rates = new Map<string, number>();
  for (const [r, n] of Object.entries(BASE)) if (rarities.has(r)) rates.set(r, n);
  // Emplacement rare : Double rare / Ultra Rare, sinon Rare.
  let rareLeft = 1;
  for (const [r, p] of Object.entries(RARE_SLOT)) {
    if (!rarities.has(r)) continue;
    rates.set(r, p);
    rareLeft -= p;
  }
  // Reverse spécial : une « hit » ou un reverse ordinaire ; second reverse toujours ordinaire.
  let reverse = 2;
  for (const [r, p] of Object.entries(HIT_SLOT)) {
    if (!rarities.has(r)) continue;
    rates.set(r, p);
    reverse -= p;
  }
  if (rarities.has('Rare')) rates.set('Rare', rareLeft);
  return { rates, reverse };
}

export interface OpeningResult {
  supported: boolean;
  unknownRarities: string[];
  /** Valeur moyenne d'une ouverture (après filtre et commission). */
  expected: number;
  median: number;
  p10: number;
  p90: number;
  /** Probabilité que le contenu vaille au moins `price`. */
  chanceAbove: (price: number) => number;
  /** Cartes qui pèsent le plus dans la valeur moyenne. */
  contributors: { card: OpeningCard; expectedCopies: number; contribution: number }[];
  byRarity: { rarity: string; perBooster: number; meanValue: number; share: number }[];
}

/** Générateur pseudo-aléatoire déterministe (mêmes paramètres = même simulation). */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulateOpening(
  cards: OpeningCard[],
  opts: OpeningOptions,
  runs = 2000,
): OpeningResult {
  const rarities = new Set(cards.map((c) => c.rarity));
  const unknownRarities = [...rarities].filter((r) => !KNOWN_RARITIES.has(r));
  const by = pools(cards, opts.minValue);
  const { rates, reverse } = ratesFor(rarities);
  const keep = 1 - opts.commission;

  // Reverses ordinaires : tirés parmi communes, peu communes et rares.
  const reversePool = ['Commune', 'Peu Commune', 'Rare']
    .map((r) => by.get(r))
    .filter((p): p is Pool => !!p);
  const reverseValues = reversePool.flatMap((p) => p.values);
  const reverseCards = reversePool.flatMap((p) => p.cards);
  const reverseMean = reverseValues.length
    ? reverseValues.reduce((s, v) => s + v, 0) / reverseValues.length
    : 0;

  // Espérance exacte par booster.
  const byRarity = [...rates.entries()]
    .filter(([r]) => by.has(r))
    .map(([rarity, perBooster]) => ({ rarity, perBooster, meanValue: by.get(rarity)!.mean }));
  const perBooster =
    byRarity.reduce((s, r) => s + r.perBooster * r.meanValue, 0) + reverse * reverseMean;
  const expected = perBooster * opts.boosters * keep;

  // Contributions carte par carte.
  const copies = new Map<string, number>();
  for (const { rarity, perBooster: rate } of byRarity) {
    const pool = by.get(rarity)!;
    for (const c of pool.cards)
      copies.set(c.id, (copies.get(c.id) ?? 0) + rate / pool.cards.length);
  }
  for (const c of reverseCards)
    copies.set(c.id, (copies.get(c.id) ?? 0) + reverse / reverseCards.length);
  const contributors = cards
    .map((card) => {
      const expectedCopies = (copies.get(card.id) ?? 0) * opts.boosters;
      const value = card.price >= opts.minValue ? card.price : 0;
      return { card, expectedCopies, contribution: expectedCopies * value * keep };
    })
    .filter((c) => c.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 12);

  // Simulation : un tirage par emplacement.
  const rand = mulberry32(Math.round(opts.boosters * 1000 + opts.minValue * 100) ^ cards.length);
  const pick = (values: number[]) => values[Math.floor(rand() * values.length)] ?? 0;
  const rareSlot = Object.entries(RARE_SLOT).filter(([r]) => by.has(r));
  const hitSlot = Object.entries(HIT_SLOT).filter(([r]) => by.has(r));
  const base = Object.entries(BASE).filter(([r]) => by.has(r));
  const rare = by.get('Rare');
  const totals: number[] = [];
  for (let run = 0; run < runs; run++) {
    let sum = 0;
    for (let b = 0; b < opts.boosters; b++) {
      for (const [r, n] of base) for (let i = 0; i < n; i++) sum += pick(by.get(r)!.values);
      let u = rand();
      let slot: Pool | undefined = rare;
      for (const [r, p] of rareSlot) {
        if (u < p) {
          slot = by.get(r);
          break;
        }
        u -= p;
      }
      if (slot) sum += pick(slot.values);
      sum += pick(reverseValues);
      u = rand();
      let hit: Pool | undefined;
      for (const [r, p] of hitSlot) {
        if (u < p) {
          hit = by.get(r);
          break;
        }
        u -= p;
      }
      sum += hit ? pick(hit.values) : pick(reverseValues);
    }
    totals.push(sum * keep);
  }
  totals.sort((a, b) => a - b);
  const q = (x: number) => totals[Math.min(totals.length - 1, Math.floor(x * totals.length))] ?? 0;

  const total = byRarity.reduce((s, r) => s + r.perBooster * r.meanValue, 0) || 1;
  return {
    supported: unknownRarities.length === 0 && by.has('Commune'),
    unknownRarities,
    expected,
    median: q(0.5),
    p10: q(0.1),
    p90: q(0.9),
    chanceAbove: (price) => totals.filter((t) => t >= price).length / (totals.length || 1),
    contributors,
    byRarity: byRarity
      .map((r) => ({ ...r, share: (r.perBooster * r.meanValue) / total }))
      .sort((a, b) => b.share - a.share),
  };
}
