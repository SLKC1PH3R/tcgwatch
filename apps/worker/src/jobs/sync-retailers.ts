import { adapterKeyFor, RETAILER_DIRECTORY } from '@tcgwatch/adapters';
import { prisma } from '@tcgwatch/db';
import type { WorkerContext } from '../context';

/**
 * Synchronise l'annuaire des revendeurs (code) avec la base :
 * crée les sites manquants et met à jour leurs métadonnées (type, liens, statut, notes).
 * Le nom, l'activation, le délai et les frais de port réglés dans l'interface ne sont jamais
 * écrasés.
 */
export async function syncRetailers(ctx: Pick<WorkerContext, 'logger'>): Promise<number> {
  let created = 0;
  for (const info of RETAILER_DIRECTORY) {
    const metadata = {
      kind: info.kind,
      access: info.access,
      websiteUrl: info.websiteUrl,
      pokemonUrl: info.pokemonUrl,
      searchUrl: info.searchUrl ?? null,
      notes: info.notes ?? null,
      adapterKey: adapterKeyFor(info),
    };
    const shipping = {
      shippingCost: info.shipping?.cost ?? null,
      freeShippingFrom: info.shipping?.freeFrom ?? null,
    };
    const existing = await prisma.retailer.findFirst({
      where: { OR: [{ domain: info.domain }, { slug: info.slug }] },
      select: { id: true, shippingManual: true },
    });
    if (existing) {
      // Frais de port saisis sur le site : gardés tels quels.
      await prisma.retailer.update({
        where: { id: existing.id },
        data: existing.shippingManual ? metadata : { ...metadata, ...shipping },
      });
    } else {
      await prisma.retailer.create({
        data: {
          slug: info.slug,
          name: info.name,
          domain: info.domain,
          minDelayMs: info.minDelayMs,
          ...metadata,
          ...shipping,
        },
      });
      created++;
    }
  }
  ctx.logger.info(
    { total: RETAILER_DIRECTORY.length, created },
    'Annuaire des revendeurs synchronisé',
  );
  return created;
}
