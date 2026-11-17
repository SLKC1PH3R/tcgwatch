import { prisma } from '@tcgwatch/db';
import {
  type CardmarketGuideProvider,
  type CardmarketProduct,
  expansionsOfReleases,
  matchSealedProduct,
  plausibleCardmarketMatch,
} from '@tcgwatch/market';

interface SealedRef {
  id: string;
  name: string;
  type: string;
  cardmarketId: number | null;
  cardmarketName?: string | null;
  cardmarketCategory?: string | null;
  releaseDate: Date | null;
  extensionId: string | null;
}

/**
 * Relie les produits scellés à leur produit Cardmarket sans passer par CardNexus : l'extension
 * Cardmarket vient des cartes de l'extension (déjà reliées), puis le produit de même format
 * parmi les produits scellés de cette extension (catalogue officiel de Cardmarket).
 * Un lien existant et plausible est gardé ; un lien jugé faux est remplacé.
 */
export async function linkSealedProducts(
  provider: CardmarketGuideProvider,
  products: SealedRef[],
): Promise<number> {
  const withExtension = products.filter((p) => p.extensionId);
  if (withExtension.length === 0) return 0;
  const [list, singles] = await Promise.all([provider.productList(), provider.singlesList()]);

  const cards = await prisma.card.findMany({
    where: {
      cardmarketId: { not: null },
      releaseId: { in: [...new Set(withExtension.map((p) => p.extensionId!))] },
    },
    select: { releaseId: true, cardmarketId: true },
  });
  const expansionOf = expansionsOfReleases(
    cards.map((c) => ({ releaseId: c.releaseId, cardmarketId: c.cardmarketId! })),
    singles,
  );
  const byExpansion = new Map<number, CardmarketProduct[]>();
  for (const p of list.values()) {
    if (!p.idExpansion) continue;
    byExpansion.set(p.idExpansion, [...(byExpansion.get(p.idExpansion) ?? []), p]);
  }

  let linked = 0;
  for (const p of withExtension) {
    const current = p.cardmarketId ? list.get(p.cardmarketId) : undefined;
    if (current && plausibleCardmarketMatch(p, current)) continue;
    const expansion = expansionOf.get(p.extensionId!);
    if (!expansion) continue;
    const match = matchSealedProduct(p, byExpansion.get(expansion) ?? []);
    const cm = match ? list.get(match) : undefined;
    if (!match || !cm || !plausibleCardmarketMatch(p, cm) || match === p.cardmarketId) continue;
    await prisma.product.update({ where: { id: p.id }, data: { cardmarketId: match } });
    p.cardmarketId = match;
    linked++;
  }
  // Nom (anglais) et catégorie Cardmarket des produits liés : lien direct vers leur fiche.
  for (const p of products) {
    const cm = p.cardmarketId ? list.get(p.cardmarketId) : undefined;
    const name = cm?.name ?? null;
    const category = cm?.categoryName ?? null;
    if (name === (p.cardmarketName ?? null) && category === (p.cardmarketCategory ?? null)) {
      continue;
    }
    await prisma.product.update({
      where: { id: p.id },
      data: { cardmarketName: name, cardmarketCategory: category },
    });
    p.cardmarketName = name;
    p.cardmarketCategory = category;
  }
  return linked;
}
