import { prisma } from '@tcgwatch/db';
import { pickExtension } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';

/**
 * Rattache chaque produit à son extension TCGdex (Product.extensionId) d'après son nom et sa
 * date de sortie : fait une fois à l'import plutôt qu'à chaque affichage. Les produits déjà
 * rattachés ne sont pas modifiés.
 */
export async function linkProductExtensions(ctx: Pick<WorkerContext, 'logger'>): Promise<number> {
  const [products, sets] = await Promise.all([
    prisma.product.findMany({
      where: { extensionId: null },
      select: { id: true, name: true, releaseDate: true },
    }),
    prisma.release.findMany({
      where: { tcgdexId: { not: null } },
      select: { id: true, nameFr: true, releaseDate: true },
    }),
  ]);
  const named = sets.map((s) => ({ ...s, name: s.nameFr }));
  let linked = 0;
  for (const p of products) {
    const ext = pickExtension(p.name, p.releaseDate, named);
    if (!ext) continue;
    await prisma.product.update({ where: { id: p.id }, data: { extensionId: ext.id } });
    linked++;
  }
  ctx.logger.info(
    { linked, unlinked: products.length - linked },
    'Produits rattachés à leur extension',
  );
  return linked;
}
