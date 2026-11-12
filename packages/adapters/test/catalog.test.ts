import { describe, expect, it } from 'vitest';
import { extractCatalogLinks } from '../src/catalog';

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
