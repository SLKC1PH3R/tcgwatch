import { describe, expect, it } from 'vitest';
import { MAX_PRODUCT_IMAGES, productDetailsPatch } from '../src/product-details';

const empty = { imageUrl: null, images: [], description: null, brand: null };

describe('productDetailsPatch', () => {
  it('remplit une fiche vide', () => {
    expect(
      productDetailsPatch(empty, {
        imageUrl: 'https://a/1.jpg',
        images: ['https://a/1.jpg', 'https://a/2.jpg'],
        description: 'Trois boosters',
        brand: 'Pokémon',
      }),
    ).toEqual({
      imageUrl: 'https://a/1.jpg',
      images: ['https://a/1.jpg', 'https://a/2.jpg'],
      description: 'Trois boosters',
      brand: 'Pokémon',
    });
  });

  it("n'écrase pas la saisie et complète seulement la galerie", () => {
    const product = {
      imageUrl: 'https://mine/p.jpg',
      images: ['https://mine/p.jpg'],
      description: 'Ma description',
      brand: 'TPC',
    };
    expect(
      productDetailsPatch(product, {
        imageUrl: 'https://b/1.jpg',
        images: ['https://b/1.jpg'],
        description: 'Autre',
        brand: 'Autre',
      }),
    ).toEqual({ images: ['https://mine/p.jpg', 'https://b/1.jpg'] });
  });

  it('remplace une petite image par sa grande taille, sans doublon', () => {
    const small = 'https://cdn/903025-cart_default/x.jpg';
    const large = 'https://cdn/903025-thickbox_default/x.jpg';
    expect(
      productDetailsPatch({ ...empty, imageUrl: small, images: [small] }, { imageUrl: large }),
    ).toEqual({ imageUrl: large, images: [large] });
  });

  it('ne renvoie rien quand il n’y a rien de neuf, plafonne la galerie', () => {
    const product = { ...empty, imageUrl: 'https://a/1.jpg', images: ['https://a/1.jpg'] };
    expect(productDetailsPatch(product, { imageUrl: 'https://a/1.jpg' })).toEqual({});
    const many = Array.from({ length: 30 }, (_, i) => `https://a/${i}.jpg`);
    expect(productDetailsPatch(empty, { images: many }).images).toHaveLength(MAX_PRODUCT_IMAGES);
  });
});
