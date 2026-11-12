import { dedupeImages, type ListingResult } from '@tcgwatch/adapters';

export const MAX_PRODUCT_IMAGES = 12;

interface ProductDetails {
  imageUrl: string | null;
  images: string[];
  description: string | null;
  brand: string | null;
}

/**
 * Complète la fiche produit avec ce qu'une fiche revendeur apporte, sans jamais écraser
 * une saisie existante : image principale, description et marque seulement si vides ;
 * la galerie est l'union des images de tous les revendeurs (dédoublonnée, plafonnée).
 */
export function productDetailsPatch(
  product: ProductDetails,
  result: Pick<ListingResult, 'imageUrl' | 'images' | 'description' | 'brand'>,
): Partial<ProductDetails> {
  const patch: Partial<ProductDetails> = {};
  // Une même image en plusieurs tailles n'est gardée qu'une fois, dans la plus grande :
  // l'image principale saisie peut donc être remplacée par sa version haute définition.
  const gallery = dedupeImages(
    [product.imageUrl, ...product.images, result.imageUrl, ...(result.images ?? [])].filter(
      (u): u is string => !!u,
    ),
  ).slice(0, MAX_PRODUCT_IMAGES);
  const imageUrl = gallery[0] ?? null;
  if (imageUrl && imageUrl !== product.imageUrl) patch.imageUrl = imageUrl;
  if (gallery.join('\n') !== product.images.join('\n')) patch.images = gallery;

  if (!product.description && result.description) patch.description = result.description;
  if (!product.brand && result.brand) patch.brand = result.brand;
  return patch;
}
