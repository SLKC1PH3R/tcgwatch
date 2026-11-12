import { prisma, type Product, type Release } from '@tcgwatch/db';

const sameDay = (a: Date | null | undefined, b: Date) =>
  !!a && a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

/**
 * Enrichit le calendrier avec une date « Sortie prévue le » détectée chez un revendeur.
 *
 * - Product.releaseDate est mise à jour, sauf si elle a été saisie à la main ou vient du
 *   calendrier Pokécardex (plus fiable qu'une date d'expédition affichée par un revendeur).
 * - La Release liée est mise à jour uniquement si elle est en statut AUTO et :
 *   – qu'il s'agit d'une sortie propre à un type de produit (UPC, coffret…), ou
 *   – qu'elle n'a pas encore de date (une extension garde la date TCGdex, chaque produit
 *     pouvant sortir à une date différente).
 *
 * Retourne true si une date a changé.
 */
export async function enrichReleaseDate(
  product: Product & { release: Release | null },
  detected: Date,
): Promise<boolean> {
  let changed = false;

  if (
    product.releaseDateSource !== 'MANUAL' &&
    product.releaseDateSource !== 'POKECARDEX' &&
    !sameDay(product.releaseDate, detected)
  ) {
    await prisma.product.update({
      where: { id: product.id },
      data: { releaseDate: detected, releaseDateSource: 'RETAILER' },
    });
    changed = true;
  }

  const release = product.release;
  if (
    release &&
    release.status === 'AUTO' &&
    release.source !== 'POKECARDEX' &&
    (release.productType !== null || !release.releaseDate) &&
    !sameDay(release.releaseDate, detected)
  ) {
    await prisma.release.update({
      where: { id: release.id },
      data: { releaseDate: detected, source: 'RETAILER' },
    });
    changed = true;
  }

  return changed;
}
