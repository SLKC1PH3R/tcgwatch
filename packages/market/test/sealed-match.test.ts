import { describe, expect, it } from 'vitest';
import {
  expansionsOfReleases,
  matchSealedProduct,
  type CardmarketProduct,
} from '../src/cardmarket';

const cm = (idProduct: number, name: string, categoryName: string): CardmarketProduct => ({
  idProduct,
  name,
  categoryName,
  idExpansion: 6569,
});
const pitchBlack = [
  cm(885527, 'Pitch Black 24 Sleeved Booster Case', 'Pokémon Display'),
  cm(885528, 'Pitch Black 6 Booster Box Case', 'Pokémon Display'),
  cm(885533, 'Pitch Black: Binacle 3-Pack Blister', 'Pokémon Blisters'),
  cm(885539, 'Pitch Black Booster Bundle', 'Pokémon Display'),
  cm(885540, 'Pitch Black Build & Battle Box', 'Pokémon Box Set'),
  cm(885541, 'Pitch Black Build & Battle Box Display', 'Pokémon Box Set'),
  cm(885542, 'Pitch Black Elite Trainer Box', 'Pokémon Elite Trainer Boxes'),
  cm(885543, 'Pitch Black Pokémon Center Elite Trainer Box', 'Pokémon Elite Trainer Boxes'),
  cm(885544, 'Pitch Black Booster Box (18 Boosters)', 'Pokémon Display'),
  cm(885545, 'Pitch Black Booster Box', 'Pokémon Display'),
  cm(885546, 'Pitch Black Sleeved Booster', 'Pokémon Booster'),
  cm(885547, 'Pitch Black Booster', 'Pokémon Booster'),
  cm(894254, 'Pitch Black Fun Pack (3 Cards)', 'Pokémon Booster'),
];

describe('produit Cardmarket des produits scellés (par extension)', () => {
  it.each([
    ['Boite de boosters Nuit Noire', 'DISPLAY', 885545],
    ['Demi-Boîte de boosters Nuit Noire', 'DISPLAY', 885544],
    ['Coffret Dresseur d’élite Méga-Évolution - Nuit Noire', 'ETB', 885542],
    ['Lot de boosters Méga-Évolution - Nuit Noire', 'BOOSTER', 885539],
    ['Booster Nuit Noire - Méga-Darkrai', 'BOOSTER', 885547],
    ['Tripack - Nuit Noire - Opermine', 'TRIPACK', 885533],
    ['Boîtier Stratégies et Combats Méga-Évolution - Nuit Noire', 'AUTRE', 885540],
    ['Packs 1 booster Nuit Noire', 'BOOSTER', 885547],
  ])('%s → %i', (name, type, id) => {
    expect(matchSealedProduct({ name, type }, pitchBlack)).toBe(id);
  });

  it('pas de lien quand plusieurs produits du même format existent ou aucun', () => {
    const twoTripacks = [
      ...pitchBlack,
      cm(1, 'Pitch Black: Gengar 3-Pack Blister', 'Pokémon Blisters'),
    ];
    expect(matchSealedProduct({ name: 'Tripack - Nuit Noire', type: 'TRIPACK' }, twoTripacks)).toBe(
      null,
    );
    for (const name of ['Pack 6 boosters Nuit Noire', 'Packs 3 booster Nuit Noire']) {
      expect(matchSealedProduct({ name, type: 'BOOSTER' }, pitchBlack)).toBe(null);
    }
    expect(
      matchSealedProduct({ name: 'Pack Loisir - Nuit Noire', type: 'AUTRE' }, pitchBlack),
    ).toBe(null);
    expect(
      matchSealedProduct(
        { name: 'Stade Stratégies et Combats Nuit Noire', type: 'AUTRE' },
        pitchBlack,
      ),
    ).toBe(null);
    expect(matchSealedProduct({ name: 'Blister Nuit Noire', type: 'BLISTER' }, pitchBlack)).toBe(
      null,
    );
  });

  it("extension Cardmarket majoritaire des cartes d'une extension", () => {
    const singles = new Map([
      [1, { idProduct: 1, idExpansion: 6569 }],
      [2, { idProduct: 2, idExpansion: 6569 }],
      [3, { idProduct: 3, idExpansion: 42 }],
    ]);
    const cards = [1, 2, 3].map((cardmarketId) => ({ releaseId: 'me05', cardmarketId }));
    expect(expansionsOfReleases(cards, singles).get('me05')).toBe(6569);
  });
});
