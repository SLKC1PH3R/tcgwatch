import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  matchProduct,
  parsePokecardexCalendar,
  productTokens,
  randomIllustrationBoosters,
  searchQueryFor,
} from '../src';

// Catalogue FR réel (extrait Pokécardex) et intitulés relevés chez les revendeurs.
const catalog = parsePokecardexCalendar(
  readFileSync(path.join(import.meta.dirname, 'fixtures', 'pokecardex-calendrier.html'), 'utf8'),
).map((r) => ({ id: r.externalId, name: r.name, type: r.productType }));
const nameOf = (title: string) => {
  const m = matchProduct(title, catalog);
  return m ? catalog.find((p) => p.id === m.productId)!.name : null;
};

describe('productTokens', () => {
  it('ignore type, marque, série, codes et langue', () => {
    expect(
      productTokens("Coffret Dresseur d'élite (ETB) Pokémon :  Règne Delta [ME06] - FR"),
    ).toEqual(['delta', 'regne']);
    expect(productTokens('Collection Ultra-Premium 30ᵉ Anniversaire – Soirée')).toEqual([
      '30ans',
      'soiree',
    ]);
    expect(productTokens('Bundle 6 boosters Pokémon : Règne Delta [ME06] - FR')).toContain(
      'bundle',
    );
  });
});

describe('matchProduct (intitulés réels)', () => {
  it.each([
    [
      "Coffret Dresseur d'élite (ETB) Pokémon :  Règne Delta [ME06] - FR",
      'Coffret Dresseur d’élite Méga-Évolution - Règne Delta',
    ],
    ['Display de 36 boosters Pokémon : Règne Delta [ME06] - FR', 'Boite de boosters Règne Delta'],
    ['Tripack Pokémon : Règne Delta [ME06] - Otaria - FR', 'Tripack - Règne Delta - Otaria'],
    // Philibert : pas d'illustration dans le nom, mais un seul tripack Règne Delta.
    ['Pokémon ME06 - Règne Delta - Pack 3 Boosters', 'Tripack - Règne Delta - Otaria'],
    [
      'Bundle 6 boosters Pokémon : Règne Delta [ME06] - FR',
      'Lot de boosters Méga-Évolution - Règne Delta',
    ],
    [
      'Pokémon 30 ans - Ultra Premium Collection - Soirée',
      'Collection Ultra-Premium 30ᵉ Anniversaire – Soirée',
    ],
    // Akilon (WooCommerce) : intitulés en anglais / avec tirets longs.
    [
      'Pokémon ME06 Règne Delta – Elite Trainer Box – 9 Boosters – Français',
      'Coffret Dresseur d’élite Méga-Évolution - Règne Delta',
    ],
    [
      'Display Pokémon ME06 Règne Delta – 36 Boosters Français Scellés',
      'Boite de boosters Règne Delta',
    ],
    // Masterset (Shopify) : préfixes de précommande / limite et suffixe de boutique.
    [
      '[PRECOMMANDE] [LIMITE2] Display 36 boosters - ME06 Règne Delta [FR]-MASTERSET',
      'Boite de boosters Règne Delta',
    ],
    [
      "[PRECOMMANDE] [LIMITE2] ETB (Coffret dresseur d'élite) - ME06 Règne Delta [FR]-MASTERSET",
      'Coffret Dresseur d’élite Méga-Évolution - Règne Delta',
    ],
    // Destock TCG : code d'extension entre crochets, « Bundle » = lot de 6.
    [
      "ETB Règne Delta [ME06] - Coffret Dresseur d'Élite - FR [ME6]",
      'Coffret Dresseur d’élite Méga-Évolution - Règne Delta',
    ],
    [
      'Display [ME06] - 36 Boosters Règne Delta - Pokémon FR [ME6]',
      'Boite de boosters Règne Delta',
    ],
    [
      'Bundle [ME06] - 6 Boosters Règne Delta - Pokémon - FR [ME6]',
      'Lot de boosters Méga-Évolution - Règne Delta',
    ],
  ])('%s → %s', (title, expected) => {
    expect(nameOf(title)).toBe(expected);
  });

  it.each([
    // Versions étrangères, autres jeux, lots de boîtes (Masterset).
    'Pokémon [Japonais] - Boîte de 30 Boosters No Shrink - M6 Storm Emeralda-MASTERSET',
    '[PRECOMMANDE] Display 15 boosters [Chinois] - Gem Pack Vol.7-MASTERSET',
    'Pokémon - Case scellée 24 boosters blisters - ME06 - Règne Delta-MASTERSET',
    'MTG - Decks Commander - Marvel Super Heroes',
    // Plusieurs exemplaires d'un même produit.
    'Lot 2 Tripacks - ME06 Règne Delta-MASTERSET',
    // Destock TCG : lots de boîtes, versions chinoises, artsets de 4 boosters.
    'Lot Scellé de 10 Mini Tin - Illumis - Q2 26 - [ME04] [ME03] - Pokémon',
    'Pokébox - Lot de 3 - Méga Puissances Q3 26 - FR - Pokémon',
    '30e Anniversaire - Lot de 2 Pokébox - Pokémon - FR',
    'Display Gem Pack Vol.6 - Boite de 18 Boosters - CHINOIS - [CBB6C] - Pokémon',
    'Artset [ME06] - 4 Boosters Règne Delta - Pokémon - FR [ME6]',
    "1 Protection Plastique pour Coffret Dresseur d'Elite - Anti-UV, Rayures",
    'Lot de Tripack Farfuret et Dimoret - Flammes Fantasmagoriques - FR - [ME02] [ME2] - Pokémon',
    'Mini Tin - Fable Nébuleuse - Lot des 5 illustrations - FR - [SV6.5][EV6.5] - Pokémon',
    'Héros Transcendants - Display Scellée de 10 Bundles 6 Boosters [ME2.5] - Pokémon - FR',
    // Accessoires dont l'intitulé ressemble à un produit scellé.
    'Phoenix Shield – Crystal Box Display Pokémon 36 Boosters – Protection transparente – FR/NL/EN/DE',
    'Phoenix Shield – Acrylic Case Magnetic – Pokémon ETB – Protection UV 98 % – FR/NL/EN/DE',
    'Pokémon – Poké Ball TCG 2024 – 3 Boosters + Autocollants (Rouge/Blanc)',
    // Pack de 3 boosters vendu en présentoir (24,99 €) : surtout pas le display de 36.
    'Pokémon EV09 Aventures Ensemble – Display Baggaïd 3 Boosters | Écarlate & Violet',
    // 4 boosters à l'unité : ni le booster seul ni le bundle de 6.
    'Pokémon ME06 Règne Delta – Lot 4 Boosters – 4 Visuels Différents – Français',
  ])('ignore « %s »', (title) => {
    expect(nameOf(title)).toBeNull();
  });

  it.each([
    // Quatre boosters illustrés différents : ambigu, donc aucun rapprochement.
    'Booster Pokémon : Règne Delta [ME06] - FR',
    'POKÉMON ME06 : BOOSTER RÈGNE DELTA',
    // Versions étrangères et accessoires.
    'Booster Pokémon : The Glory of Team Rocket [SV10] - KO',
    'Display Pokémon Règne Delta - EN',
    'Portfolio A4 Pokémon Règne Delta [ME06] - Ultra Pro',
    'Protège-cartes Pokémon Règne Delta',
    // Type différent : un booster n'est pas un display.
    'Booster Pokémon : Règne Delta - Méga-Rayquaza - Display',
  ])('rien pour « %s »', (title) => {
    if (title.endsWith('- Display')) {
      expect(nameOf(title)).not.toBe('Booster Règne Delta - Méga-Rayquaza');
    } else {
      expect(nameOf(title)).toBeNull();
    }
  });

  it('distingue deux produits par leur année', () => {
    const catalog2 = [
      { id: 'mars25', name: 'Pack 2 boosters Mars 2025', type: 'BLISTER' },
      { id: 'mars26', name: 'Pack 2 boosters Mars 2026', type: 'BLISTER' },
    ];
    expect(matchProduct('PACK 2 BOOSTERS POKÉMON MARS 2026', catalog2)?.productId).toBe('mars26');
    expect(productTokens('Deck Championnats du Monde Pokémon2025 : Pult Bomb - FR')).toContain(
      '2025',
    );
  });

  it('distingue display et demi-display', () => {
    expect(nameOf('Demi-Display 18 boosters Pokémon : Règne Delta - FR')).toBe(
      'Demi-Boîte de boosters Règne Delta',
    );
  });
});

describe('searchQueryFor', () => {
  it('garde les mots distinctifs dans l’ordre', () => {
    expect(searchQueryFor('Coffret Dresseur d’élite Méga-Évolution - Règne Delta')).toBe(
      'Règne Delta',
    );
    expect(searchQueryFor('Collection Ultra-Premium 30ᵉ Anniversaire – Soirée')).toBe(
      '30 ans Soirée',
    );
  });
});

describe('matchProduct (bundle et booster seul)', () => {
  const lots = [
    { id: 'bundle', name: 'Lot de boosters Écarlate et Violet Fable Nébuleuse', type: 'BOOSTER' },
  ];
  it('ne prend pas un booster seul pour le lot de 6', () => {
    expect(
      matchProduct('Booster [EV6.5] - Fable Nébuleuse - Pokémon Ecarlate et Violet - FR', lots),
    ).toBeNull();
    expect(matchProduct('Bundle 6 boosters Fable Nébuleuse - FR', lots)?.productId).toBe('bundle');
  });
});

describe('randomIllustrationBoosters', () => {
  const generics = randomIllustrationBoosters(
    parsePokecardexCalendar(
      readFileSync(
        path.join(import.meta.dirname, 'fixtures', 'pokecardex-calendrier.html'),
        'utf8',
      ),
    ),
  );
  const withGeneric = [
    ...catalog,
    ...generics.map((r) => ({ id: r.externalId, name: r.name, type: r.productType })),
  ];

  it('ajoute un booster sans illustration par extension', () => {
    expect(generics.map((g) => g.name)).toContain('Booster Règne Delta');
    expect(generics.every((g) => g.productType === 'BOOSTER')).toBe(true);
  });

  it('rattache le booster sans illustration des boutiques', () => {
    const id = (t: string) => matchProduct(t, withGeneric)?.productId;
    const generic = generics.find((g) => g.name === 'Booster Règne Delta')!.externalId;
    expect(id('Booster Pokémon : Règne Delta [ME06] - FR')).toBe(generic);
    expect(id('POKÉMON ME06 : BOOSTER RÈGNE DELTA')).toBe(generic);
    // Une illustration précise garde son produit.
    expect(
      withGeneric.find((p) => p.id === id('Booster Pokémon : Règne Delta - Méga-Rayquaza'))?.name,
    ).toBe('Booster Règne Delta - Méga-Rayquaza');
  });
});
