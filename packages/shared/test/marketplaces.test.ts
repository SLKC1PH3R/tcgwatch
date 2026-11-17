import { describe, expect, it } from 'vitest';
import { marketplaceLinks, marketSearchQuery, relevantMarketListing } from '../src/marketplaces';

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

  it('liens préremplis jusqu’au bon prix', () => {
    const links = marketplaceLinks('ETB Nuit Noire', 130, 'Pitch Black Elite Trainer Box');
    const by = Object.fromEntries(links.map((l) => [l.key, new URL(l.url)]));
    expect(by.leboncoin!.searchParams.get('price')).toBe('min-130');
    expect(by.vinted!.searchParams.get('price_to')).toBe('130');
    expect(by.ebay!.searchParams.get('_udhi')).toBe('130');
    expect(by.cardmarket!.searchParams.get('searchString')).toBe('Pitch Black Elite Trainer Box');
  });
});
