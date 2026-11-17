import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AdapterError,
  adapterKeyFor,
  buildSearchUrl,
  detectRetailer,
  isBlockedDomain,
  normalizeDomain,
  RETAILER_DIRECTORY,
  searchTermsFor,
  getAdapterForUrl,
  mapSchemaAvailability,
  parseCultura,
  parseFantasySphere,
  parseLeTempleDuJeu,
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
    expect(r).toMatchObject({
      brand: 'The Pokemon Company',
      sku: '676233',
      category: 'Booster Pokémon français',
    });
    expect(r.description).toMatch(/^Rayquaza fait son grand retour/);
    expect(r.images).toEqual([r.imageUrl]);
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
      sku: '3PACK01ME06',
    });
    // HTML retiré de la description ; galerie en grande taille (thickbox), sans doublon.
    expect(r.description).toMatch(/^Le Pack 3 Boosters Pokémon ME06/);
    expect(r.description).not.toContain('<p>');
    expect(r.imageUrl).toContain('903025-thickbox_default');
    expect(r.images).toHaveLength(2);
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

describe('PrestaShop générique (fixtures réelles)', () => {
  it('Agorajeux : bouton panier désactivé → rupture, prix et grande image', () => {
    const r = parseGeneric(
      fixture('agorajeux-out-of-stock'),
      'https://www.agorajeux.com/19459-pokemon-me04-display.html',
    );
    expect(r.availability).toBe('OUT_OF_STOCK');
    expect(r.price).toBe(216);
    expect(r.imageUrl).toContain('large_default');
    expect(r.images).toHaveLength(1);
    expect(r.description).toMatch(/Chaos Ascendant/);
  });

  it('BCD Jeux : « En Stock, Expédié sous 24h » → en stock', () => {
    const r = parseGeneric(
      fixture('bcd-jeux-lucario'),
      'https://www.bcd-jeux.fr/pokemon-tcg/39011-pokemon-anniversaire-30-ans-collection-autocollant-reajustable-lucario-pokemon.html',
    );
    expect(r.availability).toBe('IN_STOCK');
    expect(r.title).toContain('Lucario');
    expect(r.imageUrl).toContain('large_default');
    // Le fil d'Ariane se termine par le produit lui-même : pas de catégorie inventée.
    expect(r.category).toBeUndefined();
  });
});

describe('E.Leclerc via JSON-LD (fixture réelle)', () => {
  it('EAN normalisé, galerie, marque et rayon', () => {
    const r = parseGeneric(
      fixture('leclerc-coffret'),
      'https://www.e.leclerc/fp/pokemon-coffret-ex-start-1-3-boosters-0196214134966',
    );
    expect(r).toMatchObject({
      availability: 'IN_STOCK',
      ean: '196214134966',
      brand: 'Pokémon',
      category: 'Cartes Pokémon',
    });
    expect(r.price).toBeGreaterThan(0);
    expect(r.images?.length).toBeGreaterThanOrEqual(2);
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

describe('Annuaire des revendeurs', () => {
  it('slugs et domaines uniques, cohérents avec les URL', () => {
    const slugs = RETAILER_DIRECTORY.map((r) => r.slug);
    const domains = RETAILER_DIRECTORY.map((r) => r.domain);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(domains).size).toBe(domains.length);
    for (const r of RETAILER_DIRECTORY) {
      expect(normalizeDomain(r.websiteUrl)).toBe(r.domain);
      expect(normalizeDomain(r.pokemonUrl)).toBe(r.domain);
      if (r.searchUrl) expect(r.searchUrl).toContain('{q}');
      expect(isBlockedDomain(r.websiteUrl)).toBe(false);
    }
  });

  it('associe le bon adaptateur', () => {
    const key = (slug: string) => adapterKeyFor(RETAILER_DIRECTORY.find((r) => r.slug === slug)!);
    expect(key('play-in')).toBe('playin');
    expect(key('philibert')).toBe('philibert');
    expect(key('smyths')).toBe('smyths');
    expect(key('agorajeux')).toBe('jsonld');
  });

  it('construit des recherches produit propres', () => {
    const terms = searchTermsFor('Booster Blister Pokémon : Règne Delta [ME06] - FR');
    expect(terms).toBe('Booster Blister Pokémon Règne Delta');
    expect(buildSearchUrl('https://www.play-in.com/fr/recherche?q={q}', terms)).toBe(
      'https://www.play-in.com/fr/recherche?q=Booster+Blister+Pok%C3%A9mon+R%C3%A8gne+Delta',
    );
    expect(buildSearchUrl(null, terms)).toBeUndefined();
  });
});

describe('Fantasy Sphere', () => {
  const url =
    'https://www.fantasysphere.net/product/tri-pack-3-boosters-opermine-mega-evolution-nuit-noire-me05-pbl-pokemon-fr-10045234';

  it('lit prix et stock affiché (l’état masqué par d-none est ignoré)', () => {
    const r = parseFantasySphere(fixture('fantasysphere-in-stock'), url);
    expect(r.price).toBe(19.9);
    expect(r.availability).toBe('IN_STOCK');
    expect(r.title).toBe(
      'Tri-Pack - 3 Boosters - Opermine - Méga-Évolution : Nuit Noire [ME05][PBL] - Pokémon - FR',
    );
    expect(getAdapterForUrl(url).key).toBe('fantasysphere');
  });

  it('rupture : « Indisponible » affiché, « En stock » masqué', () => {
    const html = fixture('fantasysphere-in-stock')
      .replaceAll('in-stock "', 'in-stock d-none"')
      .replaceAll('out-stock d-none', 'out-stock');
    expect(parseFantasySphere(html, url).availability).toBe('OUT_OF_STOCK');
  });
});

describe('microdonnées schema.org (Ultrajeux)', () => {
  it('lit prix, disponibilité et EAN des itemprop du premier produit', () => {
    const html = `<html><body>
      <div itemscope itemtype="http://schema.org/Product">
        <meta itemprop="name" content="Display 36 Boosters - ME06 Règne Delta" />
        <meta itemprop="gtin13" content="0196214144620" />
        <meta itemprop="brand" content="The Pokémon Company" />
        <div itemprop="offers" itemscope itemtype="http://schema.org/Offer">
          <meta itemprop="price" content="229.90" />
          <meta itemprop="priceCurrency" content="EUR" />
          <meta itemprop="availability" content="InStock" />
        </div>
      </div>
      <div itemscope itemtype="http://schema.org/Product">
        <meta itemprop="price" content="6.90" />
        <meta itemprop="availability" content="OutOfStock" />
      </div>
    </body></html>`;
    const r = parseGeneric(html, 'https://www.ultrajeux.com/produit-33586-display.html');
    expect(r).toMatchObject({
      price: 229.9,
      availability: 'IN_STOCK',
      ean: '196214144620',
      brand: 'The Pokémon Company',
    });
  });
});

describe('WooCommerce sans JSON-LD (Maxi Rêves)', () => {
  const page = (stock: string, price: string) => `<html><body><div class="product">
    <div class="summary entry-summary">
      <h1 class="product_title">Pokémon - Coffret collection premium Zygarde</h1>
      ${price}
      <p class="stock ${stock}">3 en stock</p>
    </div></div></body></html>`;

  it('prend le prix de la boutique plutôt que le prix public affiché avant', () => {
    const html = page(
      'in-stock',
      `<p class="price"><span>Prix public conseillé : <span class="woocommerce-Price-amount amount"><bdi>60,00&euro;</bdi></span></span>
       <span>Votre prix : <span class="woocommerce-Price-amount amount"><bdi>51,00&euro;</bdi></span></span></p>`,
    );
    const r = parseGeneric(html, 'https://maxireves.fr/produit/zygarde/');
    expect(r).toMatchObject({ price: 51, availability: 'IN_STOCK' });
  });

  it('prend le prix soldé et lit la rupture', () => {
    const html = page(
      'out-of-stock',
      `<p class="price"><del><span class="woocommerce-Price-amount amount"><bdi>59,90&euro;</bdi></span></del>
       <ins><span class="woocommerce-Price-amount amount"><bdi>49,90&euro;</bdi></span></ins></p>`,
    );
    const r = parseGeneric(html, 'https://example.fr/produit/x/');
    expect(r).toMatchObject({ price: 49.9, availability: 'OUT_OF_STOCK' });
  });
});

describe('Shopify sans JSON-LD (Masterset)', () => {
  const page = (available: boolean) => `<html><head>
    <meta property="og:title" content="ETB - EB12.5 - Zénith Suprême">
    <meta property="product:price:amount" content="64,90">
    <script src="https://cdn.shopify.com/s/files/theme.js"></script></head><body><main>
    <span class="product_badge sale_out">En rupture de stock</span>
    <button type="submit" class="hidden">Ajouter au panier</button>
    <script>var product = {"tags":["etb"],"price":6490,"price_min":6490,"price_max":6490,"available":${available},"price_varies":false};</script>
    </main></body></html>`;

  it("lit la rupture dans l'objet produit malgré le bouton « Ajouter au panier » caché", () => {
    const r = parseGeneric(page(false), 'https://masterset.store/products/etb-eb12-5');
    expect(r.availability).toBe('OUT_OF_STOCK');
  });

  it('en stock quand une variante est achetable', () => {
    const r = parseGeneric(page(true), 'https://masterset.store/products/etb-eb12-5');
    expect(r.availability).toBe('IN_STOCK');
  });
});

describe('Le Temple du Jeu', () => {
  const page = (panier: string) => `<html><body><div class="designation">
    <h1 itemprop="name" class="jeu_titre">DUOPACK ZARUDE (Pokémon Q3 2026)</h1></div>
    <div class="anto_blocpanier"><p class="jeu_prix price fleft">14.90&nbsp;&euro;</p>${panier}</div>
    </body></html>`;
  const url = 'https://www.letempledujeu.fr/zoom1109057.html';

  it('lit le prix et le stock du bloc panier', () => {
    const r = parseLeTempleDuJeu(
      page(`<span class="enstock-big">cet article est <span>en stock</span>.</span>
        <a class="dispo bouton-valide">ajouter au panier</a>`),
      url,
    );
    expect(r).toMatchObject({
      title: 'DUOPACK ZARUDE (Pokémon Q3 2026)',
      price: 14.9,
      availability: 'IN_STOCK',
    });
    expect(getAdapterForUrl(url).key).toBe('letempledujeu');
  });

  it('compte un article vendu seulement en boutique comme indisponible en ligne', () => {
    const r = parseLeTempleDuJeu(
      page(`Cet article ne peut pas être expedié par correspondance. Néanmoins, il est peut-être
        disponible dans l'une de nos boutiques.`),
      url,
    );
    expect(r.availability).toBe('OUT_OF_STOCK');
  });
});
