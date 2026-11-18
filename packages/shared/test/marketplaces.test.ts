import { describe, expect, it } from 'vitest';
import {
  cardmarketSlug,
  cardmarketUrl,
  marketplaceLinks,
  marketSearchQuery,
  plausibleMarketPrice,
  relevantMarketListing,
} from '../src/marketplaces';

const etb = {
  name: 'Coffret Dresseur d’élite Méga-Évolution - Nuit Noire',
  type: 'ETB',
  extension: { nameFr: 'Nuit Noire', setCode: 'ME05' },
};
const half = {
  name: 'Demi-Boîte de boosters Nuit Noire',
  type: 'DISPLAY',
  extension: etb.extension,
};

describe('places de marché', () => {
  it('mots-clés de recherche', () => {
    expect(marketSearchQuery(etb)).toBe('ETB Nuit Noire');
    expect(marketSearchQuery(half)).toBe('demi display Nuit Noire');
    expect(marketSearchQuery({ ...etb, marketQuery: ' etb me05 ' })).toBe('etb me05');
    expect(marketSearchQuery({ name: 'Coffret Premium [Exclusivité]', type: 'COFFRET' })).toBe(
      'Coffret Premium',
    );
  });

  it('écarte les annonces hors sujet', () => {
    expect(relevantMarketListing('ETB Nuit Noire Pokémon FR neuf scellé', etb)).toBe(true);
    expect(relevantMarketListing('Coffret dresseur d’élite ME05 jamais ouvert', etb)).toBe(true);
    expect(relevantMarketListing('ETB Nuit Noire VIDE sans boosters', etb)).toBe(false);
    expect(relevantMarketListing('ETB Nuit Noire japonais', etb)).toBe(false);
    expect(relevantMarketListing('ETB Flammes Fantasmagoriques', etb)).toBe(false);
    expect(relevantMarketListing('Display Nuit Noire 36 boosters', etb)).toBe(false);
    expect(relevantMarketListing('Demi display Nuit Noire 18 boosters', half)).toBe(true);
    expect(relevantMarketListing('Display Nuit Noire 36 boosters', half)).toBe(false);
  });

  it('boîtes abîmées et boosters à l’unité écartés (annonces eBay réelles)', () => {
    const display = {
      name: 'Boite de boosters Nuit Noire',
      type: 'DISPLAY',
      extension: etb.extension,
    };
    expect(
      relevantMarketListing(
        'Booster POKÉMON - ME 05 Nuit Noire - 1 Booster zeraora sortie de display - FR',
        display,
      ),
    ).toBe(false);
    expect(relevantMarketListing('Lot de 10 boosters Nuit Noire display', display)).toBe(false);
    expect(relevantMarketListing('Display 36 boosters Nuit Noire ME05 FR', display)).toBe(true);
    expect(
      relevantMarketListing('ETB Nuit Noire ME05 Pokémon JCC FR (Défaut trou dans le Scellé)', etb),
    ).toBe(false);
    expect(relevantMarketListing('ETB Nuit Noire boîte abîmée', etb)).toBe(false);
    expect(relevantMarketListing('ETB Nuit Noire jamais ouvert, sans défaut, FR', etb)).toBe(true);
    expect(
      relevantMarketListing(
        "ETB ME05 NUIT NOIRE POKEMON COFFRET DRESSEUR D'ÉLITE SCELLAGE PARFAIT",
        etb,
      ),
    ).toBe(true);
    expect(plausibleMarketPrice(13.61, 180)).toBe(false);
    expect(plausibleMarketPrice(72.46, 130)).toBe(true);
  });

  it('liens préremplis jusqu’au bon prix', () => {
    const links = marketplaceLinks('ETB Nuit Noire', 130, {
      name: 'Pitch Black Elite Trainer Box',
    });
    const by = Object.fromEntries(links.map((l) => [l.key, new URL(l.url)]));
    expect(by.leboncoin!.searchParams.get('price')).toBe('min-130');
    expect(by.vinted!.searchParams.get('price_to')).toBe('130');
    expect(by.ebay!.searchParams.get('_udhi')).toBe('130');
    expect(by.cardmarket!.searchParams.get('searchString')).toBe('Pitch Black Elite Trainer Box');
  });

  it('fiche Cardmarket directe, offres en français', () => {
    expect(
      cardmarketUrl({ name: 'Pitch Black Booster Box', category: 'Pokémon Display' }, 'x'),
    ).toBe(
      'https://www.cardmarket.com/fr/Pokemon/Products/Booster-Boxes/Pitch-Black-Booster-Box?language=2',
    );
    expect(cardmarketSlug('Black & White Booster Box')).toBe('Black-White-Booster-Box');
    expect(cardmarketSlug('Roaring Skies: Storm Rider Theme Deck')).toBe(
      'Roaring-Skies-Storm-Rider-Theme-Deck',
    );
    expect(cardmarketSlug("Champion's Path Elite Trainer Box")).toBe(
      'Champions-Path-Elite-Trainer-Box',
    );
    expect(cardmarketSlug('Pokémon GO Booster')).toBe('Pokemon-GO-Booster');
    // Catégorie sans adresse connue : recherche.
    expect(cardmarketUrl({ name: 'Some Lot', category: 'Pokémon Lot' }, 'x')).toContain(
      '/Products/Search?searchString=Some+Lot',
    );
  });
});
