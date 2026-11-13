'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@tcgwatch/db';
import { cardmarketQuote, tcgdexAsset, TcgdexClient } from '@tcgwatch/market';
import { todayUtc } from '@tcgwatch/shared';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { firstIssue, formToObject, optionalPrice } from '@/lib/form';

const cardPath = (tcgdexId: string) => `/cartes/${encodeURIComponent(tcgdexId)}`;

/**
 * Suit n'importe quelle carte (en plus de la sélection automatique) : nom, image et cotes
 * du jour viennent de TCGdex ; le worker relève ensuite ses cotes chaque jour.
 */
export async function followCardAction(tcgdexId: string) {
  await requireUser();
  if (await prisma.chaseCard.findUnique({ where: { tcgdexId } })) redirect(cardPath(tcgdexId));

  const card = await new TcgdexClient().getCard(tcgdexId).catch(() => null);
  if (!card)
    redirect(`${cardPath(tcgdexId)}?erreur=${encodeURIComponent('Carte introuvable sur TCGdex.')}`);
  const release = card.set
    ? await prisma.release.findFirst({ where: { tcgdexId: card.set.id }, select: { id: true } })
    : null;
  if (!release) {
    redirect(
      `${cardPath(tcgdexId)}?erreur=${encodeURIComponent(
        `L’extension ${card.set?.name ?? ''} n’est pas encore au calendrier : import TCGdex à venir.`,
      )}`,
    );
  }

  const chase = await prisma.chaseCard.create({
    data: {
      tcgdexId,
      releaseId: release.id,
      name: card.name,
      rarity: card.rarity ?? null,
      imageUrl: tcgdexAsset(card.image, '/low.webp') ?? null,
      manual: true,
    },
  });
  const quote = cardmarketQuote(card);
  if (quote) {
    await prisma.cardPrice.create({
      data: {
        chaseCardId: chase.id,
        source: 'tcgdex-cardmarket',
        currency: 'EUR',
        date: todayUtc(),
        ...quote,
      },
    });
  }
  revalidatePath('/marche');
  revalidatePath(cardPath(tcgdexId));
  redirect(cardPath(tcgdexId));
}

/** Arrête le suivi d'une carte (son historique de cotes est supprimé). */
export async function unfollowCardAction(tcgdexId: string) {
  await requireUser();
  await prisma.chaseCard.deleteMany({ where: { tcgdexId } });
  revalidatePath('/marche');
  revalidatePath(cardPath(tcgdexId));
}

const thresholdsSchema = z.object({ alertBelow: optionalPrice, alertAbove: optionalPrice });

/** Seuils d'alerte d'une carte suivie (tendance sous / au-dessus de X €), vides = aucun. */
export async function setCardAlertAction(tcgdexId: string, formData: FormData) {
  await requireUser();
  const parsed = thresholdsSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    redirect(`${cardPath(tcgdexId)}?erreur=${encodeURIComponent(firstIssue(parsed.error))}`);
  }
  const { alertBelow, alertAbove } = parsed.data;
  if (alertBelow !== null && alertAbove !== null && alertBelow >= alertAbove) {
    redirect(
      `${cardPath(tcgdexId)}?erreur=${encodeURIComponent('Le seuil bas doit être inférieur au seuil haut.')}`,
    );
  }
  await prisma.chaseCard.update({ where: { tcgdexId }, data: { alertBelow, alertAbove } });
  revalidatePath(cardPath(tcgdexId));
}
