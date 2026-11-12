import { adapterKeyFor, RETAILER_DIRECTORY } from '@tcgwatch/adapters';
import { prisma } from '@tcgwatch/db';
import type { WorkerContext } from '../context';

/**
 * Synchronise l'annuaire des revendeurs (code) avec la base :
 * crée les sites manquants et met à jour leurs métadonnées (type, liens, statut, notes).
 * Le nom, l'activation et le délai réglés dans l'interface ne sont jamais écrasés.
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
    const existing = await prisma.retailer.findFirst({
      where: { OR: [{ domain: info.domain }, { slug: info.slug }] },
      select: { id: true },
    });
    if (existing) {
      await prisma.retailer.update({ where: { id: existing.id }, data: metadata });
    } else {
      await prisma.retailer.create({
        data: {
          slug: info.slug,
          name: info.name,
          domain: info.domain,
          minDelayMs: info.minDelayMs,
          ...metadata,
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
