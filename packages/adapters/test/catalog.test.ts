import { describe, expect, it } from 'vitest';
import { extractCatalogLinks, linkInfoFromUrl } from '../src/catalog';

// Vignette WooCommerce (Akilon) : image en chargement différé avec <noscript>, alt descriptif.
const html = `
<div class="wd-product product-grid-item">
  <a href="https://akilon.eu/produit/etb-pokemon-regne-delta-me06-francais/" class="product-image-link"
     aria-label="Pokémon ME06 Règne Delta – Elite Trainer Box – 9 Boosters – Français">
    <img src="data:image/svg+xml" alt="ETB Pokémon Règne Delta ME06 avec 9 boosters, carte promo Kyogre et Méga-Rayquaza" />
    <noscript><img src="https://akilon.eu/etb.webp" alt="ETB Pokémon Règne Delta ME06 avec 9 boosters" /></noscript>
  </a>
  <h3 class="wd-entities-title"><a href="https://akilon.eu/produit/etb-pokemon-regne-delta-me06-francais/">Pokémon ME06 Règne Delta – Elite Trainer Box – 9 Boosters – Français</a></h3>
</div>`;

describe('extractCatalogLinks', () => {
  it('lit le titre affiché, jamais le HTML du <noscript> ni le texte alternatif', () => {
    expect(
      extractCatalogLinks(html, 'https://akilon.eu/', /^https:\/\/akilon\.eu\/produit\/[^/]+\/$/),
    ).toEqual([
      {
        url: 'https://akilon.eu/produit/etb-pokemon-regne-delta-me06-francais/',
        title: 'Pokémon ME06 Règne Delta – Elite Trainer Box – 9 Boosters – Français',
      },
    ]);
  });
});

describe('titre tronqué et EAN dans l’adresse', () => {
  const url =
    'https://www.tales-of-games.fr/jcc-pokemon/34731-pokemon-mega-amphinobi-ex-collection-premium-fr-0196214141964.html';

  it('reconstruit l’intitulé et lit l’EAN', () => {
    expect(linkInfoFromUrl(url)).toEqual({
      title: 'pokemon mega amphinobi ex collection premium fr',
      ean: '196214141964',
    });
    expect(linkInfoFromUrl('https://x.fr/p/12-deck-joltdengo-fr.html')).toEqual({
      title: 'deck joltdengo fr',
      ean: undefined,
    });
  });

  it('remplace un titre tronqué par celui de l’adresse', () => {
    const html = `<article><h2 class="product-title"><a href="${url}">Pokémon - Méga-Amphinobi ex -...</a></h2></article>`;
    const [link] = extractCatalogLinks(
      html,
      'https://www.tales-of-games.fr/41-jcc-pokemon',
      /\/jcc-pokemon\/\d+-[a-z0-9-]+\.html$/,
    );
    expect(link).toMatchObject({
      title: 'pokemon mega amphinobi ex collection premium fr',
      ean: '196214141964',
    });
  });
});
