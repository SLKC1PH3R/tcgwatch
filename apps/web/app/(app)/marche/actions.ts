'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@tcgwatch/db';
import { manualProvider, TcgdexClient, tcgdexAsset } from '@tcgwatch/market';
import { requireUser } from '@/lib/auth';
import { firstIssue, formToObject } from '@/lib/form';

export interface MarketState {
  error?: string;
  success?: string;
}

/** Saisie manuelle du prix constaté sur Cardmarket (1 relevé par jour : la saisie remplace celle du jour). */
export async function addMarketPriceAction(
  _prev: MarketState,
  formData: FormData,
): Promise<MarketState> {
  await requireUser();
  const raw = formToObject(formData);
  let quote;
  try {
    quote = manualProvider.normalize({
      productId: raw.productId,
      price: (raw.price ?? '').replace(',', '.'),
      date: raw.date || new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    return { error: err instanceof z.ZodError ? firstIssue(err) : 'Saisie invalide.' };
  }
  await prisma.marketPrice.upsert({
    where: {
      productId_source_date: { productId: quote.productId, source: quote.source, date: quote.date },
    },
    update: { price: quote.price },
    create: quote,
  });
  revalidatePath('/marche');
  revalidatePath(`/produits/${quote.productId}`);
  return { success: 'Prix marché enregistré.' };
}

export async function deleteMarketPriceAction(id: string) {
  await requireUser();
  const mp = await prisma.marketPrice.delete({ where: { id } });
  revalidatePath('/marche');
  revalidatePath(`/produits/${mp.productId}`);
}

const chaseSchema = z.object({
  releaseId: z.string().min(1, 'Choisissez une extension'),
  tcgdexId: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.]+-[a-z0-9]+$/, 'Identifiant TCGdex attendu, ex. me06-130'),
});

/** Ajoute une carte phare suivie via TCGdex (le nom et l'image sont récupérés automatiquement). */
export async function addChaseCardAction(
  _prev: MarketState,
  formData: FormData,
): Promise<MarketState> {
  await requireUser();
  const parsed = chaseSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { releaseId, tcgdexId } = parsed.data;
  if (await prisma.chaseCard.findUnique({ where: { tcgdexId } }))
    return { error: 'Carte déjà suivie.' };
  try {
    const card = await new TcgdexClient().getCard(tcgdexId);
    await prisma.chaseCard.create({
      data: {
        releaseId,
        tcgdexId,
        name: card.name,
        rarity: card.rarity,
        imageUrl: tcgdexAsset(card.image, '/low.webp'),
      },
    });
  } catch {
    return { error: `Carte introuvable sur TCGdex : ${tcgdexId}` };
  }
  revalidatePath('/marche');
  return { success: 'Carte ajoutée : son prix sera relevé chaque jour par le worker.' };
}

export async function deleteChaseCardAction(id: string) {
  await requireUser();
  await prisma.chaseCard.delete({ where: { id } });
  revalidatePath('/marche');
}
