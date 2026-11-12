import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AdapterError,
  detectRetailer,
  getAdapterForUrl,
  mapSchemaAvailability,
  parseCultura,
  parseGeneric,
  parsePhilibert,
  parsePlayIn,
  parseSmyths,
} from '../src';

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', `${name}.html`), 'utf8');

const iso = (d: Date | undefined) => d?.toISOString().slice(0, 10);

describe('JSON-LD générique', () => {
  it('mappe les disponibilités schema.org', () => {
    expect(mapSchemaAvailability('https://schema.org/InStock')).toBe('IN_STOCK');
    expect(mapSchemaAvailability('http://schema.org/PreOrder')).toBe('PREORDER');
    expect(mapSchemaAvailability('OutOfStock')).toBe('OUT_OF_STOCK');
    expect(mapSchemaAvailability('SoldOut')).toBe('OUT_OF_STOCK');
    expect(mapSchemaAvailability(undefined)).toBeUndefined();
  });

  it('lit un @graph avec @type multiple, plusieurs offres et entités HTML', () => {
    const r = parseGeneric(fixture('synthetic-jsonld-graph'), 'https://boutique.example/p/tripack');
    expect(r).toMatchObject({
      title: 'Tripack Pokémon Règne Delta',
      price: 21.9,
      currency: 'EUR',
      availability: 'PREORDER',
      ean: '196214144071',
      imageUrl: 'https://boutique.example/media/tripack.jpg',
    });
    expect(iso(r.releaseDate)).toBe('2026-11-28');
  });

  it('lit une vraie fiche Play-In via le seul JSON-LD', () => {
    const r = parseGeneric(fixture('playin-in-stock'), 'https://www.play-in.com/fr/produit/676233');
    expect(r.price).toBe(7.9);
    expect(r.availability).toBe('IN_STOCK');
  });
});

describe('Play-In (fixtures réelles)', () => {
  const url =
    'https://www.play-in.com/fr/produit/676233/booster-blister-pokemon-regne-delta-me06-fr';

  it('produit en stock, date « Sortie le » cohérente avec TCGdex', () => {
    const r = parsePlayIn(fixture('playin-in-stock'), url);
    expect(r).toMatchObject({
      title: 'Booster Blister Pokémon : Règne Delta [ME06] - FR',
      price: 7.9,
      currency: 'EUR',
      availability: 'IN_STOCK',
      ean: '196214144262',
    });
    expect(iso(r.releaseDate)).toBe('2026-11-06');
    expect(r.imageUrl).toMatch(/^https:\/\/media\.play-in\.com\//);
  });

  it('produit à venir : prix 0 → null, rupture, date « Sortie prévue le »', () => {
    const r = parsePlayIn(
      fixture('playin-coming-soon'),
      'https://www.play-in.com/fr/produit/659647/collection-avec-figurine-pokemon-30-ans-mewtwo-fr',
    );
    expect(r.title).toBe('Collection avec figurine Pokémon : 30 Ans – Mewtwo - FR');
    expect(r.price).toBeNull();
    expect(r.availability).toBe('OUT_OF_STOCK');
    expect(iso(r.releaseDate)).toBe('2026-11-27');
  });
});

describe('Philibert (fixtures réelles)', () => {
  it('précommande : JSON-LD sans disponibilité, bouton « Précommander »', () => {
    const r = parsePhilibert(
      fixture('philibert-preorder'),
      'https://www.philibertnet.com/fr/pokemon/184181-pokemon-me06-regne-delta-pack-3-boosters-196214144071.html',
    );
    expect(r).toMatchObject({
      title: 'Pokémon ME06 - Règne Delta - Pack 3 Boosters',
      price: 19.95,
      availability: 'PREORDER',
      ean: '196214144071',
    });
  });

  it('en stock : bouton « Ajouter au panier »', () => {
    const r = parsePhilibert(
      fixture('philibert-in-stock'),
      'https://www.philibertnet.com/fr/pokemon/184016-pokemon-mega-symphonia-m1s-30-boosters-display-8800286278108.html',
    );
    expect(r.availability).toBe('IN_STOCK');
    expect(r.price).toBe(79.95);
  });

  it('« À venir » sans bouton : pas commandable, pas de prix', () => {
    const r = parsePhilibert(
      fixture('philibert-coming-soon'),
      'https://www.philibertnet.com/fr/pokemon/184744-pokemon-30-ans-coffret-collection-avec-figurine-mewtwo-2100001434496.html',
    );
    expect(r.availability).toBe('OUT_OF_STOCK');
    expect(r.price).toBeNull();
    expect(r.title).toContain('Mewtwo');
  });
});

describe('Cultura (fixture synthétique)', () => {
  it('précommande et date de sortie, sans être trompé par les recommandations', () => {
    const r = parseCultura(
      fixture('synthetic-cultura-preorder'),
      'https://www.cultura.com/p-etb.html',
    );
    expect(r.availability).toBe('PREORDER');
    expect(r.price).toBe(59.99);
    expect(iso(r.releaseDate)).toBe('2026-12-05');
  });
});

describe('Smyths Toys (fixture synthétique)', () => {
  it('rupture en livraison + lien d’alerte de stock', () => {
    const r = parseSmyths(
      fixture('synthetic-smyths-out-of-stock'),
      'https://www.smythstoys.com/fr/fr-fr/p/123456',
    );
    expect(r.availability).toBe('OUT_OF_STOCK');
    expect(r.price).toBe(215.64);
    expect(r.stockAlertUrl).toBe('https://www.smythstoys.com/fr/fr-fr/notify-me?code=123456');
  });
});

describe('Registre des adaptateurs', () => {
  it('détecte le revendeur depuis l’URL', () => {
    expect(getAdapterForUrl('https://www.play-in.com/fr/produit/1').key).toBe('playin');
    expect(getAdapterForUrl('https://philibertnet.com/fr/x.html').key).toBe('philibert');
    expect(getAdapterForUrl('https://www.cultura.com/p-x.html').key).toBe('cultura');
    expect(getAdapterForUrl('https://www.smythstoys.com/fr/fr-fr/p/1').key).toBe('smyths');
    expect(getAdapterForUrl('https://www.boutique-inconnue.fr/p/1').key).toBe('jsonld');
  });

  it('propose un nom pour un revendeur inconnu', () => {
    expect(detectRetailer('https://www.ludifolie.com/p/1')).toMatchObject({
      domain: 'ludifolie.com',
      suggestedName: 'Ludifolie',
    });
  });

  it('refuse Amazon, Fnac et Cdiscount', () => {
    for (const url of [
      'https://www.amazon.fr/dp/B0',
      'https://www.fnac.com/a1',
      'https://www.cdiscount.com/f-1.html',
    ]) {
      expect(() => getAdapterForUrl(url)).toThrow(AdapterError);
    }
  });
});
